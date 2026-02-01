"use client"

import { useEffect, useRef, useState } from "react"
import { UI_MESSAGES } from "@/lib/ui-messages"

type CmiData = Record<string, unknown>

type ScormInitResponse = {
  enrollmentId: string
  cmiData: CmiData
  lastLocation: string
}

type ScormPlayerProps = {
  enrollmentId: string
  scormPath: string
}

type ScormApi = {
  LMSInitialize: (value?: string) => "true" | "false"
  LMSFinish: (value?: string) => "true" | "false"
  LMSGetValue: (key: string) => string
  LMSSetValue: (key: string, value: string) => "true" | "false"
  LMSCommit: (value?: string) => "true" | "false"
  LMSGetLastError: () => string
  LMSGetErrorString: (code: string) => string
  LMSGetDiagnostic: (code: string) => string
}

type Scorm2004Api = {
  Initialize: (value?: string) => "true" | "false"
  Terminate: (value?: string) => "true" | "false"
  GetValue: (key: string) => string
  SetValue: (key: string, value: string) => "true" | "false"
  Commit: (value?: string) => "true" | "false"
  GetLastError: () => string
  GetErrorString: (code: string) => string
  GetDiagnostic: (code: string) => string
}

type ScormError = {
  code: string
  message: string
}

const SCORM_ERRORS: Record<string, string> = {
  "0": "No error",
  "101": "General exception",
  "201": "Invalid argument error",
  "301": "Not initialized",
  "401": "Not implemented",
  "405": "Incorrect data type",
  "407": "Element value not initialized",
}

function getNestedValue(cmiData: CmiData, path: string): unknown {
  const parts = path.split(".")
  let current: unknown = cmiData
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function setNestedValue(cmiData: CmiData, path: string, value: unknown): void {
  const parts = path.split(".")
  let current: Record<string, unknown> = cmiData
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]
    if (i === parts.length - 1) {
      current[part] = value
    } else {
      const next = current[part]
      if (!next || typeof next !== "object") {
        current[part] = {}
      }
      current = current[part] as Record<string, unknown>
    }
  }
}

function ensureLocationDefaults(cmiData: CmiData, lastLocation?: string) {
  if (!lastLocation) return
  const existing12 = getNestedValue(cmiData, "cmi.core.lesson_location")
  const existing2004 = getNestedValue(cmiData, "cmi.location")
  if (!existing12) setNestedValue(cmiData, "cmi.core.lesson_location", lastLocation)
  if (!existing2004) setNestedValue(cmiData, "cmi.location", lastLocation)
}

export function ScormPlayer({ enrollmentId, scormPath }: ScormPlayerProps) {
  const [ready, setReady] = useState(false)
  const [initError, setInitError] = useState<ScormError | null>(null)
  const cmiRef = useRef<CmiData>({})
  const initializedRef = useRef(false)
  const dirtyRef = useRef(false)
  const commitTimerRef = useRef<number | null>(null)
  const lastErrorRef = useRef<string>("0")

  const commitNow = async (reason: string) => {
    if (!dirtyRef.current) return
    dirtyRef.current = false
    const payload = JSON.stringify({ cmiData: cmiRef.current, reason })
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" })
      navigator.sendBeacon(`/api/scorm/commit/${enrollmentId}`, blob)
      return
    }
    try {
      await fetch(`/api/scorm/commit/${enrollmentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      })
    } catch {
      dirtyRef.current = true
    }
  }

  const scheduleCommit = () => {
    if (commitTimerRef.current) window.clearTimeout(commitTimerRef.current)
    commitTimerRef.current = window.setTimeout(() => {
      void commitNow("auto")
    }, 5000)
  }

  const setErrorCode = (code: string) => {
    lastErrorRef.current = code
  }

  const createApi = (): ScormApi & Scorm2004Api => {
    const getValue = (key: string) => {
      if (!initializedRef.current) {
        setErrorCode("301")
        return ""
      }
      const value = getNestedValue(cmiRef.current, key)
      setErrorCode("0")
      if (value === undefined || value === null) return ""
      return String(value)
    }

    const setValue = (key: string, value: string) => {
      if (!initializedRef.current) {
        setErrorCode("301")
        return "false"
      }
      setNestedValue(cmiRef.current, key, value)
      if (key === "cmi.core.lesson_location" || key === "cmi.location") {
        setNestedValue(cmiRef.current, "cmi.core.lesson_location", value)
        setNestedValue(cmiRef.current, "cmi.location", value)
      }
      dirtyRef.current = true
      scheduleCommit()
      setErrorCode("0")
      return "true"
    }

    const commit = () => {
      void commitNow("commit")
      setErrorCode("0")
      return "true"
    }

    const terminate = () => {
      void commitNow("terminate")
      initializedRef.current = false
      setErrorCode("0")
      return "true"
    }

    const initialize = () => {
      initializedRef.current = true
      setErrorCode("0")
      return "true"
    }

    return {
      LMSInitialize: () => initialize(),
      LMSFinish: () => terminate(),
      LMSGetValue: getValue,
      LMSSetValue: setValue,
      LMSCommit: () => commit(),
      LMSGetLastError: () => lastErrorRef.current,
      LMSGetErrorString: (code: string) => SCORM_ERRORS[code] ?? "Unknown error",
      LMSGetDiagnostic: (code: string) => SCORM_ERRORS[code] ?? "Unknown error",
      Initialize: () => initialize(),
      Terminate: () => terminate(),
      GetValue: getValue,
      SetValue: setValue,
      Commit: () => commit(),
      GetLastError: () => lastErrorRef.current,
      GetErrorString: (code: string) => SCORM_ERRORS[code] ?? "Unknown error",
      GetDiagnostic: (code: string) => SCORM_ERRORS[code] ?? "Unknown error",
    }
  }

  useEffect(() => {
    let active = true

    const initialize = async () => {
      try {
        const res = await fetch(`/api/scorm/initialize/${enrollmentId}`)
        const data = (await res.json().catch(() => ({}))) as ScormInitResponse
        if (!res.ok) {
          throw new Error(data ? JSON.stringify(data) : "Failed to initialize")
        }
        cmiRef.current = data.cmiData ?? {}
        ensureLocationDefaults(cmiRef.current, data.lastLocation)
        if (!active) return
        const api = createApi()
        ;(window as Window & { API?: ScormApi }).API = api
        ;(window as Window & { API_1484_11?: Scorm2004Api }).API_1484_11 = api
        setReady(true)
      } catch (e) {
        if (!active) return
        setInitError({
          code: "101",
          message: e instanceof Error ? e.message : UI_MESSAGES.scorm.initFailedFallback,
        })
      }
    }

    initialize()

    const handleUnload = () => {
      void commitNow("unload")
    }
    window.addEventListener("beforeunload", handleUnload)
    return () => {
      active = false
      window.removeEventListener("beforeunload", handleUnload)
      if (commitTimerRef.current) {
        window.clearTimeout(commitTimerRef.current)
      }
      const apiWindow = window as Window & { API?: ScormApi; API_1484_11?: Scorm2004Api }
      delete apiWindow.API
      delete apiWindow.API_1484_11
    }
  }, [enrollmentId])

  if (initError) {
    return (
      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center text-sm text-destructive">
        {UI_MESSAGES.scorm.initFailedTitle}: {initError.message}
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center text-sm text-muted-foreground">
        {UI_MESSAGES.scorm.loading}
      </div>
    )
  }

  return (
    <iframe
      title={UI_MESSAGES.scorm.playerTitle}
      src={scormPath}
      className="aspect-video w-full rounded-lg border bg-background"
      allow="fullscreen"
    />
  )
}
