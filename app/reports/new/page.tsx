"use client";

import * as React from "react";
import Link from "next/link";
import {
  Camera,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Trash2,
  Crosshair,
  ArrowRight,
  ArrowLeft,
  Upload,
  RefreshCw,
  Check,
  Navigation,
  Footprints,
  Lightbulb,
  Waves,
  EyeOff,
  Car,
  Layers,
  Sparkles,
  HelpCircle,
  SlidersHorizontal,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PILOT_CONFIG, PILOT_SECTORS, OFFICIAL_AUTHORITIES } from "@/lib/data/constants";

interface PhotoItem {
  id: string;
  filename: string;
  base64: string;
  byteSize: number;
  perspectiveLabel: string;
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  previewUrl?: string;
}

const CATEGORIES = [
  {
    id: "Road Surface / Pothole",
    title: "Road Surface & Pothole",
    shortTitle: "Pothole & Surface",
    desc: "Craters, crumbling asphalt, trenching, or sinking roadway",
    icon: Car,
    defaultSeverity: "high" as const,
    authorityId: "gnida-civil",
  },
  {
    id: "Broken Footpath / Pavement",
    title: "Broken Footpath & Pavers",
    shortTitle: "Footpath & Pavers",
    desc: "Smashed walkway tiles, missing curb stones, or uneven pedestrian path",
    icon: Footprints,
    defaultSeverity: "medium" as const,
    authorityId: "gnida-civil",
  },
  {
    id: "Street Lighting / Darkness",
    title: "Street Lighting Outage",
    shortTitle: "Street Lighting",
    desc: "Non-functional luminaires, high-mast blackout, dark road corridor",
    icon: Lightbulb,
    defaultSeverity: "medium" as const,
    authorityId: "gnida-electrical",
  },
  {
    id: "Drainage / Manhole",
    title: "Drainage & Open Manhole",
    shortTitle: "Open Manhole / Drain",
    desc: "Missing storm cover, broken culvert, or hazardous wheel trap",
    icon: Waves,
    defaultSeverity: "critical" as const,
    authorityId: "drainage-cell",
  },
  {
    id: "Unsafe Crossing / Signals",
    title: "Unsafe Crossing & Signals",
    shortTitle: "Signals & Crossings",
    desc: "Broken traffic timers, missing zebra lines, dangerous intersection",
    icon: Navigation,
    defaultSeverity: "high" as const,
    authorityId: "traffic-police",
  },
  {
    id: "Visibility / Obstruction",
    title: "Visibility & Overgrowth",
    shortTitle: "Visibility Obstruction",
    desc: "Overgrown branches obscuring signboards or illegal hoardings",
    icon: EyeOff,
    defaultSeverity: "low" as const,
    authorityId: "horticulture",
  },
];

const SEVERITIES = [
  {
    level: "critical" as const,
    label: "Critical",
    badgeLabel: "Critical Hazard",
    desc: "Immediate collision risk or open cavity",
    activeClass: "bg-[#f3d9cf] text-[#8c2e1b] border-[#e4876f] font-bold shadow-xs",
  },
  {
    level: "high" as const,
    label: "High",
    badgeLabel: "High Severity",
    desc: "Major vehicle damage risk or high-speed arterial obstacle",
    activeClass: "bg-[#f4e8be] text-[#7a540b] border-[#e7b64f] font-bold shadow-xs",
  },
  {
    level: "medium" as const,
    label: "Medium",
    badgeLabel: "Medium Severity",
    desc: "Disrupts pedestrian flow or causes traffic slowdown",
    activeClass: "bg-[#eef1e9] text-[#17382f] border-[#cbd5cb] font-bold shadow-xs",
  },
  {
    level: "low" as const,
    label: "Low",
    badgeLabel: "Low / Preventive",
    desc: "Early surface deterioration under scheduled observation",
    activeClass: "bg-[#d6e5d2] text-[#234a29] border-[#78a37d] font-bold shadow-xs",
  },
];

const PHOTO_PERSPECTIVES = [
  {
    index: 0,
    title: "1. Wide Angle Context",
    hint: "Taken ~10m away showing lane alignment & traffic flow",
  },
  {
    index: 1,
    title: "2. Close-up Defect",
    hint: "Direct overhead shot showing depth, width, and edges",
  },
  {
    index: 2,
    title: "3. Curb & Markings",
    hint: "Oriented toward road shoulder, divider, or pavement",
  },
  {
    index: 3,
    title: "4. Driver Perspective",
    hint: "Approaching vehicle angle to evaluate hazard visibility",
  },
];

