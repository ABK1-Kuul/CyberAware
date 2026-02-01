import { logger } from "@/lib/logger"

export function logApiRequest(request: Request): void {
  const url = new URL(request.url)
  const method = request.method
  const userAgent = request.headers.get("user-agent") ?? "unknown"
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "unknown"
  logger.info("API request", {
    method,
    path: url.pathname,
    query: url.search || undefined,
    ip: forwardedFor,
    userAgent,
  })
}
