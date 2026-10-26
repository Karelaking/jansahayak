import {
  GPSSample,
  LocationQualityBand,
  LocationSampleAssessment,
  LocationVerificationResult,
} from "./types";
import { RawReportDocument, getReportsCollection } from "@/lib/db/mongodb";
import { PILOT_CONFIG } from "@/lib/data/constants";
import { calculateGeodesicDistanceMeters, isValidWGS84Coordinate } from "./geo";

export { calculateGeodesicDistanceMeters } from "./geo";

export const LOCATION_ALGORITHM_VERSION = "location-geodesic-v2";

export interface LocationAnalysisPolicy {
  /** Samples farther than this from the robust centre are outliers. */
  outlierRadiusMeters: number;
  /** Valid samples within this radius form one spatial cluster. */
  clusterRadiusMeters: number;
  /** Two clusters farther apart than this represent possible distinct hazards. */
  multiClusterSeparationMeters: number;
  /** Accuracy values are clamped into this range to cap sample influence. */
  minAccuracyMeters: number;
  maxAccuracyMeters: number;
  /** Quality bands from PRD §9. */
  highBandMaxMeters: number;
  mediumBandMaxMeters: number;
  lowBandMaxMeters: number;
}

export const DEFAULT_LOCATION_POLICY: LocationAnalysisPolicy = {
  outlierRadiusMeters: 100,
  clusterRadiusMeters: 25,
  multiClusterSeparationMeters: 40,
  minAccuracyMeters: 5,
  maxAccuracyMeters: 250,
  highBandMaxMeters: 10,
  mediumBandMaxMeters: 25,
  lowBandMaxMeters: 50,
};

export interface LocationAnalysisPhoto {
  gpsSamples: GPSSample[];
}

export interface LocationAnalysisInput {
  photos: LocationAnalysisPhoto[];
  policy?: Partial<LocationAnalysisPolicy>;
}

function median(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function countClusters(
  samples: Array<{ latitude: number; longitude: number }>,
  radiusMeters: number,
): number {
  const visited = new Set<number>();
  let clusters = 0;

  for (let i = 0; i < samples.length; i++) {
    if (visited.has(i)) continue;
    clusters += 1;
    const queue = [i];
    visited.add(i);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentSample = samples[current]!;
      for (let j = 0; j < samples.length; j++) {
        if (visited.has(j)) continue;
        const other = samples[j]!;
        const distance = calculateGeodesicDistanceMeters(
          currentSample.latitude,
          currentSample.longitude,
          other.latitude,
          other.longitude,
        );
        if (distance <= radiusMeters) {
          visited.add(j);
          queue.push(j);
        }
      }
    }
  }

  return clusters;
}

/**
 * Pure geodesic location verification (PRD §9, §11).
 *
 * - Rejects non-finite / out-of-range coordinates.
 * - Distinguishes missing accuracy values from high accuracy values.
 * - Ignores submission-time fallback samples for verification.
 * - Uses inverse-variance weighting with capped influence per photo.
 * - Detects outlier samples and multiple spatial clusters.
 * - Assigns PRD quality bands and records estimated uncertainty.
 */
