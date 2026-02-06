"use client"

import { useEffect, useRef } from "react"
import type { PlayerInitialState } from "@/lib/player-session"

type PlayerFrameProps = {
  contentUrl: string
  contentType: "SCORM" | "H5P"
  initialState: PlayerInitialState
  courseId: string
}

type TrackingPayload = {
  suspendData?: string
  lessonLocation?: string
  score?: number
  status?: string
  lesson_status?: string
  completion_status?: string
  cmiData?: Record<string, unknown>
  h5pState?: Record<string, unknown>
}

type TrackingMessage = {
  type: "PLAYER_STATE_UPDATE"
  payload: TrackingPayload
  flush?: boolean
}

const SAVE_THROTTLE_MS = 5000
const SCORM_API_SCRIPT_SRC = "/scripts/scorm-api.js"

function getStatus(payload: TrackingPayload): string | undefined {
  return payload.status ?? payload.lesson_status ?? payload.completion_status
}

export function PlayerFrame({ contentUrl, contentType, initialState, courseId }: PlayerFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const lastSentAtRef = useRef(0)
  const pendingRef = useRef<TrackingPayload | null>(null)
  const timerRef = useRef<number | null>(null)

  const sendInitialState = () => {
    const frame = frameRef.current
    if (!frame?.contentWindow || !contentUrl) return
    frame.contentWindow.postMessage(
      {
        type: "PLAYER_INITIAL_STATE",
        contentType,
        payload: initialState,
      },
      "*"
    )
  }

  const ensureScormApiOnParent = () => {
    if (document.getElementById("scorm-api-parent")) return
    const script = document.createElement("script")
    script.id = "scorm-api-parent"
    script.src = SCORM_API_SCRIPT_SRC
    script.async = false
    const target = document.head ?? document.documentElement
    target?.appendChild(script)
  }

  const injectScormApi = () => {
    ensureScormApiOnParent()
    const frame = frameRef.current
    if (!frame?.contentWindow) return

    let documentRef: Document | null = null
    try {
      documentRef = frame.contentDocument
    } catch {
      return
    }
    if (!documentRef || documentRef.getElementById("scorm-api-bridge")) return

    const script = documentRef.createElement("script")
    script.id = "scorm-api-bridge"
    script.src = SCORM_API_SCRIPT_SRC
    script.async = false
    const target = documentRef.head ?? documentRef.documentElement
    if (target) {
      target.appendChild(script)
    }
  }

  const injectH5PBridge = () => {
    const frame = frameRef.current
    if (!frame?.contentWindow) return

    let documentRef: Document | null = null
    try {
      documentRef = frame.contentDocument
    } catch {
      return
    }
    if (!documentRef || documentRef.getElementById("h5p-xapi-bridge")) return

    const script = documentRef.createElement("script")
    script.id = "h5p-xapi-bridge"
    script.text = `
(() => {
  if (window.__H5P_XAPI_BRIDGE__) return
  window.__H5P_XAPI_BRIDGE__ = true

  const postUpdate = (payload, flush) => {
    try {
      window.parent?.postMessage({ type: "PLAYER_STATE_UPDATE", payload, flush: !!flush }, "*")
    } catch {}
  }

  const mapStatement = (statement) => {
    const verbId = statement?.verb?.id || ""
    if (verbId.includes("completed")) {
      return { completion_status: "completed", status: "completed" }
    }
    if (verbId.includes("passed")) {
      return { status: "passed", completion_status: "completed" }
    }
    return {}
  }

  const attach = () => {
    if (!window.H5P || !window.H5P.externalDispatcher || !window.H5P.externalDispatcher.on) return false
    window.H5P.externalDispatcher.on("xAPI", (event) => {
      const statement = event?.data?.statement
      if (!statement) return
      const mapped = mapStatement(statement)
      const isTerminal = mapped.status === "completed" || mapped.status === "passed"
      postUpdate({ h5pState: { statement }, ...mapped }, isTerminal)
    })
    return true
  }

  if (!attach()) {
    let attempts = 0
    const timer = setInterval(() => {
      attempts += 1
      if (attach() || attempts > 20) {
        clearInterval(timer)
      }
    }, 500)
  }
})()
    `.trim()

    const target = documentRef.head ?? documentRef.documentElement
    if (target) {
      target.appendChild(script)
    }
  }

  const sendStateUpdate = async (payload: TrackingPayload) => {
    try {
      await fetch(`/api/course/${courseId}/state`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType,
          suspendData: payload.suspendData,
          lessonLocation: payload.lessonLocation,
          score: payload.score,
          lessonStatus: getStatus(payload),
          cmiData: payload.cmiData,
          h5pState: payload.h5pState,
        }),
      })
    } catch {
      pendingRef.current = payload
    }
  }

  const flushPending = (payload: TrackingPayload) => {
    lastSentAtRef.current = Date.now()
    pendingRef.current = null
    void sendStateUpdate(payload)
  }

  const scheduleSave = (payload: TrackingPayload) => {
    pendingRef.current = payload
    if (timerRef.current) return
    const elapsed = Date.now() - lastSentAtRef.current
    const delay = Math.max(0, SAVE_THROTTLE_MS - elapsed)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      if (pendingRef.current) {
        flushPending(pendingRef.current)
      }
    }, delay)
  }

  useEffect(() => {
    sendInitialState()
  }, [contentType, contentUrl, initialState])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    const handleLoad = () => {
      sendInitialState()
      if (contentType === "H5P") {
        injectH5PBridge()
      }
      if (contentType === "SCORM") {
        injectScormApi()
      }
    }

    frame.addEventListener("load", handleLoad)
    return () => {
      frame.removeEventListener("load", handleLoad)
    }
  }, [contentType, contentUrl, initialState])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const frameWindow = frameRef.current?.contentWindow
      if (event.source !== frameWindow && event.source !== window) return
      const data = event.data as TrackingMessage | undefined
      if (!data || typeof data !== "object" || data.type !== "PLAYER_STATE_UPDATE") return
      const payload = data.payload ?? {}
      const status = getStatus(payload)?.toLowerCase()
      const isTerminal = status === "completed" || status === "passed"

      if (isTerminal || data.flush) {
        if (timerRef.current) {
          window.clearTimeout(timerRef.current)
          timerRef.current = null
        }
        flushPending(payload)
        return
      }

      if (Date.now() - lastSentAtRef.current >= SAVE_THROTTLE_MS) {
        flushPending(payload)
      } else {
        scheduleSave(payload)
      }
    }

    window.addEventListener("message", handleMessage)
    return () => {
      window.removeEventListener("message", handleMessage)
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [contentType, courseId])

  if (!contentUrl) {
    return (
      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center text-sm text-muted-foreground">
        Course content is not available.
      </div>
    )
  }

  return (
    <iframe
      ref={frameRef}
      title="Course Player"
      src={contentUrl}
      className="aspect-video w-full rounded-lg border bg-background"
      allow="fullscreen"
    />
  )
}
