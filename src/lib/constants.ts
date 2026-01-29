/** Number of days shown in the dashboard completion chart. */
export const DASHBOARD_CHART_DAYS = 30

/** Default pagination page (1-based). */
export const DEFAULT_PAGE = 1

/** Default pagination page size. */
export const DEFAULT_PAGE_SIZE = 10

/** Progress lower bound (inclusive). */
export const PROGRESS_MIN = 0

/** Progress upper bound (inclusive). */
export const PROGRESS_MAX = 100

/** Clamps progress to [PROGRESS_MIN, PROGRESS_MAX]. */
export function clampProgress(value: number): number {
  return Math.min(PROGRESS_MAX, Math.max(PROGRESS_MIN, Math.round(value)))
}