export function analyzeLocationSamples(input: LocationAnalysisInput): {
  result?: LocationVerificationResult;
  error?: string;
} {
  const policy: LocationAnalysisPolicy = { ...DEFAULT_LOCATION_POLICY, ...input.policy };
  const issues: string[] = [];
  const assessments: LocationSampleAssessment[] = [];

  const usable: Array<{
    latitude: number;
    longitude: number;
    accuracy: number;
    photoIndex: number;
  }> = [];
  let fallbackSamples = 0;
  let validFiniteCoordinateCount = 0;

  input.photos.forEach((photo, photoIndex) => {
    (photo.gpsSamples || []).forEach((sample) => {
      const source = sample.source === "submission_fallback" ? "submission_fallback" : "capture";
      const coordinateValid = isValidWGS84Coordinate(sample.latitude, sample.longitude);
      const accuracyValid =
        Number.isFinite(sample.horizontalAccuracyMeters) && sample.horizontalAccuracyMeters > 0;

      if (!coordinateValid) {
        assessments.push({
          latitude: sample.latitude,
          longitude: sample.longitude,
          horizontalAccuracyMeters: sample.horizontalAccuracyMeters,
          source,
          distanceFromCentroidMeters: Number.NaN,
          includedInCentroid: false,
          exclusionReason: "Coordinate is non-finite or outside WGS84 range.",
        });
        return;
      }

      if (!accuracyValid) {
        assessments.push({
          latitude: sample.latitude,
          longitude: sample.longitude,
          horizontalAccuracyMeters: sample.horizontalAccuracyMeters,
          source,
          distanceFromCentroidMeters: Number.NaN,
          includedInCentroid: false,
          exclusionReason:
            "Horizontal accuracy is missing or non-positive; accuracy cannot be assumed.",
        });
        return;
      }

      validFiniteCoordinateCount += 1;

      if (source === "submission_fallback") {
        fallbackSamples += 1;
        assessments.push({
          latitude: sample.latitude,
          longitude: sample.longitude,
          horizontalAccuracyMeters: sample.horizontalAccuracyMeters,
          source,
          distanceFromCentroidMeters: Number.NaN,
          includedInCentroid: false,
          exclusionReason: "Submission-time fallback location cannot verify capture-time position.",
        });
        return;
      }

      usable.push({
        latitude: sample.latitude,
        longitude: sample.longitude,
        accuracy: sample.horizontalAccuracyMeters,
        photoIndex,
      });
    });
  });

  if (validFiniteCoordinateCount === 0) {
    return {
      error: "Location verification failed: no finite WGS84 GPS samples were supplied.",
    };
  }

  if (usable.length === 0) {
    return {
      error:
        fallbackSamples > 0
          ? "Location verification failed: only submission-time fallback coordinates are available; capture-time GPS is required for a verified pin."
          : "Location verification failed: no valid capture-time GPS samples with accuracy are available.",
    };
  }

  // Robust centre for outlier detection: component-wise median resists teleports.
  const medianLat = median(usable.map((sample) => sample.latitude));
  const medianLng = median(usable.map((sample) => sample.longitude));

  const inlierSamples: typeof usable = [];
  for (const sample of usable) {
    const distance = calculateGeodesicDistanceMeters(
      medianLat,
      medianLng,
      sample.latitude,
      sample.longitude,
    );
    if (distance <= policy.outlierRadiusMeters) {
      inlierSamples.push(sample);
    } else {
      assessments.push({
        latitude: sample.latitude,
        longitude: sample.longitude,
        horizontalAccuracyMeters: sample.accuracy,
        source: "capture",
        distanceFromCentroidMeters: Number(distance.toFixed(2)),
        includedInCentroid: false,
        exclusionReason: `Sample is ${distance.toFixed(1)}m from the robust centre (outlier threshold ${policy.outlierRadiusMeters}m).`,
      });
      issues.push(
        `GPS sample at (${sample.latitude.toFixed(5)}, ${sample.longitude.toFixed(5)}) rejected as an outlier.`,
      );
    }
  }

  if (inlierSamples.length === 0) {
    return {
      error: "Location verification failed: every GPS sample was rejected as a spatial outlier.",
    };
  }

  // Correlated samples from the same photo must not dominate the centroid.
  const samplesPerPhoto = new Map<number, number>();
  for (const sample of inlierSamples) {
    samplesPerPhoto.set(sample.photoIndex, (samplesPerPhoto.get(sample.photoIndex) || 0) + 1);
  }

  let totalWeight = 0;
  let weightedLatSum = 0;
  let weightedLngSum = 0;
  let weightedAccuracy = 0;

  for (const sample of inlierSamples) {
    const cappedAccuracy = Math.min(
      policy.maxAccuracyMeters,
      Math.max(policy.minAccuracyMeters, sample.accuracy),
    );
    const correlationWeight = 1 / (samplesPerPhoto.get(sample.photoIndex) || 1);
    const weight = (1 / (cappedAccuracy * cappedAccuracy)) * correlationWeight;
    totalWeight += weight;
    weightedLatSum += sample.latitude * weight;
    weightedLngSum += sample.longitude * weight;
    weightedAccuracy += cappedAccuracy * weight;
  }

  const centroidLatitude = Number((weightedLatSum / totalWeight).toFixed(7));
  const centroidLongitude = Number((weightedLngSum / totalWeight).toFixed(7));
  const effectiveAccuracy = weightedAccuracy / totalWeight;

  let maxSpreadMeters = 0;
  for (const sample of inlierSamples) {
    const distance = calculateGeodesicDistanceMeters(
      centroidLatitude,
      centroidLongitude,
      sample.latitude,
      sample.longitude,
    );
    maxSpreadMeters = Math.max(maxSpreadMeters, distance);
    assessments.push({
      latitude: sample.latitude,
      longitude: sample.longitude,
      horizontalAccuracyMeters: sample.accuracy,
      source: "capture",
      distanceFromCentroidMeters: Number(distance.toFixed(2)),
      includedInCentroid: true,
    });
  }

  const spatialUncertaintyMeters = Number(
    Math.max(effectiveAccuracy, maxSpreadMeters + effectiveAccuracy * 0.5).toFixed(2),
  );

  const clustersDetected = countClusters(inlierSamples, policy.clusterRadiusMeters);
  let requiresLocationReview = false;

  if (clustersDetected > 1) {
    requiresLocationReview = true;
    issues.push(
      `Possible multiple hazards: ${clustersDetected} distinct GPS clusters separated beyond ${policy.multiClusterSeparationMeters}m were detected in one submission. Manual segmentation review is required.`,
    );
  }

  let qualityBand: LocationQualityBand;
  if (spatialUncertaintyMeters <= policy.highBandMaxMeters) {
    qualityBand = "HIGH";
  } else if (spatialUncertaintyMeters <= policy.mediumBandMaxMeters) {
    qualityBand = "MEDIUM";
  } else if (spatialUncertaintyMeters <= policy.lowBandMaxMeters) {
    qualityBand = "LOW";
    requiresLocationReview = true;
    issues.push("Low GPS precision requires manual location verification.");
  } else {
    qualityBand = "REJECTED";
    requiresLocationReview = true;
    issues.push(
      `High spatial uncertainty (${spatialUncertaintyMeters}m > ${policy.lowBandMaxMeters}m). Automatic public pin is prohibited.`,
    );
  }

  // A multi-cluster submission can never be auto-published as one precise pin.
  if (clustersDetected > 1 && qualityBand !== "REJECTED") {
    qualityBand = qualityBand === "HIGH" ? "MEDIUM" : qualityBand;
    requiresLocationReview = true;
  }

  const isWithinPilotBounds =
    centroidLongitude >= PILOT_CONFIG.bounds[0][0] &&
    centroidLongitude <= PILOT_CONFIG.bounds[1][0] &&
    centroidLatitude >= PILOT_CONFIG.bounds[0][1] &&
    centroidLatitude <= PILOT_CONFIG.bounds[1][1];

  if (!isWithinPilotBounds) {
    requiresLocationReview = true;
    issues.push(
      `Coordinates (${centroidLatitude.toFixed(4)}, ${centroidLongitude.toFixed(4)}) fall outside designated Greater Noida pilot bounding box. Manual jurisdiction verification is required.`,
    );
    if (qualityBand === "HIGH" || qualityBand === "MEDIUM") {
      qualityBand = "LOW";
    }
  }

  const result: LocationVerificationResult = {
    isVerified: qualityBand !== "REJECTED",
    centroidLatitude,
    centroidLongitude,
    spatialUncertaintyMeters,
    qualityBand,
    outlierCount: usable.length - inlierSamples.length,
    samplesEvaluated: assessments.length,
    sampleAssessments: assessments,
    clustersDetected,
    requiresLocationReview,
    algorithmVersion: LOCATION_ALGORITHM_VERSION,
    usedFallbackSamples: fallbackSamples > 0,
    isWithinPilotBounds,
    issues,
  };

  return { result };
}

