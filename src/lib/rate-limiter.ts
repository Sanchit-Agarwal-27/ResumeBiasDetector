/**
 * Client-Side In-Memory Rate Limiter & Abuse Prevention Guard
 *
 * Implements a token bucket algorithm to protect:
 * 1. Supabase Auth endpoints (Login, Signup, Magic Link, Password Reset)
 * 2. Remote Analysis API endpoints (FastAPI proxy calls)
 * 3. Export & Cloud Vault mutations
 *
 * Prevents credential stuffing, rapid automated requests, and excessive API key usage.
 */

interface RateBucket {
  tokens: number;
  lastRefill: number;
  consecutiveFailures: number;
  lockedUntil: number;
}

interface RateLimitConfig {
  maxTokens: number; // Max burst capacity
  refillRatePerSec: number; // Tokens added per second
  lockoutThreshold?: number; // Failures before temporary lockout
  lockoutDurationSec?: number; // Duration of lockout in seconds
}

// Configured policy rules for actions
const ACTION_POLICIES: Record<string, RateLimitConfig> = {
  "auth:login": {
    maxTokens: 5,
    refillRatePerSec: 5 / 60, // 5 requests per 60s
    lockoutThreshold: 5,
    lockoutDurationSec: 60,
  },
  "auth:signup": {
    maxTokens: 3,
    refillRatePerSec: 3 / 60, // 3 requests per 60s
    lockoutThreshold: 3,
    lockoutDurationSec: 120,
  },
  "auth:magic-link": {
    maxTokens: 2,
    refillRatePerSec: 2 / 120, // 2 requests per 2 mins
    lockoutThreshold: 3,
    lockoutDurationSec: 180,
  },
  "auth:forgot-password": {
    maxTokens: 2,
    refillRatePerSec: 2 / 120,
    lockoutThreshold: 3,
    lockoutDurationSec: 180,
  },
  "api:analyze": {
    maxTokens: 15,
    refillRatePerSec: 15 / 60, // 15 analyses per min
    lockoutThreshold: 10,
    lockoutDurationSec: 60,
  },
  "vault:snapshot": {
    maxTokens: 10,
    refillRatePerSec: 10 / 60,
    lockoutThreshold: 8,
    lockoutDurationSec: 60,
  },
};

const buckets = new Map<string, RateBucket>();

function getBucketKey(action: string, identifier: string = "default"): string {
  return `${action}:${identifier.toLowerCase().trim()}`;
}

/**
 * Checks whether an action is allowed for an identifier under rate limiting rules.
 * If allowed, consumes 1 token.
 * Returns { allowed: true } or { allowed: false, retryAfterSeconds: number, reason: string }
 */
export function checkRateLimit(
  action: string,
  identifier: string = "default",
): {
  allowed: boolean;
  retryAfterSeconds?: number;
  reason?: string;
} {
  const config = ACTION_POLICIES[action] || {
    maxTokens: 10,
    refillRatePerSec: 10 / 60,
  };

  const key = getBucketKey(action, identifier);
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = {
      tokens: config.maxTokens,
      lastRefill: now,
      consecutiveFailures: 0,
      lockedUntil: 0,
    };
    buckets.set(key, bucket);
  }

  // Check if currently locked out
  if (bucket.lockedUntil > now) {
    const remainingSec = Math.ceil((bucket.lockedUntil - now) / 1000);
    return {
      allowed: false,
      retryAfterSeconds: remainingSec,
      reason: `Too many attempts. Temporarily rate-limited for security. Try again in ${remainingSec}s.`,
    };
  }

  // Refill tokens based on elapsed time
  const elapsedSec = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(config.maxTokens, bucket.tokens + elapsedSec * config.refillRatePerSec);
  bucket.lastRefill = now;

  // Check token availability
  if (bucket.tokens < 1) {
    const waitSec = Math.ceil((1 - bucket.tokens) / config.refillRatePerSec);
    return {
      allowed: false,
      retryAfterSeconds: waitSec,
      reason: `Request rate limit reached. Please wait ${waitSec}s before trying again.`,
    };
  }

  // Consume 1 token
  bucket.tokens -= 1;
  return { allowed: true };
}

/**
 * Record a failure (e.g., bad credentials or API error) to trigger progressive lockouts
 */
export function recordRateLimitFailure(action: string, identifier: string = "default"): void {
  const config = ACTION_POLICIES[action];
  if (!config || !config.lockoutThreshold) return;

  const key = getBucketKey(action, identifier);
  const bucket = buckets.get(key);
  if (!bucket) return;

  bucket.consecutiveFailures += 1;
  if (bucket.consecutiveFailures >= config.lockoutThreshold) {
    const duration = config.lockoutDurationSec || 60;
    bucket.lockedUntil = Date.now() + duration * 1000;
    bucket.tokens = 0;
  }
}

/**
 * Reset failure counter upon successful authentication / action
 */
export function recordRateLimitSuccess(action: string, identifier: string = "default"): void {
  const key = getBucketKey(action, identifier);
  const bucket = buckets.get(key);
  if (bucket) {
    bucket.consecutiveFailures = 0;
    bucket.lockedUntil = 0;
  }
}
