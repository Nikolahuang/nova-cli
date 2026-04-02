// ============================================================================
// TelemetryService - Observability and metrics collection
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createLogger } from '../utils/Logger.js';

const logger = createLogger('TelemetryService');

// ============================================================================
// Types
// ============================================================================

/**
 * Metric types
 */
export type MetricType = 'counter' | 'gauge' | 'histogram';

/**
 * Metric value
 */
export interface MetricValue {
  name: string;
  type: MetricType;
  value: number;
  timestamp: Date;
  labels: Record<string, string>;
}

/**
 * Metric definition
 */
export interface MetricDefinition {
  name: string;
  type: MetricType;
  description: string;
  unit?: string;
  labels?: string[];
}

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  enabled: boolean;
  serviceName: string;
  exportInterval: number;  // milliseconds
  storageDir: string;
  exporters: ('file' | 'prometheus')[];
}

// ============================================================================
// Built-in Metrics
// ============================================================================

const BUILTIN_METRICS: MetricDefinition[] = [
  { name: 'nova_requests_total', type: 'counter', description: 'Total number of requests' },
  { name: 'nova_request_duration_ms', type: 'histogram', description: 'Request duration in milliseconds' },
  { name: 'nova_tokens_input_total', type: 'counter', description: 'Total input tokens used' },
  { name: 'nova_tokens_output_total', type: 'counter', description: 'Total output tokens used' },
  { name: 'nova_tool_calls_total', type: 'counter', description: 'Total tool calls' },
  { name: 'nova_tool_duration_ms', type: 'histogram', description: 'Tool execution duration' },
  { name: 'nova_errors_total', type: 'counter', description: 'Total errors' },
  { name: 'nova_context_compressions_total', type: 'counter', description: 'Context compression count' },
  { name: 'nova_session_count', type: 'gauge', description: 'Active sessions' },
  { name: 'nova_memory_usage_bytes', type: 'gauge', description: 'Memory usage in bytes' },
];

// ============================================================================
// TelemetryService
// ============================================================================

/**
 * Telemetry and observability service
 */
export class TelemetryService {
  private config: TelemetryConfig;
  private metrics: Map<string, MetricValue[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private exportInterval: NodeJS.Timeout | null = null;
  
  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      serviceName: config.serviceName ?? 'nova-cli',
      exportInterval: config.exportInterval ?? 60000,
      storageDir: config.storageDir ?? path.join(process.env.HOME ?? '~', '.nova', 'telemetry'),
      exporters: config.exporters ?? ['file'],
    };
    
    // Initialize built-in metrics
    for (const metric of BUILTIN_METRICS) {
      this.registerMetric(metric);
    }
    
    // Ensure storage directory exists
    if (!fs.existsSync(this.config.storageDir)) {
      fs.mkdirSync(this.config.storageDir, { recursive: true });
    }
    
    // Start export interval
    if (this.config.enabled) {
      this.exportInterval = setInterval(() => this.export(), this.config.exportInterval);
    }
    
