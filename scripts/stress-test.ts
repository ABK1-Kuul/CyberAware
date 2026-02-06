// Env: BASE_URL, COURSE_ID, SESSION_AUTH | MAGIC_TOKEN | SSO_ID, USER_AGENT
type StressResult = {
  index: number
  status: number
  ms: number
  ok: boolean
}

function buildHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": process.env.USER_AGENT ?? "CyberAwareStress/1.0",
  }

  const sessionAuth = process.env.SESSION_AUTH
  if (sessionAuth) {
    headers.cookie = `session_auth=${sessionAuth}`
  }

  const ssoId = process.env.SSO_ID
  if (ssoId) {
    headers["x-sso-id"] = ssoId
  }

  return headers
}

function buildUrl(baseUrl: string, courseId: string) {
  const url = new URL(`/api/course/${courseId}/state`, baseUrl)
  const token = process.env.MAGIC_TOKEN
  if (token) {
    url.searchParams.set("token", token)
  }
  return url.toString()
}

async function runRequest(url: string, headers: Record<string, string>, index: number) {
  const payload = {
    contentType: "SCORM",
    cmiData: {
      cmi: {
        success_status: "passed",
        suspend_data: `stress-${index}`,
      },
    },
    score: 95,
  }

  const startedAt = Date.now()
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  })
  const elapsed = Date.now() - startedAt
  return {
    index,
    status: response.status,
    ms: elapsed,
    ok: response.ok,
  }
}

async function main() {
  const baseUrl = process.env.BASE_URL ?? "http://localhost:9002"
  const courseId = process.env.COURSE_ID
  if (!courseId) {
    console.error("COURSE_ID is required.")
    process.exit(1)
  }

  const url = buildUrl(baseUrl, courseId)
  const headers = buildHeaders()

  console.log(`Sending 10 concurrent requests to ${url}`)
  const requests = Array.from({ length: 10 }, (_, index) =>
    runRequest(url, headers, index + 1)
  )

  const results = await Promise.all(requests)
  const summary: StressResult[] = results.map((result) => ({
    index: result.index,
    status: result.status,
    ms: result.ms,
    ok: result.ok,
  }))

  console.table(summary)

  const serverErrors = summary.filter((result) => result.status >= 500)
  if (serverErrors.length) {
    console.error("Detected 500+ responses:", serverErrors)
    process.exit(1)
  }

  console.log("Stress test completed with no 500 errors.")
  console.log("Check server logs to confirm the 3-at-a-time queue behavior.")
}

main().catch((error) => {
  console.error("Stress test failed:", error)
  process.exit(1)
})