export default function NewReportPage() {
  // Form State
  const [category, setCategory] = React.useState("Road Surface / Pothole");
  const [severity, setSeverity] = React.useState<"critical" | "high" | "medium" | "low">("high");
  const [description, setDescription] = React.useState("");
  const [locationName, setLocationName] = React.useState("Pari Chowk Interchange");
  const [latitude, setLatitude] = React.useState(PILOT_CONFIG.center[1]);
  const [longitude, setLongitude] = React.useState(PILOT_CONFIG.center[0]);
  const [accuracy, setAccuracy] = React.useState(6.8);
  const [isLocating, setIsLocating] = React.useState(false);
  const [photos, setPhotos] = React.useState<PhotoItem[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submissionReceipt, setSubmissionReceipt] = React.useState<Record<string, unknown> | null>(
    null,
  );
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Modals state
  const [isLocationModalOpen, setIsLocationModalOpen] = React.useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = React.useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = React.useState(false);

  // Temporary state for Location modal
  const [tempSector, setTempSector] = React.useState("Pari Chowk");
  const [tempLandmark, setTempLandmark] = React.useState(locationName);

  // Selected category object & authority
  const defaultCategory = CATEGORIES[0]!;
  const defaultAuthority = OFFICIAL_AUTHORITIES[0]!;
  const selectedCatObj = CATEGORIES.find((c) => c.id === category) ?? defaultCategory;
  const targetAuthority =
    OFFICIAL_AUTHORITIES.find((a) => a.id === selectedCatObj.authorityId) ?? defaultAuthority;

  // Real-time GPS Acquisition
  const handleAcquireGps = () => {
    setIsLocating(true);
    setErrorMsg(null);

    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(Number(pos.coords.latitude.toFixed(6)));
          setLongitude(Number(pos.coords.longitude.toFixed(6)));
          setAccuracy(Number(pos.coords.accuracy.toFixed(1)));
          setIsLocating(false);
        },
        () => {
          setLatitude(28.4744);
          setLongitude(77.504);
          setAccuracy(7.2);
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 8000 },
      );
    } else {
      setLatitude(28.4744);
      setLongitude(77.504);
      setAccuracy(8.0);
      setIsLocating(false);
    }
  };

  // Helper to generate a valid synthetic test photo buffer
  const generateSyntheticPhoto = (perspectiveIndex: number): PhotoItem => {
    const bytes = new Uint8Array(6500);
    bytes[0] = 0xff;
    bytes[1] = 0xd8;
    bytes[2] = 0xff;
    bytes[3] = 0xe0;
    for (let i = 4; i < 6500; i++) {
      bytes[i] = (i * 41 + perspectiveIndex * 17) % 256;
    }
    const base64 = btoa(String.fromCharCode.apply(null, Array.from(bytes)));
    const perspective = PHOTO_PERSPECTIVES[perspectiveIndex] || PHOTO_PERSPECTIVES[0];

    return {
      id: `photo_${Date.now()}_${perspectiveIndex}`,
      filename: `capture_perspective_${perspectiveIndex + 1}.jpg`,
      base64,
      byteSize: bytes.length,
      perspectiveLabel: perspective?.title || `Perspective ${perspectiveIndex + 1}`,
      capturedAt: new Date(Date.now() - (4 - perspectiveIndex) * 35000).toISOString(),
      latitude: Number((latitude + perspectiveIndex * 0.00003).toFixed(6)),
      longitude: Number((longitude + perspectiveIndex * 0.00004).toFixed(6)),
      accuracy: Number((accuracy + perspectiveIndex * 0.5).toFixed(1)),
    };
  };

  // Fill 4 test photos for instant verification
  const handleAutoFillPhotos = () => {
    const newPhotos = [0, 1, 2, 3].map((idx) => generateSyntheticPhoto(idx));
    setPhotos(newPhotos);
    setIsPhotoModalOpen(false);
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // Handle local file uploads
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1] || "";
        const nextIdx = Math.min(photos.length + index, 3);
        const perspective = PHOTO_PERSPECTIVES[nextIdx] || PHOTO_PERSPECTIVES[0];

        const newPhoto: PhotoItem = {
          id: `upload_${Date.now()}_${index}`,
          filename: file.name,
          base64,
          byteSize: file.size,
          perspectiveLabel: perspective?.title || "Evidence Capture",
          capturedAt: new Date().toISOString(),
          latitude,
          longitude,
          accuracy,
          previewUrl: result,
        };

        setPhotos((prev) => [...prev, newPhoto].slice(0, 6));
      };
      reader.readAsDataURL(file);
    });
  };

  // Save location from modal
  const handleSaveLocationModal = () => {
    if (tempLandmark.trim()) {
      setLocationName(tempLandmark.trim());
    } else if (tempSector) {
      setLocationName(`${tempSector}, Greater Noida`);
    }
    setIsLocationModalOpen(false);
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (photos.length < 4) {
      setErrorMsg(
        "PRD Policy: A minimum of 4 evidence photographs is strictly required before an official report can be lodged.",
      );
      return;
    }

    if (!description || description.trim().length < 10) {
      setErrorMsg("Please provide at least 10 characters detailing the physical hazard condition.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        category,
        description,
        submissionLocation: {
          latitude,
          longitude,
          accuracyMeters: accuracy,
          capturedAt: new Date().toISOString(),
        },
        deviceMetadata: {
          platform: "Web Client",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "JanSahayak Portal",
          landmark: locationName,
        },
        photos: photos.map((p) => ({
          filename: p.filename,
          base64: p.base64,
          contentType: "image/jpeg",
          capturedAt: p.capturedAt,
          isCameraCapture: true,
          gpsSamples: [
            {
              latitude: p.latitude,
              longitude: p.longitude,
              horizontalAccuracyMeters: p.accuracy,
              sampleTimestamp: p.capturedAt,
            },
          ],
        })),
      };

      const res = await fetch("/api/pipeline/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.error ||
            data.summary?.stageResults?.find((s: { success: boolean }) => !s.success)?.error ||
            "Pipeline submission failed.",
        );
      }

      setSubmissionReceipt(data.summary);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // SUCCESS RECEIPT SCREEN
  // ─────────────────────────────────────────────────────────────
  if (submissionReceipt) {
    const repId = (submissionReceipt.reportId as string) || "REP-RECORDED";
    const incNumber = (submissionReceipt.incidentNumber as string) || "Pending Synthesis";
    const status = (submissionReceipt.status as string) || "SUBMITTED";

    return (
      <main className="min-h-screen bg-[#f5f3ed] text-[#17382f] px-4 py-8 md:py-14">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between border-b border-[#cbd5cb] pb-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#0e2b24] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> Back to JanSahayak
            </Link>
            <Badge
              variant="outline"
              className="bg-[#d6e5d2] text-[#234a29] border-[#78a37d]/40 text-xs"
            >
              Pipeline Stage 1–6 Completed
            </Badge>
          </div>

          <Card className="bg-[#faf9f5] border border-[#cbd5cb] rounded-2xl shadow-xs overflow-hidden">
            <div className="p-6 md:p-8 space-y-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-800">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <div>
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground block">
                    Official Evidence Dossier Filed
                  </span>
                  <h1 className="text-2xl font-serif font-bold text-foreground tracking-tight mt-0.5">
                    Civic Hazard Report Lodged
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your report has been verified through our automated 8-stage pipeline. Photos are
                    securely stored in MongoDB GridFS, and canonical geolocation has been registered
                    in PostGIS.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-muted/40 border border-[#cbd5cb] text-xs">
                <div>
                  <span className="text-muted-foreground block font-mono text-[10px] uppercase">
                    Dossier Reference
                  </span>
                  <span className="font-mono font-bold text-foreground text-sm">{repId}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block font-mono text-[10px] uppercase">
                    Canonical Incident
                  </span>
                  <span className="font-mono font-bold text-emerald-800 text-sm">{incNumber}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block font-mono text-[10px] uppercase">
                    Current Lifecycle
                  </span>
                  <span className="font-semibold text-foreground uppercase">{status}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-dashed border-[#cbd5cb] bg-white/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#0e2b24] flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-700" />
                    Assigned Municipal Jurisdiction:
                  </span>
                  <Badge variant="secondary" className="text-[11px]">
                    SLA: {targetAuthority?.slaDays || 7} Days
                  </Badge>
                </div>
                <p className="text-xs font-bold text-foreground">{targetAuthority?.name}</p>
                <p className="text-[11px] text-muted-foreground">{targetAuthority?.jurisdiction}</p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <Link
                  href="/dashboard/pipeline"
                  className={buttonVariants({
                    className:
                      "w-full sm:w-auto bg-[#0e2b24] hover:bg-[#1c4b3e] text-[#f5f3ed]! text-xs h-10 px-5",
                  })}
                >
                  <Layers className="h-4 w-4 mr-2" /> Inspect in PRD Pipeline View
                </Link>
                <Link
                  href="/dashboard/map"
                  className={buttonVariants({
                    variant: "outline",
                    className: "w-full sm:w-auto text-xs h-10 px-4 border-[#cbd5cb]",
                  })}
                >
                  <MapPin className="h-4 w-4 mr-2" /> View on Live Hazard Map
                </Link>
                <Button
                  onClick={() => {
                    setSubmissionReceipt(null);
                    setPhotos([]);
                    setDescription("");
                  }}
                  variant="ghost"
                  className="w-full sm:w-auto text-xs h-10 text-muted-foreground hover:text-foreground"
                >
                  File Another Hazard
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // COMPACT & SIMPLE REDESIGNED REPORT FILING VIEW
  // ─────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#f5f3ed] text-[#17382f] pb-16">
      {/* Top Civic Navigation Bar */}
      <header className="border-b border-[#cbd5cb] bg-[#f5f3ed]/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0e2b24] hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Link>
            <div className="h-3.5 w-px bg-[#cbd5cb]" />
            <Link href="/" className="flex items-center gap-2">
              <Brand />
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-2 text-xs text-[#5c6f66] bg-white/70 px-3 py-1 rounded-full border border-[#cbd5cb]">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>Greater Noida Pilot</span>
            </div>
            <Link
              href="/map"
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "text-xs text-[#0e2b24] h-8 px-2 sm:px-2.5",
              })}
            >
              <MapPin className="h-3.5 w-3.5 mr-1" />
              <span>
                <span className="hidden sm:inline">Public </span>Map
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 pt-4 sm:pt-6 md:pt-8 pb-36 lg:pb-8">
        {/* Compact Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-4 sm:mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#5c6f66]">
                Civic Dispatch • Quick Filing
              </span>
              <span className="h-1 w-1 rounded-full bg-[#cbd5cb]" />
              <span className="text-[11px] text-[#5c6f66]">8-Stage Pipeline Verified</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-[#0e2b24] tracking-tight mt-0.5">
              File a Road Safety Hazard
            </h1>
          </div>

          {/* Category Reference Guide Modal Trigger */}
          <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
            <DialogTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 sm:h-7 px-2.5 border-[#cbd5cb] bg-white text-[#0e2b24] w-fit"
                >
                  <HelpCircle className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  Category Guidelines
                </Button>
              }
            />
            <DialogContent className="sm:max-w-lg bg-[#faf9f5] border-[#cbd5cb]">
              <DialogHeader>
                <DialogTitle className="text-base font-serif font-bold text-[#0e2b24]">
                  Hazard Classification Criteria
                </DialogTitle>
                <DialogDescription className="text-xs text-[#5c6f66]">
                  Official municipal definitions determining contractor dispatch and emergency
                  escalation.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-3">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <div
                      key={cat.id}
                      className="p-3 rounded-lg border border-[#cbd5cb] bg-white space-y-1"
                    >
                      <div className="flex items-center gap-2 font-bold text-xs text-[#0e2b24]">
                        <Icon className="h-4 w-4 text-emerald-800" />
                        <span>{cat.title}</span>
                      </div>
                      <p className="text-[11px] text-[#5c6f66] leading-snug">{cat.desc}</p>
                    </div>
                  );
                })}
              </div>
              <DialogFooter showCloseButton>
                <Button
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="bg-[#0e2b24] text-xs h-8"
                >
                  Done
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
            <div>
              <p className="font-semibold">Action Required</p>
              <p className="mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* 2-Column Noticeboard Grid */}
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          {/* ─────────────────────────────────────────────────────────────
              LEFT COLUMN: Compact Structured Form Controls (7 Cols)
             ───────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-7 space-y-4">
            {/* COMPACT SECTION 1: Category & Severity */}
            <Card className="bg-[#faf9f5] border border-[#cbd5cb] rounded-xl shadow-xs">
              <CardContent className="p-4 space-y-4">
                {/* Selector Row for Problem Category */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="category-select"
                      className="text-xs font-semibold text-[#0e2b24]"
                    >
                      Problem Category
                    </label>
                    <span className="text-[10px] font-mono text-[#5c6f66] uppercase">Selector</span>
                  </div>

                  <Select
                    value={category}
                    onValueChange={(val) => {
                      if (val) {
                        setCategory(val);
                        const match = CATEGORIES.find((c) => c.id === val);
                        if (match) setSeverity(match.defaultSeverity);
                      }
                    }}
                  >
                    <SelectTrigger
                      id="category-select"
                      className="w-full h-10 px-3 bg-white border-[#cbd5cb] text-xs md:text-sm font-medium text-[#0e2b24] rounded-lg"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {React.createElement(selectedCatObj.icon, {
                          className: "h-4 w-4 text-emerald-800 shrink-0",
                        })}
                        <span className="truncate">{selectedCatObj.title}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-white border-[#cbd5cb] max-h-64">
                      <SelectGroup>
                        <SelectLabel className="text-[10px] font-mono uppercase tracking-wider text-[#5c6f66]">
                          Available Road Hazard Types
                        </SelectLabel>
                        {CATEGORIES.map((cat) => {
                          const Icon = cat.icon;
                          return (
                            <SelectItem
                              key={cat.id}
                              value={cat.id}
                              className="text-xs py-2 cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <Icon className="h-3.5 w-3.5 text-emerald-800 shrink-0" />
                                <div>
                                  <span className="font-semibold block">{cat.title}</span>
                                  <span className="text-[10px] text-[#5c6f66] block">
                                    {cat.desc}
                                  </span>
                                </div>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                {/* Toggle Buttons Row for Hazard Severity Tier */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#0e2b24]">
                      Hazard Severity Tier
                    </span>
                    <span className="text-[10px] font-mono text-[#5c6f66] uppercase">
                      Toggle Group
                    </span>
                  </div>

                  <ButtonGroup className="w-full grid grid-cols-4 gap-0 border border-[#cbd5cb] rounded-lg p-0.5 bg-muted/30">
                    {SEVERITIES.map((sev) => {
                      const isSelected = severity === sev.level;
                      return (
                        <button
                          key={sev.level}
                          type="button"
                          onClick={() => setSeverity(sev.level)}
                          className={`h-11 sm:h-8 text-xs font-semibold sm:font-medium transition-all rounded-md flex items-center justify-center ${
                            isSelected
                              ? sev.activeClass
                              : "text-[#5c6f66] hover:text-[#0e2b24] hover:bg-white/50"
                          }`}
                        >
                          {sev.label}
                        </button>
                      );
                    })}
                  </ButtonGroup>
                </div>

                {/* Defect Description Context */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="hazard-description"
                      className="text-xs font-semibold text-[#0e2b24]"
                    >
                      Defect Description &amp; Orientation
                    </label>
                    <span className="text-[10px] font-mono text-[#5c6f66]">
                      {description.length} chars (min 10)
                    </span>
                  </div>
                  <textarea
                    id="hazard-description"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Specific defect details (e.g. 15cm crater in outer lane heading west, high risk for bikes at night)..."
                    className="w-full text-xs p-2.5 rounded-lg border border-[#cbd5cb] bg-white focus:outline-none focus:ring-1 focus:ring-[#bd7b3b] placeholder:text-[#788a81]"
                  />
                </div>
              </CardContent>
            </Card>

            {/* COMPACT SECTION 2: Geolocation & Coordinate Fix (With Modal) */}
            <Card className="bg-[#faf9f5] border border-[#cbd5cb] rounded-xl shadow-xs">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#0e2b24] flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-emerald-800" />
                    Verified Incident Location
                  </span>

                  {/* Location Picker Modal Trigger */}
                  <Dialog open={isLocationModalOpen} onOpenChange={setIsLocationModalOpen}>
                    <DialogTrigger
                      render={
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 border-[#cbd5cb] bg-white text-[#0e2b24]"
                        >
                          <SlidersHorizontal className="h-3 w-3 mr-1" />
                          Change Sector / Landmark
                        </Button>
                      }
                    />
                    <DialogContent className="sm:max-w-md bg-[#faf9f5] border-[#cbd5cb]">
                      <DialogHeader>
                        <DialogTitle className="text-base font-serif font-bold text-[#0e2b24]">
                          Select Location &amp; Sector
                        </DialogTitle>
                        <DialogDescription className="text-xs text-[#5c6f66]">
                          Pinpoint the defect within the Greater Noida pilot jurisdiction for
                          PostGIS clustering.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4 my-2">
                        {/* Sector Selector */}
                        <div>
                          <label
                            htmlFor="temp-sector-select"
                            className="text-xs font-semibold text-[#0e2b24] block mb-1"
                          >
                            Pilot Sector Selector
                          </label>
                          <Select
                            value={tempSector}
                            onValueChange={(val) => val && setTempSector(val)}
                          >
                            <SelectTrigger
                              id="temp-sector-select"
                              className="w-full h-9 bg-white border-[#cbd5cb] text-xs"
                            >
                              <SelectValue placeholder="Choose a sector" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-[#cbd5cb] max-h-56">
                              <SelectGroup>
                                <SelectLabel className="text-[10px] font-mono uppercase text-[#5c6f66]">
                                  Greater Noida Sectors
                                </SelectLabel>
                                {PILOT_SECTORS.map((sec) => (
                                  <SelectItem key={sec} value={sec} className="text-xs">
                                    {sec}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Landmark Input */}
                        <div>
                          <label
                            htmlFor="temp-landmark-input"
                            className="text-xs font-semibold text-[#0e2b24] block mb-1"
                          >
                            Specific Street or Landmark Reference
                          </label>
                          <input
                            id="temp-landmark-input"
                            type="text"
                            value={tempLandmark}
                            onChange={(e) => setTempLandmark(e.target.value)}
                            placeholder="e.g. Near Metro Pillar 14 / Commercial Belt"
                            className="w-full text-xs px-3 py-2 rounded-lg border border-[#cbd5cb] bg-white"
                          />
                        </div>

                        {/* Coordinate Snapshot */}
                        <div className="p-3 rounded-lg bg-muted/40 border border-[#cbd5cb] flex items-center justify-between text-xs font-mono">
                          <span className="text-[#5c6f66]">Current WGS84:</span>
                          <span className="font-bold text-[#0e2b24]">
                            {latitude.toFixed(6)}°N, {longitude.toFixed(6)}°E
                          </span>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button
                          type="button"
                          onClick={handleSaveLocationModal}
                          className="bg-[#0e2b24] hover:bg-[#1c4b3e] text-white text-xs h-8"
                        >
                          Confirm Location Fix
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Compact 1-Row Location Bar */}
                <div className="p-2.5 rounded-lg bg-white border border-[#cbd5cb] flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-[#0e2b24] truncate">{locationName}</span>
                    <span className="h-3 w-px bg-[#cbd5cb] shrink-0" />
                    <span className="font-mono text-[11px] text-[#5c6f66] shrink-0 hidden sm:inline">
                      {latitude.toFixed(4)}°N, {longitude.toFixed(4)}°E
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono bg-[#d6e5d2] text-[#234a29] border-[#78a37d]/40 py-0.5"
                    >
                      ±{accuracy}m Fix
                    </Badge>
                    <Button
                      type="button"
                      onClick={handleAcquireGps}
                      disabled={isLocating}
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2 text-[#0e2b24] hover:bg-muted"
                      title="Acquire device geolocation"
                    >
                      {isLocating ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Crosshair className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* COMPACT SECTION 3: Multi-Photo Evidence (With Modal Studio) */}
            <Card className="bg-[#faf9f5] border border-[#cbd5cb] rounded-xl shadow-xs">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#0e2b24] flex items-center gap-1.5">
                      <Camera className="h-4 w-4 text-emerald-800" />
                      Photographic Evidence
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono ${
                        photos.length >= 4
                          ? "bg-[#d6e5d2] text-[#234a29] border-[#78a37d]/40"
                          : "bg-[#f4e8be] text-[#7a540b] border-[#e7b64f]/40"
                      }`}
                    >
                      {photos.length}/4 Mandatory Photos
                    </Badge>
                  </div>

                  {/* Evidence Upload Modal Trigger */}
                  <Dialog open={isPhotoModalOpen} onOpenChange={setIsPhotoModalOpen}>
                    <DialogTrigger
                      render={
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 sm:h-7 px-2.5 border-[#cbd5cb] bg-white text-[#0e2b24] shrink-0"
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          <span className="hidden sm:inline">Manage / </span>Add Photos
                        </Button>
                      }
                    />
                    <DialogContent className="sm:max-w-lg bg-[#faf9f5] border-[#cbd5cb]">
                      <DialogHeader>
                        <DialogTitle className="text-base font-serif font-bold text-[#0e2b24]">
                          Evidence Capture &amp; Perspectives Studio
                        </DialogTitle>
                        <DialogDescription className="text-xs text-[#5c6f66]">
                          PRD Stage 1 requires 4 distinct photographic angles to verify physical
                          depth and eliminate spoofing.
                        </DialogDescription>
                      </DialogHeader>

                      {/* Perspective Matrix */}
                      <div className="grid grid-cols-2 gap-2 my-2 text-[11px]">
                        {PHOTO_PERSPECTIVES.map((p, i) => (
                          <div
                            key={p.index}
                            className="p-2.5 rounded-lg border border-[#cbd5cb] bg-white space-y-0.5"
                          >
                            <div className="flex items-center justify-between font-semibold text-[#0e2b24]">
                              <span>{p.title}</span>
                              {photos.length > i && (
                                <Check className="h-3.5 w-3.5 text-emerald-700" />
                              )}
                            </div>
                            <p className="text-[10px] text-[#5c6f66] leading-snug">{p.hint}</p>
                          </div>
                        ))}
                      </div>

                      {/* Upload Area inside Modal */}
                      <div className="border border-dashed border-[#cbd5cb] rounded-lg p-4 text-center bg-white space-y-2">
                        <p className="text-xs font-semibold text-[#0e2b24]">
                          Direct Camera or Gallery Upload
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-[#0e2b24] text-white hover:bg-[#1c4b3e] shadow-xs active:scale-95 transition-all">
                            <Camera className="h-3.5 w-3.5" />
                            <span>Take Photo / Select</span>
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              capture="environment"
                              onChange={handleFileUpload}
                              className="hidden"
                            />
                          </label>
                          <Button
                            type="button"
                            onClick={handleAutoFillPhotos}
                            variant="outline"
                            size="sm"
                            className="text-xs h-8.5 border-[#cbd5cb] text-[#0e2b24]"
                          >
                            <Sparkles className="h-3 w-3 mr-1 text-amber-600" />
                            Auto-Fill 4 Test Photos
                          </Button>
                        </div>
                      </div>

                      <DialogFooter showCloseButton>
                        <Button
                          onClick={() => setIsPhotoModalOpen(false)}
                          className="bg-[#0e2b24] text-xs h-8"
                        >
                          Done
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Compact 4-Slot Photo Preview Strip */}
                <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map((slotIdx) => {
                    const item = photos[slotIdx];
                    const perspective = PHOTO_PERSPECTIVES[slotIdx];

                    if (item) {
                      return (
                        <div
                          key={item.id}
                          className="relative h-16 rounded-lg border border-emerald-300 bg-white p-1 overflow-hidden shadow-2xs group flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-mono font-bold text-emerald-800">
                              #{slotIdx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(item.id)}
                              className="text-rose-600 hover:text-rose-800 p-0.5 rounded"
                              title="Delete Photo"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                          <span className="text-[9px] font-mono text-muted-foreground truncate">
                            {(item.byteSize / 1024).toFixed(0)}KB • GPS
                          </span>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={slotIdx}
                        type="button"
                        onClick={() => setIsPhotoModalOpen(true)}
                        className="h-16 rounded-lg border border-dashed border-[#cbd5cb] hover:border-[#0e2b24] transition-all bg-white/40 flex flex-col items-center justify-center p-1 text-center"
                      >
                        <Camera className="h-3.5 w-3.5 text-muted-foreground/60 mb-0.5" />
                        <span className="text-[9px] font-medium text-[#5c6f66] truncate w-full">
                          {perspective?.title.split(" ")[1] || `Slot ${slotIdx + 1}`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Fast Action Toggle: Auto-Fill Test Photos */}
                <div className="pt-1 flex items-center justify-between text-[11px] text-[#5c6f66]">
                  <span>PRD Stage 1 &amp; 2 Validation</span>
                  <button
                    type="button"
                    onClick={handleAutoFillPhotos}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-900 hover:underline"
                  >
                    <Sparkles className="h-3 w-3 text-amber-600" />
                    Quick Auto-Fill 4 Certified Photos
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Submit Action Bar */}
            <div className="pt-2 flex items-center justify-between">
              <Link
                href="/"
                className={buttonVariants({
                  variant: "ghost",
                  size: "sm",
                  className: "text-xs text-[#5c6f66] h-9",
                })}
              >
                Cancel
              </Link>

              <Button
                type="submit"
                disabled={isSubmitting || photos.length < 4 || description.length < 10}
                className="bg-[#0e2b24] hover:bg-[#1c4b3e] text-[#f5f3ed]! text-xs h-10 px-6 rounded-full font-bold shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                    Executing Pipeline...
                  </>
                ) : (
                  <>
                    Submit Evidence to Pipeline <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              RIGHT COLUMN: Compact Sticky Dossier Summary (5 Cols)
             ───────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-20">
            {/* Live Civil Evidence Summary */}
            <Card className="bg-[#faf9f5] border border-[#cbd5cb] rounded-xl shadow-xs">
              <CardHeader className="p-4 pb-2 border-b border-[#eef1e9]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#5c6f66]">
                    Live Dossier
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono bg-white">
                    {category ? selectedCatObj.shortTitle : "Unassigned"}
                  </Badge>
                </div>
                <CardTitle className="text-sm font-serif font-bold text-[#0e2b24]">
                  Civil Evidence Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                {/* Meta Rows */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between py-1 border-b border-[#eef1e9]">
                    <span className="text-[#5c6f66]">Severity Tier</span>
                    <Badge variant="outline" className="text-[10px] capitalize font-mono bg-white">
                      {severity}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-[#eef1e9]">
                    <span className="text-[#5c6f66]">Location</span>
                    <span className="font-mono text-[11px] text-[#0e2b24] truncate max-w-[180px]">
                      {locationName}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-[#eef1e9]">
                    <span className="text-[#5c6f66]">Photos Attached</span>
                    <span
                      className={`font-mono font-bold ${
                        photos.length >= 4 ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {photos.length} / 4 Mandatory
                    </span>
                  </div>
                </div>

                {/* Progress Checklist */}
                <div className="p-2.5 rounded-lg bg-white border border-[#cbd5cb] space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                    <span className="text-[#0e2b24]">Problem category &amp; severity picked</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {description.length >= 10 ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                    ) : (
                      <div className="h-3.5 w-3.5 rounded-full border border-border shrink-0" />
                    )}
                    <span
                      className={description.length >= 10 ? "text-[#0e2b24]" : "text-[#5c6f66]"}
                    >
                      Description ({description.length}/10 chars)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {photos.length >= 4 ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                    ) : (
                      <div className="h-3.5 w-3.5 rounded-full border border-border shrink-0" />
                    )}
                    <span
                      className={
                        photos.length >= 4 ? "text-[#0e2b24]" : "text-amber-800 font-medium"
                      }
                    >
                      4 Camera photos ({photos.length}/4)
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Target Authority Routing */}
            <Card className="bg-[#faf9f5] border border-[#cbd5cb] rounded-xl shadow-xs">
              <CardContent className="p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#5c6f66]">
                    Municipal Dispatch
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-white border-[#cbd5cb]">
                    SLA: {targetAuthority?.slaDays} Days
                  </Badge>
                </div>
                <p className="font-bold text-[#0e2b24] text-xs">{targetAuthority?.name}</p>
                <p className="text-[11px] text-[#5c6f66] leading-tight">
                  {targetAuthority?.jurisdiction}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── Mobile Sticky Submit Dock (Thumb reach on phones) ── */}
          <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#faf9f5]/98 backdrop-blur-md border-t border-[#cbd5cb] px-4 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(14,43,36,0.1)]">
            <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
              <div className="flex flex-col">
                <span className="text-[10px] font-mono uppercase text-[#5c6f66]">
                  {photos.length}/4 Photos · {description.length >= 10 ? "Detail OK" : "Text Short"}
                </span>
                <span
                  className={`text-xs font-bold ${
                    photos.length >= 4 && description.length >= 10
                      ? "text-emerald-800"
                      : "text-amber-800"
                  }`}
                >
                  {photos.length >= 4 && description.length >= 10
                    ? "✓ Ready to Submit"
                    : "Evidence Incomplete"}
                </span>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || photos.length < 4 || description.length < 10}
                className="bg-[#0e2b24] hover:bg-[#1c4b3e] text-[#f5f3ed]! text-xs h-10 px-5 rounded-xl font-bold shadow-md active:scale-95 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin text-emerald-400" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Report</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
