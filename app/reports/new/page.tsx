"use client";

import * as React from "react";
import Link from "next/link";
import {
  Camera,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Crosshair,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  SlidersHorizontal,
  Car,
  Footprints,
  Lightbulb,
  Waves,
  Navigation,
  EyeOff,
  Building2,
  Clock,
  ImageIcon,
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
} from "@/components/ui/select";
import { PILOT_CONFIG, PILOT_SECTORS, OFFICIAL_AUTHORITIES } from "@/lib/data/constants";

interface PhotoItem {
  id: string;
  filename: string;
  base64: string;
  byteSize: number;
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  previewUrl: string;
}

const CATEGORIES = [
  {
    id: "Road Surface / Pothole",
    title: "Pothole & Surface Damage",
    shortTitle: "Pothole",
    desc: "Craters, cracking asphalt, sinking road, or loose gravel",
    icon: Car,
    defaultSeverity: "high" as const,
    authorityId: "gnida-civil",
  },
  {
    id: "Broken Footpath / Pavement",
    title: "Broken Footpath & Walkway",
    shortTitle: "Footpath",
    desc: "Broken walkway slabs, missing curb stones, or blocked pedestrian path",
    icon: Footprints,
    defaultSeverity: "medium" as const,
    authorityId: "gnida-civil",
  },
  {
    id: "Street Lighting / Darkness",
    title: "Street Light Outage",
    shortTitle: "Street Light",
    desc: "Lights not working, broken pole, or dark stretch of road",
    icon: Lightbulb,
    defaultSeverity: "medium" as const,
    authorityId: "gnida-electrical",
  },
  {
    id: "Drainage / Manhole",
    title: "Open Manhole & Drainage",
    shortTitle: "Manhole / Drain",
    desc: "Missing drain cover, broken culvert, or hazardous open hole",
    icon: Waves,
    defaultSeverity: "critical" as const,
    authorityId: "drainage-cell",
  },
  {
    id: "Unsafe Crossing / Signals",
    title: "Traffic Signal & Crossing",
    shortTitle: "Signals & Crossing",
    desc: "Defective signal timer, faded zebra crossing, or hazardous intersection",
    icon: Navigation,
    defaultSeverity: "high" as const,
    authorityId: "traffic-police",
  },
  {
    id: "Visibility / Obstruction",
    title: "Blocked Visibility & Trees",
    shortTitle: "Visibility",
    desc: "Overgrown tree branches blocking road signs or illegal boards",
    icon: EyeOff,
    defaultSeverity: "low" as const,
    authorityId: "horticulture",
  },
];

const SEVERITIES = [
  {
    level: "critical" as const,
    label: "Critical",
    badgeLabel: "Critical Emergency",
    desc: "Immediate accident risk (e.g. open manhole, fallen wire)",
    activeClass: "bg-rose-100 text-rose-900 border-rose-300 font-semibold shadow-xs",
  },
  {
    level: "high" as const,
    label: "High",
    badgeLabel: "High Urgency",
    desc: "Vehicle damage or severe safety hazard on fast lane",
    activeClass: "bg-amber-100 text-amber-900 border-amber-300 font-semibold shadow-xs",
  },
  {
    level: "medium" as const,
    label: "Medium",
    badgeLabel: "Moderate",
    desc: "Disrupts traffic flow or pedestrian movement",
    activeClass: "bg-[#eef1e9] text-[#17382f] border-[#cbd5cb] font-semibold shadow-xs",
  },
  {
    level: "low" as const,
    label: "Low",
    badgeLabel: "Minor / Observation",
    desc: "Early surface wear or non-urgent repair",
    activeClass: "bg-emerald-100 text-emerald-900 border-emerald-300 font-semibold shadow-xs",
  },
];

