import { createHash } from "crypto";
import { calculateGeodesicDistanceMeters } from "./geo";

/**
 * Server-side image inspection helpers (PRD §7).
 *
 * The client can never be trusted for MIME type, dimensions or capture metadata,
 * so every uploaded bitstream is re-inspected from raw bytes on the server.
 * These helpers intentionally avoid native image decoders so they can run in every
 * deployment target; they validate signatures, structural integrity and dimensions.
 */

export type SupportedImageType = "image/jpeg" | "image/png" | "image/webp";

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface EvidenceInspection {
  sha256: string;
  byteSize: number;
  detectedType: SupportedImageType | null;
  dimensions: ImageDimensions | null;
  isStructurallyComplete: boolean;
  error?: string;
}

export function computeSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Detects the actual content type from magic bytes (never the declared MIME). */
export function detectImageType(buffer: Buffer): SupportedImageType | null {
  if (!buffer || buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }

  return null;
}

export function normalizeMimeType(contentType: string | undefined): string {
  const value = (contentType || "").split(";")[0]?.trim().toLowerCase() || "";
  if (value === "image/jpg" || value === "image/pjpeg") return "image/jpeg";
  return value;
}

/** Reads PNG dimensions from the IHDR chunk. */
function readPngDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 24) return null;
  // Signature (8) + chunk length (4) + "IHDR" (4) + width (4) + height (4)
  if (buffer.toString("ascii", 12, 16) !== "IHDR") return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

/** Reads JPEG dimensions by scanning for a Start-Of-Frame marker. */
function readJpegDimensions(buffer: Buffer): ImageDimensions | null {
  let offset = 2; // skip SOI
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (!marker) return null;

    // Markers without a payload length.
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2) return null;

    // SOF0..SOF15 except DHT (C4), JPG (C8), DAC (CC)
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

    if (isStartOfFrame) {
      if (offset + 9 > buffer.length) return null;
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      if (width <= 0 || height <= 0) return null;
      return { width, height };
    }

    offset += 2 + segmentLength;
  }
  return null;
}

/** Reads WebP dimensions for VP8X / VP8L / VP8 variants. */
function readWebpDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 30) return null;
  const chunk = buffer.toString("ascii", 12, 16);

  if (chunk === "VP8X" && buffer.length >= 30) {
    const width = 1 + (buffer[24]! | (buffer[25]! << 8) | (buffer[26]! << 16));
    const height = 1 + (buffer[27]! | (buffer[28]! << 8) | (buffer[29]! << 16));
    return { width, height };
  }

  if (chunk === "VP8L" && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    const width = 1 + (bits & 0x3fff);
    const height = 1 + ((bits >> 14) & 0x3fff);
    return { width, height };
  }

  if (chunk === "VP8 " && buffer.length >= 30) {
    const start = 20;
    if (buffer[start] === 0x9d && buffer[start + 1] === 0x01 && buffer[start + 2] === 0x2a) {
      const width = buffer.readUInt16LE(start + 3) & 0x3fff;
      const height = buffer.readUInt16LE(start + 5) & 0x3fff;
      return { width, height };
    }
  }

  return null;
}

function isStructurallyComplete(buffer: Buffer, type: SupportedImageType): boolean {
  if (type === "image/jpeg") {
    // JPEG streams must terminate with EOI (FF D9); truncated captures are invalid.
    return (
      buffer.length >= 4 && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9
    );
  }
  if (type === "image/png") {
    // PNG must end with an IEND chunk type.
    return buffer.includes(Buffer.from("IEND", "ascii"));
  }
  // WebP RIFF payload length must agree with the container.
  const declared = buffer.readUInt32LE(4);
  return declared + 8 <= buffer.length;
}

/**
 * Fully inspects a raw evidence bitstream. This is the only trusted source of
 * file type, dimensions and integrity information.
 */
