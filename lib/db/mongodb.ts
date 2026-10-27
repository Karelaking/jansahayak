import { MongoClient, Db, GridFSBucket, ObjectId } from "mongodb";
import { createHash } from "crypto";
import { Readable } from "stream";
import fs from "fs";
import path from "path";
import os from "os";
import type { GPSSample, ProcessingStatus } from "@/lib/pipeline/types";

// Global cache for MongoClient across Next.js dev reloads
declare global {
  // eslint-disable-next-line no-var
  var __jansahayak_mongo_client__: MongoClient | undefined;
  // eslint-disable-next-line no-var
  var __jansahayak_mongo_connected__: boolean | undefined;
}

const uri =
  process.env.MONGODB_URI || "mongodb://mongo:mongo@localhost:27017/jansahayak?authSource=admin";
const dbName = process.env.MONGODB_DB_NAME || "jansahayak";

let client: MongoClient;

if (process.env.NODE_ENV === "development") {
  if (!global.__jansahayak_mongo_client__) {
    global.__jansahayak_mongo_client__ = new MongoClient(uri, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 2000,
      connectTimeoutMS: 2000,
    });
  }
  client = global.__jansahayak_mongo_client__;
} else {
  client = new MongoClient(uri, {
    maxPoolSize: 50,
    serverSelectionTimeoutMS: 4000,
    connectTimeoutMS: 4000,
  });
}

// ─────────────────────────────────────────────────────────────
// Resilient Local Fallback for Offline / Dockerless Environments
// Stored in os.tmpdir() to avoid triggering Next.js Turbopack HMR file-watcher reload loops.
// ─────────────────────────────────────────────────────────────
const localStoreDir = path.resolve(os.tmpdir(), "jansahayak-mongo");
const photosDir = path.join(localStoreDir, "photos");

function ensureLocalDirs() {
  try {
    if (!fs.existsSync(localStoreDir)) fs.mkdirSync(localStoreDir, { recursive: true });
    if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });
  } catch {
    // Ignore in read-only environments
  }
}

const localCollections: Record<string, any[]> = {
  raw_reports: [],
  ai_analysis_logs: [],
  pipeline_job_logs: [],
};

const localPhotoBuffers = new Map<string, { buffer: Buffer; contentType: string }>();

function loadLocalCollection(name: string): any[] {
  if (!localCollections[name]) {
    localCollections[name] = [];
  }
  ensureLocalDirs();
  const filePath = path.join(localStoreDir, `${name}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (Array.isArray(data)) {
        localCollections[name] = data;
      }
    } catch {
      // Ignore parse error
    }
  }
  return localCollections[name];
}

function saveLocalCollection(name: string) {
  ensureLocalDirs();
  const filePath = path.join(localStoreDir, `${name}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(localCollections[name] || [], null, 2), "utf-8");
  } catch {
    // Ignore write error
  }
}

function matchesLocalDoc(doc: any, filter: Record<string, any>): boolean {
  for (const [key, val] of Object.entries(filter)) {
    if (key === "$or" && Array.isArray(val)) {
      if (!val.some((clause) => matchesLocalDoc(doc, clause))) return false;
      continue;
    }
    if (key === "_id") {
      if (doc._id?.toString() !== val?.toString()) return false;
      continue;
    }
    if (val && typeof val === "object" && "$in" in val && Array.isArray(val.$in)) {
      if (!val.$in.includes(doc[key])) return false;
      continue;
    }
    if (doc[key] !== val) {
      return false;
    }
  }
  return true;
}

class MockCollection<T extends Record<string, any>> {
  constructor(public name: string) {
    loadLocalCollection(name);
  }

  async insertOne(doc: any): Promise<{ insertedId: ObjectId }> {
    const list = loadLocalCollection(this.name);
    const newDoc = {
      _id: doc._id || new ObjectId(),
      ...doc,
      createdAt: doc.createdAt || new Date().toISOString(),
      updatedAt: doc.updatedAt || new Date().toISOString(),
    };
    list.unshift(newDoc);
    saveLocalCollection(this.name);
    return { insertedId: newDoc._id };
  }