/**
 * Stage 4 worker wrapper. Persists the outcome while preserving every original
 * capture coordinate (raw samples remain untouched in the raw report document).
 */
export async function executeStage4LocationVerification(report: RawReportDocument): Promise<
  | {
      stage: 4;
      stageName: string;
      success: false;
      data?: LocationVerificationResult;
      error: string;
      isRetryable: boolean;
    }
  | {
      stage: 4;
      stageName: string;
      success: true;
      data: LocationVerificationResult;
      error?: undefined;
      isRetryable?: false;
    }
> {
  const stageName = "Location Verification & Geodesic Clustering";

  try {
    const { result, error } = analyzeLocationSamples({
      photos: report.evidencePhotos.map((photo) => ({ gpsSamples: photo.gpsSamples || [] })),
    });

    const reportsColl = await getReportsCollection();

    if (!result || error) {
      await reportsColl.updateOne(
        { reportId: report.reportId },
        { $set: { status: "LOCATION_VERIFICATION_FAILED", updatedAt: new Date().toISOString() } },
      );
      return {
        stage: 4,
        stageName,
        success: false,
        error: error || "Location verification failed.",
        isRetryable: false,
      };
    }

    await reportsColl.updateOne(
      { reportId: report.reportId },
      {
        $set: {
          status: result.isVerified ? "LOCATION_VERIFIED" : "LOCATION_VERIFICATION_FAILED",
          updatedAt: new Date().toISOString(),
        },
      },
    );

    if (result.isVerified) {
      return {
        stage: 4,
        stageName,
        success: true,
        data: result,
      };
    }

    return {
      stage: 4,
      stageName,
      success: false,
      data: result,
      error: result.issues.join("; "),
      isRetryable: false,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      stage: 4,
      stageName,
      success: false,
      error: `Stage 4 location verification failed: ${msg}`,
      isRetryable: true,
    };
  }
}