export function inspectEvidenceBuffer(buffer: Buffer | undefined): EvidenceInspection {
  const empty: EvidenceInspection = {
    sha256: "",
    byteSize: 0,
    detectedType: null,
    dimensions: null,
    isStructurallyComplete: false,
  };

  if (!buffer || buffer.length === 0) {
    return { ...empty, error: "Evidence file is empty." };
  }

  const sha256 = computeSha256(buffer);
  const detectedType = detectImageType(buffer);
  if (!detectedType) {
    return {
      sha256,
      byteSize: buffer.length,
      detectedType: null,
      dimensions: null,
      isStructurallyComplete: false,
      error: "Unsupported or corrupted image signature.",
    };
  }

  let dimensions: ImageDimensions | null = null;
  if (detectedType === "image/png") dimensions = readPngDimensions(buffer);
  if (detectedType === "image/jpeg") dimensions = readJpegDimensions(buffer);
  if (detectedType === "image/webp") dimensions = readWebpDimensions(buffer);

  const structurallyComplete = isStructurallyComplete(buffer, detectedType);

  return {
    sha256,
    byteSize: buffer.length,
    detectedType,
    dimensions,
    isStructurallyComplete: structurallyComplete,
    error: !dimensions
      ? "Image dimensions could not be decoded."
      : !structurallyComplete
        ? "Image stream is truncated or structurally incomplete."
        : undefined,
  };
}

export interface RedundancyInput {
  sha256: string;
  byteSize: number;
  width?: number;
  height?: number;
  captureTimestamp: string;
  gpsSamples?: Array<{ latitude: number; longitude: number }>;
}

export interface RedundancyFinding {
  firstIndex: number;
  secondIndex: number;
  type: "exact_duplicate" | "redundant_capture";
  reason: string;
}

export interface RedundancyOptions {
  /** Photos captured within this window are treated as a single burst. */
  burstWindowMs?: number;
  /** Spatial radius (metres) that makes burst photos redundant. */
  sameSpotRadiusMeters?: number;
  /** Byte-size tolerance (fraction) for the redundancy heuristic. */
  sizeToleranceRatio?: number;
}

/**
 * Detects exact duplicate files and highly redundant burst captures. A burst of
 * photos from the same spot within two seconds is not independent evidence
 * (PRD §7: "Near-duplicate or highly redundant photographs").
 */
export function detectRedundantEvidence(
  photos: RedundancyInput[],
  options: RedundancyOptions = {},
): RedundancyFinding[] {
  const burstWindowMs = options.burstWindowMs ?? 2000;
  const sameSpotRadiusMeters = options.sameSpotRadiusMeters ?? 1.5;
  const sizeToleranceRatio = options.sizeToleranceRatio ?? 0.01;
  const findings: RedundancyFinding[] = [];

  for (let i = 0; i < photos.length; i++) {
    for (let j = i + 1; j < photos.length; j++) {
      const a = photos[i];
      const b = photos[j];
      if (!a || !b) continue;

      if (a.sha256 && a.sha256 === b.sha256) {
        findings.push({
          firstIndex: i,
          secondIndex: j,
          type: "exact_duplicate",
          reason: `Photo ${j + 1} is byte-identical to photo ${i + 1}.`,
        });
        continue;
      }

      const sameDimensions =
        a.width !== undefined &&
        a.height !== undefined &&
        a.width === b.width &&
        a.height === b.height;
      if (!sameDimensions) continue;

      const maxSize = Math.max(a.byteSize, b.byteSize, 1);
      const sizeDelta = Math.abs(a.byteSize - b.byteSize) / maxSize;
      if (sizeDelta > sizeToleranceRatio) continue;

      const timeA = new Date(a.captureTimestamp).getTime();
      const timeB = new Date(b.captureTimestamp).getTime();
      if (!Number.isFinite(timeA) || !Number.isFinite(timeB)) continue;
      if (Math.abs(timeA - timeB) > burstWindowMs) continue;

      const gpsA = a.gpsSamples?.[0];
      const gpsB = b.gpsSamples?.[0];
      if (!gpsA || !gpsB) continue;
      const distance = calculateGeodesicDistanceMeters(
        gpsA.latitude,
        gpsA.longitude,
        gpsB.latitude,
        gpsB.longitude,
      );
      if (!Number.isFinite(distance) || distance > sameSpotRadiusMeters) continue;

      findings.push({
        firstIndex: i,
        secondIndex: j,
        type: "redundant_capture",
        reason: `Photo ${j + 1} is a redundant burst capture of photo ${i + 1} (same dimensions, size, timestamp window and location).`,
      });
    }
  }

  return findings;
}