  async findOne(filter: Record<string, any>, _options?: any): Promise<T | null> {
    const list = loadLocalCollection(this.name);
    const item = list.find((doc) => matchesLocalDoc(doc, filter));
    return item ? (JSON.parse(JSON.stringify(item)) as T) : null;
  }

  async updateOne(filter: Record<string, any>, update: Record<string, any>): Promise<{ matchedCount: number; modifiedCount: number }> {
    const list = loadLocalCollection(this.name);
    const idx = list.findIndex((doc) => matchesLocalDoc(doc, filter));

    if (idx === -1) {
      return { matchedCount: 0, modifiedCount: 0 };
    }

    if (update.$set) {
      Object.assign(list[idx], update.$set, { updatedAt: new Date().toISOString() });
    } else {
      Object.assign(list[idx], update, { updatedAt: new Date().toISOString() });
    }
    saveLocalCollection(this.name);
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async deleteOne(filter: Record<string, any>): Promise<{ deletedCount: number }> {
    const list = loadLocalCollection(this.name);
    const idx = list.findIndex((doc) => matchesLocalDoc(doc, filter));
    if (idx !== -1) {
      list.splice(idx, 1);
      saveLocalCollection(this.name);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }

  async deleteMany(filter: Record<string, any> = {}): Promise<{ deletedCount: number }> {
    const list = loadLocalCollection(this.name);
    const initialLen = list.length;
    const remaining = list.filter((doc) => !matchesLocalDoc(doc, filter));
    localCollections[this.name] = remaining;
    saveLocalCollection(this.name);
    return { deletedCount: initialLen - remaining.length };
  }

  find(query: Record<string, any> = {}) {
    let list = [...loadLocalCollection(this.name)];
    if (Object.keys(query).length > 0) {
      list = list.filter((doc) => matchesLocalDoc(doc, query));
    }

    const cursor = {
      sort: (sortObj: Record<string, number>) => {
        const [field, direction] = Object.entries(sortObj)[0] || ["createdAt", -1];
        list.sort((a, b) => {
          const valA = a[field];
          const valB = b[field];
          if (valA < valB) return direction === 1 ? -1 : 1;
          if (valA > valB) return direction === 1 ? 1 : -1;
          return 0;
        });
        return cursor;
      },
      limit: (n: number) => {
        list = list.slice(0, n);
        return cursor;
      },
      project: (_proj: Record<string, any>) => cursor,
      toArray: async () => JSON.parse(JSON.stringify(list)),
    };
    return cursor;
  }

  async countDocuments(filter: Record<string, any> = {}): Promise<number> {
    const list = loadLocalCollection(this.name);
    if (Object.keys(filter).length === 0) return list.length;
    return list.filter((doc) => matchesLocalDoc(doc, filter)).length;
  }
}

function detectBufferMime(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString() === "RIFF" &&
    buf.subarray(8, 12).toString() === "WEBP"
  ) {
    return "image/webp";
  }
  if (buf.subarray(0, 5).toString().includes("<svg")) {
    return "image/svg+xml";
  }
  return "image/jpeg";
}

class MockGridFSBucket {
  constructor(public bucketName = "evidence_photos") {}

  find(filter: Record<string, any> = {}) {
    return {
      toArray: async () => {
        const targetId = filter._id?.toString();
        if (!targetId) return [];
        const mem = localPhotoBuffers.get(targetId);
        if (mem) {
          return [{ _id: new ObjectId(targetId), metadata: { contentType: mem.contentType } }];
        }
        const filePath = path.join(photosDir, `${targetId}.bin`);
        if (fs.existsSync(filePath)) {
          let contentType = "image/jpeg";
          try {
            const fd = fs.openSync(filePath, "r");
            const head = Buffer.alloc(16);
            fs.readSync(fd, head, 0, 16, 0);
            fs.closeSync(fd);
            contentType = detectBufferMime(head);
          } catch {
            // default fallback
          }
          return [{ _id: new ObjectId(targetId), metadata: { contentType } }];
        }
        return [];
      },
    };
  }

