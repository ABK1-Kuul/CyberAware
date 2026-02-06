import { headers, cookies } from "next/headers"
import { redirect } from "next/navigation"
import { PlayerFrame } from "@/components/app/player/player-frame"
import { resolvePlayerSession } from "@/lib/player-session"

function buildCookieHeader(): string {
  const store = cookies()
  return store
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ")
}

function buildRequest(courseId: string): Request {
  const headerList = headers()
  const reqHeaders = new Headers()
  const userAgent = headerList.get("user-agent")
  const forwarded = headerList.get("x-forwarded-for")
  if (userAgent) reqHeaders.set("user-agent", userAgent)
  if (forwarded) reqHeaders.set("x-forwarded-for", forwarded)
  const cookieHeader = buildCookieHeader()
  if (cookieHeader) reqHeaders.set("cookie", cookieHeader)
  return new Request(`http://local.player/${courseId}`, { headers: reqHeaders })
}

export default async function PlayerPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const request = buildRequest(courseId)
  const result = await resolvePlayerSession(request, courseId)

  if (!result.ok) {
    redirect(result.redirectTo)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        <PlayerFrame
          contentUrl={result.contentUrl}
          contentType={result.contentType}
          initialState={result.initialState}
          courseId={courseId}
        />
      </div>
    </div>
  )
}
