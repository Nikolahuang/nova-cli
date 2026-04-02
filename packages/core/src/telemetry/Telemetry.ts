// ============================================================================
// Telemetry - Anonymous usage tracking
// ============================================================================

import { randomBytes } from 'node:crypto';
import type { TelemetryConfig } from '../types/config.js';

export interface TelemetryEvent {
  event: string;
  properties: Record<string, unknown>;
  timestamp: number;
}

export class Telemetry {
  private config: TelemetryConfig;
  private queue: TelemetryEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private clientId: string;

  constructor(config: TelemetryConfig) {
    this.config = config;
    this.clientId = config.clientId || randomBytes(16).toString('hex');
  }

  /** Track an event */
  track(event: string, properties: Record<string, unknown> = {}): void {
    if (!this.config.enabled) return;

    const shouldTrack = (
      (event.startsWith('usage') && this.config.track?.usage) ||
      (event.startsWith('error') && this.config.track?.errors) ||
      (event.startsWith('performance') && this.config.track?.performance)
    );

    if (!shouldTrack) return;

    this.queue.push({
      event,
      properties: { ...properties, clientId: this.clientId, version: '0.1.0' },
      timestamp: Date.now(),
    });

    if (this.queue.length >= 10) this.flush();
  }

  /** Flush queued events */
  async flush(): Promise<void> {
    if (!this.config.enabled || this.queue.length === 0) return;

    const events = [...this.queue];
    this.queue = [];

    if (this.config.endpoint) {
      try {
        await fetch(this.config.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events }),
        });
      } catch {
        // Silently fail
      }
    }
  }

  /** Start periodic flushing */
  startAutoFlush(intervalMs: number = 60000): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => this.flush(), intervalMs);
  }

  /** Stop periodic flushing */
  stopAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /** Disable telemetry */
  disable(): void {
    this.config.enabled = false;
    this.stopAutoFlush();
    this.queue = [];
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }
}