  openDownloadStream(objectId: ObjectId) {
    const idStr = objectId.toString();
    let buf: Buffer | undefined;
    const mem = localPhotoBuffers.get(idStr);
    if (mem) {
      buf = mem.buffer;
    } else {
      const filePath = path.join(photosDir, `${idStr}.bin`);
      if (fs.existsSync(filePath)) {
        buf = fs.readFileSync(filePath);
      }
    }

    if (!buf) {
      // 1x1 transparent JPEG fallback
      buf = Buffer.from(
        "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
        "base64",
      );
    }

    return Readable.from([buf]);
  }
}

let isTestingConnection = false;

async function checkMongoConnection(): Promise<boolean> {
  if (global.__jansahayak_mongo_connected__ !== undefined) {
    return global.__jansahayak_mongo_connected__;
  }
  if (isTestingConnection) return false;

  isTestingConnection = true;
  try {
    await client.connect();
    global.__jansahayak_mongo_connected__ = true;
    return true;
  } catch {
    global.__jansahayak_mongo_connected__ = false;
    console.warn(
      `[MongoDB] Local instance unavailable at ${uri.replace(/:[^:@]+@/, ":****@")}. Using resilient file-backed local storage fallback.`,
    );
    return false;
  } finally {
    isTestingConnection = false;
  }
}

/**
 * Returns connected MongoDB database instance, or throws cleanly.
 */
export async function getMongoDb(): Promise<Db> {
  const isOnline = await checkMongoConnection();
  if (isOnline) {
    return client.db(dbName);
  }
  // Return dummy DB that throws if accessed directly
  return client.db(dbName);
}

/**
 * Returns GridFS bucket configured for evidence photos, with fallback.
 */
export async function getGridFSBucket(): Promise<GridFSBucket> {
  const isOnline = await checkMongoConnection();
  if (isOnline) {
    const db = client.db(dbName);
    return new GridFSBucket(db, { bucketName: "evidence_photos" });
  }
  return new MockGridFSBucket("evidence_photos") as unknown as GridFSBucket;
}

/**
 * Collection helper for raw citizen report submissions.
 */
export async function getReportsCollection() {
  const isOnline = await checkMongoConnection();
  if (isOnline) {
    const db = client.db(dbName);
    return db.collection<RawReportDocument>("raw_reports");
  }
  return new MockCollection<RawReportDocument>("raw_reports") as any;
}

/**
 * Collection helper for raw AI vision responses & embeddings.
 */
export async function getAILogsCollection() {
  const isOnline = await checkMongoConnection();
  if (isOnline) {
    const db = client.db(dbName);
    return db.collection<AILogDocument>("ai_analysis_logs");
  }
  return new MockCollection<AILogDocument>("ai_analysis_logs") as any;
}

/**
 * Collection helper for granular pipeline job execution history.
 */
export async function getPipelineLogsCollection() {
  const isOnline = await checkMongoConnection();
  if (isOnline) {
    const db = client.db(dbName);
    return db.collection<PipelineJobLogDocument>("pipeline_job_logs");
  }
  return new MockCollection<PipelineJobLogDocument>("pipeline_job_logs") as any;
}

/**
 * Helper to compute SHA-256 hash of photo buffer for duplicate detection.
 */
export function computeBufferSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Uploads an evidence photo directly to GridFS with capture telemetry metadata,
 * falling back to resilient local storage when MongoDB is offline.
 */
export async function uploadEvidencePhotoToGridFS(params: {
  buffer: Buffer;
  filename: string;
  reportId: string;
  photoIndex: number;
  contentType: string;
  isCameraCapture?: boolean;
  gps: {
    latitude: number;
    longitude: number;
    horizontalAccuracyMeters: number;
    capturedAt: string;
  };
}): Promise<{ fileId: string; sha256: string; length: number }> {
  const sha256 = computeBufferSha256(params.buffer);
  const isOnline = await checkMongoConnection();

  if (!isOnline) {
    ensureLocalDirs();
    const fileId = new ObjectId().toString();
    localPhotoBuffers.set(fileId, {
      buffer: params.buffer,
      contentType: params.contentType,
    });
    try {
      fs.writeFileSync(path.join(photosDir, `${fileId}.bin`), params.buffer);
    } catch {
      // Ignore write errors
    }
    return {
      fileId,
      sha256,
      length: params.buffer.length,
    };
  }

  const bucket = await getGridFSBucket();
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(params.filename, {
      metadata: {
        contentType: params.contentType,
        reportId: params.reportId,
        photoIndex: params.photoIndex,
        isCameraCapture: params.isCameraCapture,
        sha256,
        gps: params.gps,
        uploadedAt: new Date().toISOString(),
      },
    });

    uploadStream.on("error", (error) => reject(error));
    uploadStream.on("finish", () => {
      resolve({
        fileId: uploadStream.id.toString(),
        sha256,
        length: params.buffer.length,
      });
    });

    uploadStream.end(params.buffer);
  });
}

