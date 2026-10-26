/**
 * JanSahayak SafeStreets - In-Memory Sliding Window Rate Limiter
 * Reference: PRD §17 Security and abuse prevention
 */

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  limit: number;
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  limit: 15, // 15 requests
  windowMs: 60 * 1000, // per 60 seconds
};

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Checks if a given identifier (e.g. client IP, user ID) is within rate limits.
 * Uses a sliding-window algorithm.
 */
export function checkRateLimit(
  identifier: string,
  customOptions?: Partial<RateLimitOptions>,
): RateLimitResult {
  const options: RateLimitOptions = {
    ...DEFAULT_OPTIONS,
    ...customOptions,
  };

  const now = Date.now();
  const windowStart = now - options.windowMs;

  const record = rateLimitStore.get(identifier) || { timestamps: [] };

  // Evict timestamps older than the sliding window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (record.timestamps.length >= options.limit) {
    const oldest = record.timestamps[0] || now;
    const resetMs = Math.max(0, oldest + options.windowMs - now);

    return {
      allowed: false,
      remaining: 0,
      resetMs,
      limit: options.limit,
    };
  }

  // Record this request
  record.timestamps.push(now);
  rateLimitStore.set(identifier, record);

  const remaining = Math.max(0, options.limit - record.timestamps.length);
  return {
    allowed: true,
    remaining,
    resetMs: options.windowMs,
    limit: options.limit,
  };
}

/**
 * Resets rate limit records for an identifier, or clears all records if no identifier is passed.
 * Primarily used for automated testing.
 */
export function resetRateLimit(identifier?: string): void {
  if (identifier) {
    rateLimitStore.delete(identifier);
  } else {
    rateLimitStore.clear();
  }
}
