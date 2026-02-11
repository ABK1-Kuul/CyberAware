import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const AUTH_COOKIE_NAMES = ["session_auth", "auth_token"]

export function middleware(request: NextRequest) {
  const hasToken = AUTH_COOKIE_NAMES.some(
    (name) => Boolean(request.cookies.get(name)?.value)
  )

  if (!hasToken) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/learn/:path*"],
}
