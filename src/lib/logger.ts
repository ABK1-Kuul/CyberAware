/**
 * Minimal structured logger. Use for app-level logging instead of console.
 * In production, replace with Winston, Pino, or Sentry.
 */

type LogContext = Record<string, unknown>

function serializeContext(ctx: LogContext): string {
  const safe: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(ctx)) {
    if (v instanceof Error) {
      safe[k] = { name: v.name, message: v.message }
    } else {
      safe[k] = v
    }
  }
  return Object.keys(safe).length > 0 ? ` ${JSON.stringify(safe)}` : ''
}

function formatMessage(level: string, message: string, context?: LogContext): string {
  const ts = new Date().toISOString()
  const ctx = context ? serializeContext(context) : ''
  return `${ts} [${level}] ${message}${ctx}`
}

export const logger = {
  info(message: string, context?: LogContext): void {
    console.info(formatMessage('INFO', message, context))
  },

  warn(message: string, context?: LogContext): void {
    console.warn(formatMessage('WARN', message, context))
  },

  error(message: string, context?: LogContext): void {
    console.error(formatMessage('ERROR', message, context))
  },
}
