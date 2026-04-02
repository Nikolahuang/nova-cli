// ============================================================================
// Logger - Simple structured logging
// ============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
  source: string;
}

export class Logger {
  private level: LogLevel;
  private source: string;
  private history: LogEntry[] = [];
  private maxHistory: number;

  constructor(source: string, level: LogLevel = 'info', maxHistory: number = 1000) {
    this.source = source;
    this.level = level;
    this.maxHistory = maxHistory;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      source: this.source,
    };

    this.history.push(entry);
    if (this.history.length > this.maxHistory) this.history.shift();

    this.output(entry);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'silent'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private output(entry: LogEntry): void {
    const colors: Record<LogLevel, string> = {
      debug: '\x1b[36m', info: '\x1b[37m', warn: '\x1b[33m', error: '\x1b[31m', silent: '',
    };
    const reset = '\x1b[0m';
    const color = colors[entry.level];
    const prefix = `${entry.timestamp} [${entry.level.toUpperCase()}] [${entry.source}]`;

    if (entry.level === 'error') {
      console.error(`${color}${prefix}${reset} ${entry.message}`);
      if (entry.data) console.error(`${color}  Data: ${JSON.stringify(entry.data)}${reset}`);
    } else {
      console.log(`${color}${prefix}${reset} ${entry.message}`);
    }
  }

  getHistory(level?: LogLevel): LogEntry[] {
    if (level) return this.history.filter((e) => e.level === level);
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }
}

/** Create a named logger */
export function createLogger(source: string, level?: LogLevel): Logger {
  return new Logger(source, level);
}
