"use client"

import { useEffect, useRef } from "react"
import type { PlayerInitialState } from "@/lib/player-session"

type PlayerFrameProps = {
  contentUrl: string
  contentType: "SCORM" | "H5P"
  initialState: PlayerInitialState
}

export function PlayerFrame({ contentUrl, contentType, initialState }: PlayerFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!contentUrl) return
    const frame = frameRef.current
    if (!frame?.contentWindow) return
    frame.contentWindow.postMessage(
      {
        type: "PLAYER_INITIAL_STATE",
        contentType,
        payload: initialState,
      },
      "*"
    )
  }, [contentType, contentUrl, initialState])

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
