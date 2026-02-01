export type CmiData = Record<string, unknown>

export type ScormSummary = {
  completionStatus: string | null
  successStatus: string | null
  scoreRaw: number | null
  scoreMin: number | null
  scoreMax: number | null
  progressMeasure: number | null
  totalTimeSeconds: number | null
  sessionTimeSeconds: number | null
  lastLocation: string | null
}

function normalizeStatus(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  return trimmed ? trimmed : null
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function getNestedValue(cmiData: CmiData, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = cmiData
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function getFirstValue(cmiData: CmiData, paths: string[]): unknown {
  for (const path of paths) {
    const value = getNestedValue(cmiData, path)
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }
  return undefined
}

function parseScorm12Time(value: string): number | null {
  const match = value.match(/^(\d{1,4}):(\d{2}):(\d{2})(?:\.(\d{1,2}))?$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  const fractional = match[4] ? Number(`0.${match[4]}`) : 0
  if (![hours, minutes, seconds, fractional].every(Number.isFinite)) return null
  return hours * 3600 + minutes * 60 + seconds + fractional
}

function parseScorm2004Duration(value: string): number | null {
  const match = value.match(
    /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/
  )
  if (!match) return null
  const years = match[1] ? Number(match[1]) : 0
  const months = match[2] ? Number(match[2]) : 0
  const days = match[3] ? Number(match[3]) : 0
  const hours = match[4] ? Number(match[4]) : 0
  const minutes = match[5] ? Number(match[5]) : 0
  const seconds = match[6] ? Number(match[6]) : 0
  if (![years, months, days, hours, minutes, seconds].every(Number.isFinite)) return null
  if (years > 0 || months > 0) {
    return null
  }
  return days * 86400 + hours * 3600 + minutes * 60 + seconds
}

export function parseScormTimeToSeconds(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const trimmed = value.trim()
  return parseScorm12Time(trimmed) ?? parseScorm2004Duration(trimmed)
}

function deriveCompletionStatus(
  completionStatus: string | null,
  lessonStatus: string | null
): string | null {
  if (completionStatus) return completionStatus
  if (!lessonStatus) return null
  if (['passed', 'failed', 'completed'].includes(lessonStatus)) return 'completed'
  if (['incomplete', 'browsed', 'not attempted'].includes(lessonStatus)) return 'incomplete'
  return lessonStatus
}

function deriveSuccessStatus(successStatus: string | null, lessonStatus: string | null): string | null {
  if (successStatus) return successStatus
  if (!lessonStatus) return null
  if (lessonStatus === 'passed' || lessonStatus === 'failed') return lessonStatus
  return null
}

export function summarizeCmiData(cmiData: CmiData): ScormSummary {
  const lessonStatus = normalizeStatus(
    getFirstValue(cmiData, ['cmi.core.lesson_status', 'cmi.lesson_status'])
  )
  const completionStatus = normalizeStatus(
    getFirstValue(cmiData, ['cmi.completion_status'])
  )
  const successStatus = normalizeStatus(getFirstValue(cmiData, ['cmi.success_status']))
  const progressMeasure = parseNumber(getFirstValue(cmiData, ['cmi.progress_measure']))
  const scoreRaw = parseNumber(
    getFirstValue(cmiData, ['cmi.core.score.raw', 'cmi.score.raw'])
  )
  const scoreMin = parseNumber(
    getFirstValue(cmiData, ['cmi.core.score.min', 'cmi.score.min'])
  )
  const scoreMax = parseNumber(
    getFirstValue(cmiData, ['cmi.core.score.max', 'cmi.score.max'])
  )
  const totalTimeSeconds = parseScormTimeToSeconds(
    getFirstValue(cmiData, ['cmi.core.total_time', 'cmi.total_time'])
  )
  const sessionTimeSeconds = parseScormTimeToSeconds(
    getFirstValue(cmiData, ['cmi.core.session_time', 'cmi.session_time'])
  )
  const lastLocation = normalizeStatus(
    getFirstValue(cmiData, ['cmi.core.lesson_location', 'cmi.location'])
  )
  return {
    completionStatus: deriveCompletionStatus(completionStatus, lessonStatus),
    successStatus: deriveSuccessStatus(successStatus, lessonStatus),
    scoreRaw,
    scoreMin,
    scoreMax,
    progressMeasure,
    totalTimeSeconds,
    sessionTimeSeconds,
    lastLocation,
  }
}

export function isCompletionMet(completionStatus: string | null, successStatus: string | null): boolean {
  const normalizedCompletion = normalizeStatus(completionStatus)
  if (normalizedCompletion === 'completed' || normalizedCompletion === 'complete') return true
  const normalizedSuccess = normalizeStatus(successStatus)
  if (normalizedSuccess === 'passed' || normalizedSuccess === 'failed') return true
  return false
}
