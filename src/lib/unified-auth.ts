import { prisma } from "@/lib/prisma"
import { createHash } from "crypto"
import { signJwt, verifyJwt, type JwtPayload } from "@/lib/jwt"

export type UnifiedAuthType = "sso" | "magic-token"

export type UnifiedAuthUser = {
  id: string
  name: string
  email: string
  role: string
  team: string
  avatarUrl: string
}

export type UnifiedAuthContext = {
  user: UnifiedAuthUser
  authType: UnifiedAuthType
  clientIp: string
  userAgent: string
  sessionCourseId?: string
}

export type UnifiedAuthError = {
  status: number
  message: string
}

function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for") ?? "unknown"
}

function getUserAgent(request: Request): string {
  return request.headers.get("user-agent") ?? "unknown"
}

function getQueryToken(request: Request): string | null {
  const url = new URL(request.url)
  const token = url.searchParams.get("token")
  return token && token.trim() ? token.trim() : null
}

function getCookieValue(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie")
  if (!cookie) return null
  const match = cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`))
  if (!match) return null
  const value = match.slice(name.length + 1)
  return value ? decodeURIComponent(value) : null
}

function getSsoSubject(request: Request): string | null {
  const headerSubject = request.headers.get("x-sso-id")
  if (headerSubject && headerSubject.trim()) return headerSubject.trim()
  const cookieSubject = getCookieValue(request, "sso_id")
  return cookieSubject && cookieSubject.trim() ? cookieSubject.trim() : null
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET is required.")
  }
  return secret
}

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex")
}

function getSessionToken(request: Request): string | null {
  return getCookieValue(request, "session_auth")
}

async function getUserById(userId: string): Promise<UnifiedAuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      team: true,
      avatarUrl: true,
    },
  })
  if (!user) return null
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    team: user.team,
    avatarUrl: user.avatarUrl,
  }
}

async function validatePinnedSession({
  courseId,
  userId,
  clientIp,
  userAgent,
}: {
  courseId: string
  userId: string
  clientIp: string
  userAgent: string
}): Promise<boolean> {
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId,
        courseId,
      },
    },
    select: { id: true },
  })
  if (!enrollment) return false
  const session = await prisma.courseSession.findFirst({
    where: {
      enrollmentId: enrollment.id,
    },
    select: {
      pinnedIp: true,
      pinnedUserAgent: true,
    },
  })
  if (!session || !session.pinnedIp || !session.pinnedUserAgent) return true
  return session.pinnedIp === hashIp(clientIp) && session.pinnedUserAgent === userAgent
}

async function validateMagicToken(
  token: string,
  clientIp: string,
  userAgent: string
): Promise<UnifiedAuthContext | UnifiedAuthError> {
  const user = await prisma.user.findUnique({
    where: { magicToken: token },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      team: true,
      avatarUrl: true,
      magicTokenPinnedIp: true,
      magicTokenPinnedUserAgent: true,
      magicTokenPinnedAt: true,
    },
  })

  if (!user) {
    return { status: 401, message: "Invalid magic token." }
  }

  const pinIp = user.magicTokenPinnedIp
  const pinAgent = user.magicTokenPinnedUserAgent
  const alreadyPinned = Boolean(user.magicTokenPinnedAt)

  if (alreadyPinned && (pinIp !== clientIp || pinAgent !== userAgent)) {
    return { status: 403, message: "Magic token is pinned to another device." }
  }

  if (!alreadyPinned) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        magicTokenPinnedIp: clientIp,
        magicTokenPinnedUserAgent: userAgent,
        magicTokenPinnedAt: new Date(),
      },
    })
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      team: user.team,
      avatarUrl: user.avatarUrl,
    },
    authType: "magic-token",
    clientIp,
    userAgent,
  }
}

async function validateSso(
  subject: string,
  clientIp: string,
  userAgent: string
): Promise<UnifiedAuthContext | UnifiedAuthError> {
  const user = await prisma.user.findUnique({
    where: { ssoId: subject },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      team: true,
      avatarUrl: true,
    },
  })

  if (!user) {
    return { status: 401, message: "SSO user not found." }
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      team: user.team,
      avatarUrl: user.avatarUrl,
    },
    authType: "sso",
    clientIp,
    userAgent,
  }
}

export async function requireUnifiedAuth(
  request: Request,
  options: { requireCookie?: boolean; courseId?: string } = {}
): Promise<UnifiedAuthContext | UnifiedAuthError> {
  const clientIp = getClientIp(request)
  const userAgent = getUserAgent(request)

  const sessionToken = getSessionToken(request)
  if (sessionToken) {
    let payload: JwtPayload | null = null
    try {
      payload = verifyJwt(sessionToken, getJwtSecret())
    } catch {
      payload = null
    }
    if (!payload) {
      return { status: 401, message: "Invalid session token." }
    }
    const user = await getUserById(payload.sub)
    if (!user) {
      return { status: 401, message: "Session user not found." }
    }
    if (options.courseId) {
      const ok = await validatePinnedSession({
        courseId: options.courseId,
        userId: user.id,
        clientIp,
        userAgent,
      })
      if (!ok) {
        return { status: 403, message: "Pinned device mismatch." }
      }
    }
    return {
      user,
      authType: payload.auth,
      clientIp,
      userAgent,
      sessionCourseId: payload.courseId,
    }
  }

  if (options.requireCookie) {
    return { status: 401, message: "Missing session token." }
  }

  const token = getQueryToken(request)
  if (token) {
    return validateMagicToken(token, clientIp, userAgent)
  }

  const ssoSubject = getSsoSubject(request)
  if (ssoSubject) {
    return validateSso(ssoSubject, clientIp, userAgent)
  }

  return { status: 401, message: "Missing authentication credentials." }
}

export function issueSessionJwt({
  userId,
  authType,
  courseId,
  ttlSeconds,
}: {
  userId: string
  authType: UnifiedAuthType
  courseId?: string
  ttlSeconds: number
}): string {
  return signJwt({ sub: userId, auth: authType, courseId }, getJwtSecret(), ttlSeconds)
}

export function hashClientIp(ip: string): string {
  return hashIp(ip)
}
