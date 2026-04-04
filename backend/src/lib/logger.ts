import { config } from "../config.js";

type LogLevel = "debug" | "info" | "warn" | "error";

const levelWeight: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function shouldLog(level: LogLevel): boolean {
  return levelWeight[level] >= levelWeight[config.LOG_LEVEL];
}

function log(level: LogLevel, message: string, meta?: unknown): void {
  if (!shouldLog(level)) {
    return;
  }

  const prefix = `[${new Date().toISOString()}] ${level.toUpperCase()}`;

  if (meta === undefined) {
    console.log(prefix, message);
    return;
  }

  console.log(prefix, message, meta);
}

export const logger = {
  debug(message: string, meta?: unknown) {
    log("debug", message, meta);
  },
  info(message: string, meta?: unknown) {
    log("info", message, meta);
  },
  warn(message: string, meta?: unknown) {
    log("warn", message, meta);
  },
  error(message: string, meta?: unknown) {
    log("error", message, meta);
  }
};