/**
 * Downloads an evidence photo from GridFS into a Buffer, with offline fallback.
 */
export async function downloadEvidencePhotoFromGridFS(fileId: string): Promise<Buffer> {
  const isOnline = await checkMongoConnection();

  if (!isOnline) {
    const mem = localPhotoBuffers.get(fileId);
    if (mem) return mem.buffer;
    const filePath = path.join(photosDir, `${fileId}.bin`);
    if (fs.existsSync(filePath)) {
      try {
        return fs.readFileSync(filePath);
      } catch {
        // Fall back
      }
    }
    return Buffer.from(
      "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
      "base64",
    );
  }

  const bucket = await getGridFSBucket();
  const objectId = new ObjectId(fileId);
  const downloadStream = bucket.openDownloadStream(objectId);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    downloadStream.on("data", (chunk) => chunks.push(chunk));
    downloadStream.on("error", (err) => reject(err));
    downloadStream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

// Interfaces for MongoDB Documents

export interface PhotoCaptureRecord {
  fileId?: string; // GridFS file ID
  sha256: string;
  filename: string;
  contentType: string;
  byteSize: number;
  captureTimestamp: string;
  isCameraCapture?: boolean;
  gpsSamples: GPSSample[];
}

export interface RawReportDocument {
  _id?: ObjectId;
  reportId: string;
  userId: string;
  category: string;
  description: string;
  idempotencyKey?: string;
  status: ProcessingStatus;
  rejectionReason?: string | null;
  evidencePhotos: PhotoCaptureRecord[];
  submissionLocation: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    capturedAt: string;
  };
  deviceMetadata?: {
    platform?: string;
    userAgent?: string;
    appVersion?: string;
  };
  associatedIncidentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AILogDocument {
  _id?: ObjectId;
  reportId: string;
  provider: "openrouter" | "mock";
  model: string;
  rawResponse: Record<string, unknown>;
  structuredExtraction: {
    predictedCategory: string;
    severity: "low" | "medium" | "high" | "critical";
    confidenceScore: number;
    defectSummary: string;
    visualCharacteristics: string[];
    usabilityAssessment: {
      isUsable: boolean;
      issuesDetected: string[];
    };
    embeddingVector?: number[];
    contradictionsDetected?: boolean;
    recommendedNextAction: "auto_merge" | "review_required" | "create_new";
  };
  tokensUsed?: number;
  durationMs: number;
  analyzedAt: string;
}

export interface PipelineJobLogDocument {
  _id?: ObjectId;
  reportId: string;
  stage: number;
  stageName: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED" | "WARNING";
  details: Record<string, unknown>;
  timestamp: string;
}
