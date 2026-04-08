// ============================================================================
// RetryManager - Exponential backoff retry with jitter
// ============================================================================

import { createLogger } from './Logger.js';

const logger = createLogger('RetryManager');

/**
 * Retry configuration options
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Backoff multiplier (default 2) */
  backoffMultiplier?: number;
  /** Jitter factor (0-1, default 0.1) */
  jitterFactor?: number;
  /** Errors that should trigger retry */
  retryableErrors?: string[];
  /** HTTP status codes that should trigger retry */
  retryableStatusCodes?: number[];
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  retryableErrors: [
    'ECONNRESET',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ENETDOWN',
    'ENETUNREACH',
    'EHOSTDOWN',
    'EHOSTUNREACH',
    'EPIPE',
    'rate_limit',
    'overloaded',
    'timeout',
  ],
  retryableStatusCodes: [429, 500, 502, 503, 504],
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  config: RetryConfig
): number {
  const { initialDelay, maxDelay, backoffMultiplier = 2, jitterFactor = 0.1 } = config;
  
  // Exponential backoff: initialDelay * (2 ^ attempt)
  const exponentialDelay = initialDelay * Math.pow(backoffMultiplier, attempt);
  
  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  
  // Add jitter: random variation to prevent thundering herd
  const jitter = cappedDelay * jitterFactor * (Math.random() * 2 - 1);
  
  return Math.max(0, cappedDelay + jitter);
}

/**
 * Check if an error is retryable
 */
function isRetryableError(
  error: unknown,
  config: RetryConfig
): boolean {
  const { retryableErrors = [], retryableStatusCodes = [] } = config;
  
  // Check error message
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  for (const retryable of retryableErrors) {
    if (errorMessage.includes(retryable.toLowerCase())) {
      return true;
    }
  }
  
  // Check error name
  if (error instanceof Error) {
    for (const retryable of retryableErrors) {
      if (error.name.toLowerCase().includes(retryable.toLowerCase())) {
        return true;
      }
    }
  }
  
  // Check status code
  const anyError = error as any;
  if (anyError?.status && retryableStatusCodes.includes(anyError.status)) {
    return true;
  }
  if (anyError?.statusCode && retryableStatusCodes.includes(anyError.statusCode)) {
    return true;
  }
  
  // Check for specific error types
  if (anyError?.error?.type === 'rate_limit_error') return true;
  if (anyError?.error?.type === 'overloaded_error') return true;
  
  return false;
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const { maxAttempts } = fullConfig;
  
  let lastError: unknown;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if retryable
      if (!isRetryableError(error, fullConfig)) {
        throw error;
      }
      
      // Check if we've exhausted attempts
      if (attempt >= maxAttempts - 1) {
        logger.warn(`Retry exhausted after ${maxAttempts} attempts`, { error });
        throw error;
      }
      
      // Calculate delay and wait
      const delay = calculateDelay(attempt, fullConfig);
      logger.debug(`Retrying in ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`, { error });
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Create a retry wrapper for a function
 */
export function createRetryWrapper<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  config: Partial<RetryConfig> = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetry(() => fn(...args), config);
}

// ============================================================================
// RateLimiter - Token bucket rate limiting
// ============================================================================

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum tokens in bucket */
  maxTokens: number;
  /** Tokens replenished per second */
  tokensPerSecond: number;
  /** Maximum wait time in milliseconds (default 60000) */
  maxWaitTime?: number;
}