    // Export on exit
    process.on('beforeExit', () => this.export());
  }
  
  // -----------------------------------------------------------------------
  // Metric Registration
  // -----------------------------------------------------------------------
  
  /**
   * Register a new metric
   */
  registerMetric(definition: MetricDefinition): void {
    if (!this.metrics.has(definition.name)) {
      this.metrics.set(definition.name, []);
    }
    logger.debug(`Registered metric: ${definition.name}`);
  }
  
  // -----------------------------------------------------------------------
  // Recording Metrics
  // -----------------------------------------------------------------------
  
  /**
   * Increment a counter
   */
  incrementCounter(name: string, value: number = 1, labels: Record<string, string> = {}): void {
    if (!this.config.enabled) return;
    
    const key = this.getMetricKey(name, labels);
    const current = this.counters.get(key) ?? 0;
    this.counters.set(key, current + value);
    
    this.recordMetric(name, 'counter', current + value, labels);
  }
  
  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    if (!this.config.enabled) return;
    
    const key = this.getMetricKey(name, labels);
    this.gauges.set(key, value);
    
    this.recordMetric(name, 'gauge', value, labels);
  }
  
  /**
   * Record a histogram observation
   */
  observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    if (!this.config.enabled) return;
    
    const key = this.getMetricKey(name, labels);
    const values = this.histograms.get(key) ?? [];
    values.push(value);
    
    // Keep only last 1000 observations
    if (values.length > 1000) {
      values.shift();
    }
    
    this.histograms.set(key, values);
    this.recordMetric(name, 'histogram', value, labels);
  }
  
  /**
   * Record a timing
   */
  recordTiming(name: string, durationMs: number, labels: Record<string, string> = {}): void {
    this.observeHistogram(name, durationMs, labels);
  }
  
  /**
   * Time an async function
   */
  async time<T>(name: string, fn: () => Promise<T>, labels: Record<string, string> = {}): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.recordTiming(name, Date.now() - start, labels);
      return result;
    } catch (error) {
      this.recordTiming(name, Date.now() - start, { ...labels, error: 'true' });
      throw error;
    }
  }
  
  // -----------------------------------------------------------------------
  // Convenience Methods
  // -----------------------------------------------------------------------
  
  /**
   * Record a model API call
   */
  recordModelCall(
    model: string,
    provider: string,
    inputTokens: number,
    outputTokens: number,
    durationMs: number
  ): void {
    const labels = { model, provider };
    
    this.incrementCounter('nova_requests_total', 1, labels);
    this.recordTiming('nova_request_duration_ms', durationMs, labels);
    this.incrementCounter('nova_tokens_input_total', inputTokens, labels);
    this.incrementCounter('nova_tokens_output_total', outputTokens, labels);
  }
  
  /**
   * Record a tool call
   */
  recordToolCall(toolName: string, durationMs: number, success: boolean): void {
    const labels = { tool: toolName, success: success.toString() };
    
    this.incrementCounter('nova_tool_calls_total', 1, labels);
    this.recordTiming('nova_tool_duration_ms', durationMs, labels);
    
    if (!success) {
      this.incrementCounter('nova_errors_total', 1, { type: 'tool', tool: toolName });
    }
  }
  
  /**
   * Record an error
   */
  recordError(type: string, message: string): void {
    this.incrementCounter('nova_errors_total', 1, { type, message: message.slice(0, 100) });
  }
  
  /**
   * Update session count
   */
  updateSessionCount(count: number): void {
    this.setGauge('nova_session_count', count);
  }
  
  // -----------------------------------------------------------------------
  // Export
  // -----------------------------------------------------------------------
  
  /**
   * Export metrics to configured exporters
   */
  export(): void {
    if (!this.config.enabled) return;
    
    for (const exporter of this.config.exporters) {
      switch (exporter) {
        case 'file':
          this.exportToFile();
          break;
        case 'prometheus':
          this.exportToPrometheus();
          break;
      }
    }
  }
  
  /**
   * Export to file
   */
  private exportToFile(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `metrics-${timestamp}.json`;
    const filepath = path.join(this.config.storageDir, filename);
    
    const data = {
      timestamp: new Date().toISOString(),
      serviceName: this.config.serviceName,
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([k, v]) => [
          k,
          {
            count: v.length,
            sum: v.reduce((a, b) => a + b, 0),
            min: Math.min(...v),
            max: Math.max(...v),
            avg: v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : 0,
            p50: this.percentile(v, 50),
            p95: this.percentile(v, 95),
            p99: this.percentile(v, 99),
          },
        ])
      ),
    };
    
    try {
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
      logger.debug(`Exported metrics to ${filepath}`);
      
      // Clean up old files (keep last 100)
      this.cleanupOldFiles(100);
    } catch (error) {
      logger.error('Failed to export metrics', { error });
    }
  }
  
  /**
   * Export in Prometheus format
   */
  private exportToPrometheus(): void {
    // Prometheus format text file for scraping
    const lines: string[] = [];
    
    // Counters
    for (const [key, value] of this.counters) {
      const [name, labelsStr] = this.parseMetricKey(key);
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name}${labelsStr} ${value}`);
    }
    
    // Gauges
    for (const [key, value] of this.gauges) {
      const [name, labelsStr] = this.parseMetricKey(key);
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name}${labelsStr} ${value}`);
    }
    
    // Histograms
    for (const [key, values] of this.histograms) {
      const [name, labelsStr] = this.parseMetricKey(key);
      lines.push(`# TYPE ${name} histogram`);
      
      const sum = values.reduce((a, b) => a + b, 0);
      const count = values.length;
      
      lines.push(`${name}_sum${labelsStr} ${sum}`);
      lines.push(`${name}_count${labelsStr} ${count}`);
    }
    
    const filepath = path.join(this.config.storageDir, 'prometheus.txt');
    try {
      fs.writeFileSync(filepath, lines.join('\n'), 'utf-8');
    } catch (error) {
      logger.error('Failed to export Prometheus metrics', { error });
    }
  }
  
  // -----------------------------------------------------------------------
  // Querying
  // -----------------------------------------------------------------------
  
  /**
   * Get current metric values
   */
  getMetric(name: string): MetricValue[] {
    return this.metrics.get(name) ?? [];
  }
  
  /**
   * Get all metric values
   */
  getAllMetrics(): Map<string, MetricValue[]> {
    return new Map(this.metrics);
  }
  
  /**
   * Get summary statistics
   */
  getSummary(): {
    totalRequests: number;
    totalTokens: { input: number; output: number };
    totalToolCalls: number;
    totalErrors: number;
    avgRequestDuration: number;
  } {
    const totalRequests = Array.from(this.counters.entries())
      .filter(([k]) => k.startsWith('nova_requests_total'))
      .reduce((sum, [, v]) => sum + v, 0);
    
    const totalInputTokens = Array.from(this.counters.entries())
      .filter(([k]) => k.startsWith('nova_tokens_input_total'))
      .reduce((sum, [, v]) => sum + v, 0);
    
    const totalOutputTokens = Array.from(this.counters.entries())
      .filter(([k]) => k.startsWith('nova_tokens_output_total'))
      .reduce((sum, [, v]) => sum + v, 0);
    
    const totalToolCalls = Array.from(this.counters.entries())
      .filter(([k]) => k.startsWith('nova_tool_calls_total'))
      .reduce((sum, [, v]) => sum + v, 0);
    
    const totalErrors = Array.from(this.counters.entries())
      .filter(([k]) => k.startsWith('nova_errors_total'))
      .reduce((sum, [, v]) => sum + v, 0);
    
    // Calculate average request duration
    const durations: number[] = [];
    for (const [, values] of this.histograms) {
      durations.push(...values);
    }
    const avgRequestDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;
    
    return {
      totalRequests,
      totalTokens: { input: totalInputTokens, output: totalOutputTokens },
      totalToolCalls,
      totalErrors,
      avgRequestDuration,
    };
  }
  
  // -----------------------------------------------------------------------
  // Utilities
  // -----------------------------------------------------------------------
  
  /**
   * Get metric key with labels
   */
  private getMetricKey(name: string, labels: Record<string, string>): string {
    if (Object.keys(labels).length === 0) return name;
    const labelsStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelsStr}}`;
  }
  
  /**
   * Parse metric key to name and labels string
   */
  private parseMetricKey(key: string): [string, string] {
    const match = key.match(/^([a-zA-Z_]+)(\{.*\})?$/);
    if (!match || !match[1]) return [key, ''];
    return [match[1], match[2] || ''];
  }
  
  /**
   * Record a metric value
   */
  private recordMetric(
    name: string,
    type: MetricType,
    value: number,
    labels: Record<string, string>
  ): void {
    const values = this.metrics.get(name) ?? [];
    values.push({
      name,
      type,
      value,
      timestamp: new Date(),
      labels,
    });
    
    // Keep only last 1000 values
    if (values.length > 1000) {
      values.shift();
    }
    
    this.metrics.set(name, values);
  }
  
  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)] ?? 0;
  }
  
  /**
   * Clean up old files
   */
  private cleanupOldFiles(keep: number): void {
    try {
      const files = fs.readdirSync(this.config.storageDir)
        .filter(f => f.startsWith('metrics-') && f.endsWith('.json'))
        .sort()
        .reverse();
      
      for (let i = keep; i < files.length; i++) {
        const file = files[i];
        if (file) {
          fs.unlinkSync(path.join(this.config.storageDir, file));
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }
  
  /**
   * Shutdown telemetry
   */
  shutdown(): void {
    if (this.exportInterval) {
      clearInterval(this.exportInterval);
      this.exportInterval = null;
    }
    this.export();
  }
}

// ============================================================================
// Factory function
// ============================================================================

let defaultInstance: TelemetryService | null = null;

/**
 * Get the default telemetry service instance
 */
export function getTelemetry(): TelemetryService {
  if (!defaultInstance) {
    defaultInstance = new TelemetryService();
  }
  return defaultInstance;
}

/**
 * Create a new telemetry service
 */
export function createTelemetry(config: Partial<TelemetryConfig> = {}): TelemetryService {
  return new TelemetryService(config);
}
