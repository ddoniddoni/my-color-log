type LogContext = Record<string, string | number | boolean | undefined>;

export function logError(operation: string, context: LogContext): void {
  if (__DEV__) console.warn(`[mycolorlog] ${operation}`, context);
}