export default function NewReportPage() {
  // Form State
  const [category, setCategory] = React.useState("Road Surface / Pothole");
  const [severity, setSeverity] = React.useState<"critical" | "high" | "medium" | "low">("high");
  const [description, setDescription] = React.useState("");
  const [locationName, setLocationName] = React.useState("Pari Chowk, Greater Noida");
  const [latitude, setLatitude] = React.useState(PILOT_CONFIG.center[1]);
  const [longitude, setLongitude] = React.useState(PILOT_CONFIG.center[0]);
  const [accuracy, setAccuracy] = React.useState(6.8);
  const [isLocating, setIsLocating] = React.useState(false);
  const [locationNotice, setLocationNotice] = React.useState<string | null>(null);
  const [photos, setPhotos] = React.useState<PhotoItem[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submissionReceipt, setSubmissionReceipt] = React.useState<Record<string, unknown> | null>(
    null,
  );
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Modals state
  const [isLocationModalOpen, setIsLocationModalOpen] = React.useState(false);

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
    setLocationNotice(null);

    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          const acc = Number(pos.coords.accuracy.toFixed(1));
          setLatitude(lat);
          setLongitude(lng);
          setAccuracy(acc);
          setIsLocating(false);
          setLocationNotice(`Location updated (GPS accurate to ±${acc}m)`);
          setTimeout(() => setLocationNotice(null), 4000);
        },
        () => {
          setLatitude(28.4744);
          setLongitude(77.504);
          setAccuracy(7.5);
          setIsLocating(false);
          setLocationNotice("Using approximate Greater Noida coordinates");
          setTimeout(() => setLocationNotice(null), 4000);
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

  // Generate a realistic sample road photo using HTML Canvas (for convenient mobile/desktop testing)
  const handleAddSamplePhoto = () => {
    if (typeof window === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Asphalt road background
    ctx.fillStyle = "#374151";
    ctx.fillRect(0, 0, 400, 300);

    // Road texture specks
    ctx.fillStyle = "#4b5563";
    for (let i = 0; i < 80; i++) {
      ctx.fillRect(Math.random() * 400, Math.random() * 300, 3, 2);
    }

    // Yellow road lane line
    ctx.fillStyle = "#eab308";
    ctx.fillRect(350, 0, 16, 300);

    // Pothole / defect crater
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.ellipse(180, 160, 90, 55, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Crater depth shadow
    ctx.fillStyle = "#030712";
    ctx.beginPath();
    ctx.ellipse(175, 165, 60, 35, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Road marker stamp
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText("JanSahayak Field Capture", 16, 30);
    ctx.font = "11px monospace";
    ctx.fillText(`${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E`, 16, 48);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const base64 = dataUrl.split(",")[1] || "";

    const newPhoto: PhotoItem = {
      id: `sample_${Date.now()}_${photos.length}`,
      filename: `road_hazard_${photos.length + 1}.jpg`,
      base64,
      byteSize: Math.round((base64.length * 3) / 4),
      capturedAt: new Date().toISOString(),
      latitude,
      longitude,
      accuracy,
      previewUrl: dataUrl,
    };

    setPhotos((prev) => [...prev, newPhoto].slice(0, 4));
    setErrorMsg(null);
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // Handle local file uploads & direct camera snaps
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1] || "";

        const newPhoto: PhotoItem = {
          id: `upload_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
          filename: file.name,
          base64,
          byteSize: file.size,
          capturedAt: new Date().toISOString(),
          latitude,
          longitude,
          accuracy,
          previewUrl: result,
        };

        setPhotos((prev) => [...prev, newPhoto].slice(0, 4));
        setErrorMsg(null);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
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

    if (photos.length < 1) {
      setErrorMsg("Please attach at least 1 photo showing the road hazard.");
      return;
    }

    if (!description || description.trim().length < 10) {
      setErrorMsg(
        "Please write at least 10 characters describing the hazard and nearby landmarks.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        category,
        description: description.trim(),
        submissionLocation: {
          latitude,
          longitude,
          accuracyMeters: accuracy,
          capturedAt: new Date().toISOString(),
        },
        deviceMetadata: {
          platform: "Mobile Web Client",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "JanSahayak",
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
            "Unable to submit report. Please check your connection and try again.",
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
  // SUCCESS CONFIRMATION SCREEN
  // ─────────────────────────────────────────────────────────────
  if (submissionReceipt) {
    const repId = (submissionReceipt.reportId as string) || "REP-RECORDED";
    const status = (submissionReceipt.status as string) || "Submitted";

    return (
      <main className="min-h-screen bg-[#f5f3ed] text-[#17382f] px-4 py-8 md:py-14">
        <div className="max-w-xl mx-auto space-y-6">
          <div className="flex items-center justify-between border-b border-[#cbd5cb] pb-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0e2b24] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-800 border-emerald-300 text-xs font-medium"
            >
              Report Logged
            </Badge>
          </div>

          <Card className="bg-[#faf9f5] border border-[#cbd5cb] rounded-2xl shadow-xs overflow-hidden">
            <div className="p-6 md:p-8 space-y-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-800">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-serif font-bold text-[#0e2b24] tracking-tight">
                    Report Submitted Successfully
                  </h1>
                  <p className="text-xs sm:text-sm text-[#5c6f66] mt-1.5 leading-relaxed">
                    Thank you for helping keep our streets safe. Your report has been saved to the
                    database and routed to the relevant municipal maintenance department for action.
                  </p>
                </div>
              </div>

              {/* Reference Details */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-white border border-[#cbd5cb] text-xs">
                <div>
                  <span className="text-[#5c6f66] block text-[11px]">Report Reference ID</span>
                  <span className="font-mono font-bold text-[#0e2b24] text-sm">{repId}</span>
                </div>
                <div>
                  <span className="text-[#5c6f66] block text-[11px]">Current Status</span>
                  <span className="font-semibold text-emerald-800 capitalize text-sm">
                    {status.toLowerCase().replace(/_/g, " ")}
                  </span>
                </div>
                <div className="col-span-2 pt-2 border-t border-[#eef1e9]">
                  <span className="text-[#5c6f66] block text-[11px]">Reported Location</span>
                  <span className="font-medium text-[#0e2b24]">{locationName}</span>
                </div>
              </div>

              {/* Authority Information */}
              <div className="p-4 rounded-xl border border-[#cbd5cb] bg-white/70 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#0e2b24] flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-emerald-800" />
                    Assigned Municipal Department
                  </span>
                  <Badge variant="secondary" className="text-[11px]">
                    <Clock className="h-3 w-3 mr-1 inline" /> ~{targetAuthority?.slaDays || 7} Days
                  </Badge>
                </div>
                <p className="text-xs font-bold text-[#0e2b24]">{targetAuthority?.name}</p>
                <p className="text-[11px] text-[#5c6f66]">{targetAuthority?.jurisdiction}</p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <Link
                  href="/map"
                  className={buttonVariants({
                    className:
                      "w-full sm:w-auto bg-[#0e2b24] hover:bg-[#1c4b3e] text-[#f5f3ed]! text-xs h-10 px-5 rounded-lg font-semibold",
                  })}
                >
                  <MapPin className="h-4 w-4 mr-2" /> View on Public Map
                </Link>
                <Link
                  href="/dashboard/reports"
                  className={buttonVariants({
                    variant: "outline",
                    className: "w-full sm:w-auto text-xs h-10 px-4 border-[#cbd5cb] rounded-lg",
                  })}
                >
                  View All Reports
                </Link>
                <Button
                  onClick={() => {
                    setSubmissionReceipt(null);
                    setPhotos([]);
                    setDescription("");
                  }}
                  variant="ghost"
                  className="w-full sm:w-auto text-xs h-10 text-[#5c6f66] hover:text-[#0e2b24]"
                >
                  Report Another Hazard
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // MOBILE-OPTIMIZED HAZARD REPORTING FORM
  // ─────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#f5f3ed] text-[#17382f] pb-28 md:pb-16">
      {/* Top Navigation */}
      <header className="border-b border-[#cbd5cb] bg-[#f5f3ed]/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0e2b24] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            <div className="h-3.5 w-px bg-[#cbd5cb]" />
            <Link href="/" className="flex items-center gap-2">
              <Brand />
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-[#5c6f66] bg-white px-2.5 py-1 rounded-full border border-[#cbd5cb]">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              <span className="font-medium text-[11px] sm:text-xs">Greater Noida</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Form Body */}
      <div className="max-w-2xl mx-auto px-4 pt-5 sm:pt-8">
        {/* Page Heading */}
        <div className="mb-5 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-serif font-bold text-[#0e2b24] tracking-tight">
            Report a Road Hazard
          </h1>
          <p className="text-xs sm:text-sm text-[#5c6f66] mt-1 leading-relaxed">
            Provide details and photo evidence so local municipal authorities and fellow citizens
            can take action.
          </p>
        </div>

        {/* Action / Error Banner */}
        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
            <div>
              <p className="font-semibold">Please check before submitting</p>
              <p className="mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {/* ── CARD 1: Hazard Type & Severity ── */}
          <Card className="bg-[#faf9f5] border border-[#cbd5cb] rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="p-4 pb-2 border-b border-[#eef1e9]">
              <CardTitle className="text-sm font-semibold text-[#0e2b24] flex items-center gap-2">
                <Car className="h-4 w-4 text-emerald-800" />
                1. What is the hazard?
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Category Selector */}
              <div className="space-y-1.5">
                <label
                  htmlFor="hazard-category-select"
                  className="text-xs font-semibold text-[#0e2b24] block"
                >
                  Hazard Category
                </label>
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
                    id="hazard-category-select"
                    className="w-full h-11 px-3 bg-white border-[#cbd5cb] text-xs sm:text-sm font-medium text-[#0e2b24] rounded-xl"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {React.createElement(selectedCatObj.icon, {
                        className: "h-4 w-4 text-emerald-800 shrink-0",
                      })}
                      <span className="truncate">{selectedCatObj.title}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#cbd5cb] max-h-72">
                    <SelectGroup>
                      <SelectLabel className="text-[11px] font-semibold text-[#5c6f66] px-2 py-1.5">
                        Common Road Hazards
                      </SelectLabel>
                      {CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        return (
                          <SelectItem
                            key={cat.id}
                            value={cat.id}
                            className="text-xs py-2.5 cursor-pointer rounded-lg"
                          >
                            <div className="flex items-center gap-2.5">
                              <Icon className="h-4 w-4 text-emerald-800 shrink-0" />
                              <div>
                                <span className="font-semibold block text-[#0e2b24]">
                                  {cat.title}
                                </span>
                                <span className="text-[11px] text-[#5c6f66] block leading-tight">
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
                <p className="text-[11px] text-[#5c6f66] mt-1">
                  Responsible authority:{" "}
                  <span className="font-medium text-[#0e2b24]">{targetAuthority?.name}</span>
                </p>
              </div>

              {/* Severity Button Group */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#0e2b24]">Urgency Level</span>
                  <span className="text-[11px] text-[#5c6f66]">
                    {SEVERITIES.find((s) => s.level === severity)?.desc}
                  </span>
                </div>

                <ButtonGroup className="w-full grid grid-cols-4 gap-1 border border-[#cbd5cb] rounded-xl p-1 bg-white">
                  {SEVERITIES.map((sev) => {
                    const isSelected = severity === sev.level;
                    return (
                      <button
                        key={sev.level}
                        type="button"
                        onClick={() => setSeverity(sev.level)}
                        className={`h-10 text-xs transition-all rounded-lg flex items-center justify-center ${
                          isSelected
                            ? sev.activeClass
                            : "text-[#5c6f66] hover:text-[#0e2b24] hover:bg-[#f5f3ed]"
                        }`}
                      >
                        {sev.label}
                      </button>
                    );
                  })}
                </ButtonGroup>
              </div>
            </CardContent>
          </Card>

          {/* ── CARD 2: Location ── */}
          <Card className="bg-[#faf9f5] border border-[#cbd5cb] rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="p-4 pb-2 border-b border-[#eef1e9]">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-[#0e2b24] flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-800" />
                  2. Where is it located?
                </CardTitle>

                {/* Edit Landmark Dialog Trigger */}
                <Dialog open={isLocationModalOpen} onOpenChange={setIsLocationModalOpen}>
                  <DialogTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-2.5 border-[#cbd5cb] bg-white text-[#0e2b24] rounded-lg"
                      >
                        <SlidersHorizontal className="h-3 w-3 mr-1" />
                        Edit Landmark
                      </Button>
                    }
                  />
                  <DialogContent className="sm:max-w-md bg-[#faf9f5] border-[#cbd5cb]">
                    <DialogHeader>
                      <DialogTitle className="text-base font-serif font-bold text-[#0e2b24]">
                        Set Hazard Location
                      </DialogTitle>
                      <DialogDescription className="text-xs text-[#5c6f66]">
                        Specify the sector and nearby landmark to help repair crews locate the exact
                        spot.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3.5 my-2">
                      <div>
                        <label
                          htmlFor="sector-select"
                          className="text-xs font-semibold text-[#0e2b24] block mb-1"
                        >
                          Select Sector or Area
                        </label>
                        <Select
                          value={tempSector}
                          onValueChange={(val) => val && setTempSector(val)}
                        >
                          <SelectTrigger
                            id="sector-select"
                            className="w-full h-10 bg-white border-[#cbd5cb] text-xs rounded-lg"
                          >
                            <span>{tempSector || "Choose a sector"}</span>
                          </SelectTrigger>
                          <SelectContent className="bg-white border-[#cbd5cb] max-h-56">
                            <SelectGroup>
                              <SelectLabel className="text-[11px] font-semibold text-[#5c6f66]">
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

                      <div>
                        <label
                          htmlFor="landmark-input"
                          className="text-xs font-semibold text-[#0e2b24] block mb-1"
                        >
                          Specific Landmark or Street Details
                        </label>
                        <input
                          id="landmark-input"
                          type="text"
                          value={tempLandmark}
                          onChange={(e) => setTempLandmark(e.target.value)}
                          placeholder="e.g. Opposite Commercial Belt, near Pillar 14"
                          className="w-full text-xs px-3 py-2.5 rounded-lg border border-[#cbd5cb] bg-white focus:outline-none focus:ring-1 focus:ring-[#0e2b24]"
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        type="button"
                        onClick={handleSaveLocationModal}
                        className="bg-[#0e2b24] hover:bg-[#1c4b3e] text-white text-xs h-9 rounded-lg"
                      >
                        Save Location
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              {/* Location display card */}
              <div className="p-3 rounded-xl bg-white border border-[#cbd5cb] flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-semibold text-[#0e2b24] truncate text-sm">{locationName}</p>
                  <p className="text-[11px] text-[#5c6f66] mt-0.5">
                    Coordinates: {latitude.toFixed(4)}°N, {longitude.toFixed(4)}°E (±{accuracy}m)
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={handleAcquireGps}
                  disabled={isLocating}
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 border-[#cbd5cb] bg-[#faf9f5] text-[#0e2b24] shrink-0 rounded-lg flex items-center gap-1.5"
                  title="Detect current location"
                >
                  {isLocating ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span className="text-[11px] hidden sm:inline">Locating...</span>
                    </>
                  ) : (
                    <>
                      <Crosshair className="h-3.5 w-3.5 text-emerald-800" />
                      <span className="text-[11px]">Use GPS</span>
                    </>
                  )}
                </Button>
              </div>

              {locationNotice && (
                <p className="text-[11px] text-emerald-800 font-medium px-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 inline" /> {locationNotice}
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── CARD 3: Photo Evidence ── */}
          <Card className="bg-[#faf9f5] border border-[#cbd5cb] rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="p-4 pb-2 border-b border-[#eef1e9]">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-[#0e2b24] flex items-center gap-2">
                  <Camera className="h-4 w-4 text-emerald-800" />
                  3. Photos of the Hazard
                </CardTitle>
                <Badge
                  variant="outline"
                  className={`text-[11px] font-medium ${
                    photos.length >= 1
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : "bg-amber-50 text-amber-900 border-amber-300"
                  }`}
                >
                  {photos.length} / 4 Photos {photos.length >= 1 ? "✓ Attached" : "(Min. 1)"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3.5">
              {/* Photo Previews Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {photos.map((photo, idx) => (
                  <div
                    key={photo.id}
                    className="relative aspect-square rounded-xl overflow-hidden border border-[#cbd5cb] bg-white group shadow-2xs"
                  >
                    {/* Real Image Preview */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.previewUrl || `data:image/jpeg;base64,${photo.base64}`}
                      alt={photo.filename}
                      className="w-full h-full object-cover"
                    />

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition-all"
                      aria-label="Remove photo"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>

                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 text-white flex items-center justify-between">
                      <span className="text-[10px] font-medium truncate">Photo {idx + 1}</span>
                      <span className="text-[9px] opacity-80">
                        {(photo.byteSize / 1024).toFixed(0)}KB
                      </span>
                    </div>
                  </div>
                ))}

                {/* Add Photo Slot (if under 4) */}
                {photos.length < 4 && (
                  <label className="aspect-square rounded-xl border-2 border-dashed border-[#cbd5cb] hover:border-[#0e2b24] bg-white/60 hover:bg-white transition-all cursor-pointer flex flex-col items-center justify-center p-2 text-center group active:scale-98">
                    <div className="h-9 w-9 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center group-hover:scale-110 transition-transform mb-1.5">
                      <Camera className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold text-[#0e2b24]">
                      {photos.length === 0 ? "Add Photo" : "Add Another"}
                    </span>
                    <span className="text-[10px] text-[#5c6f66] mt-0.5">Camera or Gallery</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Upload Helper Tips & Sample Action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-[11px] text-[#5c6f66]">
                <p>
                  Tip: A clear shot of the defect and a wider shot of the road lane help crews
                  locate it quickly.
                </p>
                <button
                  type="button"
                  onClick={handleAddSamplePhoto}
                  className="inline-flex items-center gap-1 font-semibold text-emerald-900 hover:underline shrink-0"
                >
                  <ImageIcon className="h-3 w-3 text-emerald-700" />
                  Add sample photo
                </button>
              </div>
            </CardContent>
          </Card>

          {/* ── CARD 4: Description ── */}
          <Card className="bg-[#faf9f5] border border-[#cbd5cb] rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="p-4 pb-2 border-b border-[#eef1e9]">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-[#0e2b24]">
                  4. Description &amp; Specific Details
                </CardTitle>
                <span className="text-[11px] text-[#5c6f66] font-mono">
                  {description.trim().length} chars (min 10)
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-2">
              <textarea
                id="hazard-description"
                rows={3}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Describe the condition (e.g. deep crater on the left lane right before the roundabout, water accumulates during rain, hazardous for two-wheelers)..."
                className="w-full text-xs sm:text-sm p-3 rounded-xl border border-[#cbd5cb] bg-white focus:outline-none focus:ring-2 focus:ring-[#0e2b24]/20 placeholder:text-[#8b9b92] leading-relaxed resize-none"
              />
            </CardContent>
          </Card>

          {/* Desktop Submit Button Row */}
          <div className="hidden lg:flex items-center justify-between pt-2">
            <Link
              href="/"
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "text-xs text-[#5c6f66] h-10 px-4",
              })}
            >
              Cancel
            </Link>

            <Button
              type="submit"
              disabled={isSubmitting || photos.length < 1 || description.trim().length < 10}
              className="bg-[#0e2b24] hover:bg-[#1c4b3e] text-[#f5f3ed]! text-sm h-11 px-7 rounded-xl font-bold shadow-sm transition-all"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Submitting Report...
                </>
              ) : (
                <>
                  Submit Report <ArrowRight className="h-4 w-4 ml-1.5" />
                </>
              )}
            </Button>
          </div>

          {/* ── Mobile Sticky Bottom Submit Dock ── */}
          <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#faf9f5]/98 backdrop-blur-md border-t border-[#cbd5cb] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(14,43,36,0.08)]">
            <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
              <div className="flex flex-col">
                <span className="text-[11px] text-[#5c6f66]">
                  {photos.length < 1
                    ? "Add 1+ photo"
                    : description.trim().length < 10
                      ? "Add description"
                      : "Ready to submit"}
                </span>
                <span
                  className={`text-xs font-bold ${
                    photos.length >= 1 && description.trim().length >= 10
                      ? "text-emerald-800"
                      : "text-amber-800"
                  }`}
                >
                  {photos.length >= 1 && description.trim().length >= 10
                    ? "All details filled"
                    : "Fill required fields"}
                </span>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || photos.length < 1 || description.trim().length < 10}
                className="bg-[#0e2b24] hover:bg-[#1c4b3e] text-[#f5f3ed]! text-xs sm:text-sm h-11 px-6 rounded-xl font-bold shadow-md active:scale-95 transition-all"
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
