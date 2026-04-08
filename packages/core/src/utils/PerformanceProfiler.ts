// ============================================================================
// PerformanceProfiler - Performance profiling and benchmarking utilities
// ============================================================================

import { performance } from 'perf_hooks';

export interface BenchmarkResult {
  name: string;
  duration: number;
  iterations: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  memoryUsage?: number;
}

export interface ProfilePoint {
  name: string;
  timestamp: number;
  memoryUsage: number;
}

export class PerformanceProfiler {
  private static instance: PerformanceProfiler;
  private benchmarks = new Map<string, BenchmarkResult>();
  private profilePoints = new Map<string, ProfilePoint[]>();
  private isProfiling = false;

  private constructor() {}

  static getInstance(): PerformanceProfiler {
    if (!PerformanceProfiler.instance) {
      PerformanceProfiler.instance = new PerformanceProfiler();
    }
    return PerformanceProfiler.instance;
  }

  /**
   * Start a benchmark
   */
  startBenchmark(name: string): () => BenchmarkResult {
    const start = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    return () => {
      const end = performance.now();
      const endMemory = process.memoryUsage().heapUsed;
      const duration = end - start;
      const memoryUsage = endMemory - startMemory;

      const result: BenchmarkResult = {
        name,
        duration,
        iterations: 1,
        avgDuration: duration,
        minDuration: duration,
        maxDuration: duration,
        memoryUsage,
      };

      this.benchmarks.set(name, result);
      return result;
    };
  }

  /**
   * Benchmark an async function
   */
  async benchmarkAsync<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; benchmark: BenchmarkResult }> {
    const end = this.startBenchmark(name);
    const result = await fn();
    const benchmark = end();
    return { result, benchmark };
  }

  /**
   * Benchmark a synchronous function
   */
  benchmarkSync<T>(name: string, fn: () => T): { result: T; benchmark: BenchmarkResult } {
    const end = this.startBenchmark(name);
    const result = fn();
    const benchmark = end();
    return { result, benchmark };
  }

  /**
   * Start profiling
   */
  startProfiling(name: string): void {
    this.isProfiling = true;
    this.profilePoints.set(name, []);
    
    // Record initial point
    this.recordProfilePoint(name, 'start');
  }

  /**
   * Record a profile point
   */
  recordProfilePoint(name: string, pointName: string): void {
    if (!this.isProfiling || !this.profilePoints.has(name)) {
      return;
    }

    const memoryUsage = process.memoryUsage().heapUsed;
    const points = this.profilePoints.get(name)!;
    
    points.push({
      name: pointName,
      timestamp: performance.now(),
      memoryUsage,
    });
  }

  /**
   * Stop profiling and get results
   */
  stopProfiling(name: string): Array<{ from: string; to: string; duration: number; memoryDelta: number }> {
    this.isProfiling = false;
    this.recordProfilePoint(name, 'end');

    const points = this.profilePoints.get(name) || [];
    const results: Array<{ from: string; to: string; duration: number; memoryDelta: number }> = [];

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      
      results.push({
        from: prev.name,
        to: curr.name,
        duration: curr.timestamp - prev.timestamp,
        memoryDelta: curr.memoryUsage - prev.memoryUsage,
      });
    }

    return results;
  }

  /**
   * Get all benchmark results
   */
  getBenchmarks(): BenchmarkResult[] {
    return Array.from(this.benchmarks.values());
  }

  /**
   * Get benchmark by name
   */
  getBenchmark(name: string): BenchmarkResult | undefined {
    return this.benchmarks.get(name);
  }

  /**
   * Clear all benchmarks
   */
  clearBenchmarks(): void {
    this.benchmarks.clear();
  }

  /**
   * Print benchmark results
   */
  printBenchmarks(): void {
    console.log('\n=== Performance Benchmarks ===');
    for (const benchmark of this.benchmarks.values()) {
      console.log(
        `${benchmark.name}: ${benchmark.avgDuration.toFixed(2)}ms ` +
        `(min: ${benchmark.minDuration.toFixed(2)}ms, max: ${benchmark.maxDuration.toFixed(2)}ms)` +
        (benchmark.memoryUsage ? ` [memory: ${(benchmark.memoryUsage / 1024 / 1024).toFixed(2)}MB]` : '')
      );
    }
  }

  /**
   * Print profiling results
   */
  printProfiling(name: string): void {
    const results = this.stopProfiling(name);
    console.log(`\n=== Profiling: ${name} ===`);
    
    let totalDuration = 0;
    let totalMemory = 0;
    
    for (const result of results) {
      totalDuration += result.duration;
      totalMemory += result.memoryDelta;
      
      console.log(
        `${result.from} → ${result.to}: ${result.duration.toFixed(2)}ms ` +
        `[memory: ${(result.memoryDelta / 1024 / 1024).toFixed(2)}MB]`
      );
    }
    
    console.log(
      `Total: ${totalDuration.toFixed(2)}ms ` +
      `[memory: ${(totalMemory / 1024 / 1024).toFixed(2)}MB]`
    );
  }
}

// Export singleton instance
export const profiler = PerformanceProfiler.getInstance();