/**
 * Token bucket rate limiter
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private config: RateLimiterConfig;
  private waitQueue: Array<{
    tokens: number;
    resolve: () => void;
    reject: (err: Error) => void;
    timestamp: number;
  }> = [];
  
  constructor(config: RateLimiterConfig) {
    this.config = config;
    this.tokens = config.maxTokens;
    this.lastRefill = Date.now();
  }
  
  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.config.tokensPerSecond;
    
    this.tokens = Math.min(this.config.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
  
  /**
   * Try to acquire tokens without waiting
   * @returns true if tokens were acquired, false otherwise
   */
  tryAcquire(tokens: number): boolean {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }
  
  /**
   * Acquire tokens, waiting if necessary
   */
  async acquire(tokens: number): Promise<void> {
    this.refill();
    
    // If we have enough tokens, acquire immediately
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return;
    }
    
    // Calculate wait time
    const tokensNeeded = tokens - this.tokens;
    const waitTimeMs = (tokensNeeded / this.config.tokensPerSecond) * 1000;
    const maxWaitTime = this.config.maxWaitTime ?? 60000;
    
    if (waitTimeMs > maxWaitTime) {
      throw new Error(`Rate limit wait time (${waitTimeMs}ms) exceeds maximum (${maxWaitTime}ms)`);
    }
    
    // Add to wait queue
    return new Promise((resolve, reject) => {
      this.waitQueue.push({
        tokens,
        resolve,
        reject,
        timestamp: Date.now(),
      });
      
      // Start processing queue
      this.processQueue();
    });
  }
  
  /**
   * Process waiting requests
   */
  private processQueue(): void {
    const checkAndProcess = () => {
      this.refill();
      
      // Process queue in order
      while (this.waitQueue.length > 0 && this.tokens >= (this.waitQueue[0]?.tokens ?? 0)) {
        const request = this.waitQueue.shift();
        if (request) {
          this.tokens -= request.tokens;
          request.resolve();
        }
      }
      
      // Schedule next check if queue not empty
      const nextRequest = this.waitQueue[0];
      if (nextRequest) {
        const tokensNeeded = nextRequest.tokens - this.tokens;
        const waitTimeMs = (tokensNeeded / this.config.tokensPerSecond) * 1000;
        
        setTimeout(checkAndProcess, Math.min(waitTimeMs, 100));
      }
    };
    
    // Check for timed-out requests
    const maxWaitTime = this.config.maxWaitTime ?? 60000;
    const now = Date.now();
    this.waitQueue = this.waitQueue.filter((request) => {
      if (now - request.timestamp > maxWaitTime) {
        request.reject(new Error('Rate limit wait timeout'));
        return false;
      }
      return true;
    });
    
    checkAndProcess();
  }
  
  /**
   * Get current token count
   */
  getTokens(): number {
    this.refill();
    return this.tokens;
  }
  
  /**
   * Get estimated wait time for a given number of tokens
   */
  getWaitTime(tokens: number): number {
    this.refill();
    
    if (this.tokens >= tokens) return 0;
    
    const tokensNeeded = tokens - this.tokens;
    return (tokensNeeded / this.config.tokensPerSecond) * 1000;
  }
}

/**
 * Create a rate-limited wrapper for a function
 */
export function withRateLimit<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  limiter: RateLimiter,
  tokensPerCall: number = 1
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    await limiter.acquire(tokensPerCall);
    return fn(...args);
  };
}

// ============================================================================
// ConcurrencyLimiter - Limit concurrent operations
// ============================================================================

/**
 * Concurrency limiter using semaphore pattern
 */
export class ConcurrencyLimiter {
  private running = 0;
  private queue: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
  }> = [];
  
  constructor(private maxConcurrent: number) {}
  
  /**
   * Acquire a slot
   */
  async acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }
    
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject });
    });
  }
  
  /**
   * Release a slot
   */
  release(): void {
    this.running--;
    
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      this.running++;
      next.resolve();
    }
  }
  
  /**
   * Execute a function with concurrency limit
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
  
  /**
   * Get current state
   */
  getState(): { running: number; queued: number; available: number } {
    return {
      running: this.running,
      queued: this.queue.length,
      available: this.maxConcurrent - this.running,
    };
  }
}

// ============================================================================
// Composite utilities
// ============================================================================

/**
 * Create a resilient function with retry, rate limiting, and concurrency control
 */
export function createResilientFunction<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: {
    retry?: Partial<RetryConfig>;
    rateLimit?: RateLimiterConfig;
    maxConcurrent?: number;
  } = {}
): (...args: TArgs) => Promise<TResult> {
  let wrapped = fn;
  
  // Add retry
  if (options.retry) {
    wrapped = createRetryWrapper(wrapped, options.retry);
  }
  
  // Add rate limiting
  if (options.rateLimit) {
    const limiter = new RateLimiter(options.rateLimit);
    wrapped = withRateLimit(wrapped, limiter);
  }
  
  // Add concurrency control
  if (options.maxConcurrent) {
    const limiter = new ConcurrencyLimiter(options.maxConcurrent);
    const originalWrapped = wrapped;
    wrapped = async (...args: TArgs) => limiter.run(() => originalWrapped(...args));
  }
  
  return wrapped;
}

/**
 * Default rate limiter for API calls
 * - 60 requests per minute (1 per second)
 * - Burst of up to 10 requests
 */
export function createDefaultApiRateLimiter(): RateLimiter {
  return new RateLimiter({
    maxTokens: 10,
    tokensPerSecond: 1,
    maxWaitTime: 60000,
  });
}

/**
 * Default concurrency limiter for API calls
 */
export function createDefaultConcurrencyLimiter(): ConcurrencyLimiter {
  return new ConcurrencyLimiter(5);
}
