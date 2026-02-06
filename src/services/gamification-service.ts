import nodemailer from "nodemailer"
import { subDays } from "date-fns"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { getDirectoryUsers, type DirectoryUser } from "@/services/ad-sync"

export type BadgeType = "FIRST_RESPONDER" | "CYBER_HERO" | "SECURITY_CHAMPION"

type BadgeDefinition = {
  label: string
  description: string
  imagePath: string
}

const BADGES: Record<BadgeType, BadgeDefinition> = {
  FIRST_RESPONDER: {
    label: "First Responder",
    description: "Reported a phish within the first 5 minutes of landing.",
    imagePath: "/badges/first-responder.png",
  },
  CYBER_HERO: {
    label: "Cyber Hero",
    description: "Reported 3 simulations in a row with zero clicks.",
    imagePath: "/badges/cyber-hero.png",
  },
  SECURITY_CHAMPION: {
    label: "Security Champion",
    description: "Completed all remediation courses with a 100% score.",
    imagePath: "/badges/security-champion.png",
  },
}

const DEPARTMENT_HEAD_KEYWORDS = [
  "head",
  "director",
  "vp",
  "vice president",
  "chief",
  "ciso",
  "cio",
  "cso",
  "manager",
]

const RESILIENCE_NOTIFY_WINDOW_DAYS = 30

function getMailerConfig() {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM
  if (!host || !port || !user || !pass || !from) {
    throw new Error("SMTP configuration is missing.")
  }
  return { host, port, user, pass, from }
}

function buildBadgeUrl(path: string) {
  const base = (process.env.APP_BASE_URL ?? "").trim().replace(/\/$/, "")
  if (!base) return path
  return `${base}${path}`
}

function normalizeDepartmentName(value?: string | null) {
  return (value ?? "").trim().toLowerCase()
}

function findDepartmentHead(users: DirectoryUser[], departmentName: string) {
  const target = normalizeDepartmentName(departmentName)
  const departmentUsers = users.filter(
    (user) => normalizeDepartmentName(user.department) === target && Boolean(user.email)
  )
  if (!departmentUsers.length) return null

  for (const keyword of DEPARTMENT_HEAD_KEYWORDS) {
    const match = departmentUsers.find((user) =>
      (user.jobTitle ?? "").toLowerCase().includes(keyword)
    )
    if (match) return match
  }

  return departmentUsers[0] ?? null
}

async function sendDepartmentHeadEmail({
  to,
  name,
  departmentName,
  resilienceScore,
  campaignName,
}: {
  to: string
  name: string
  departmentName: string
  resilienceScore: number
  campaignName?: string | null
}) {
  const config = getMailerConfig()
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  })
  const campaignLine = campaignName
    ? `after the "${campaignName}" simulation`
    : "after the latest simulation"

  await transporter.sendMail({
    from: config.from,
    to,
    subject: `Resilient Business Unit: ${departmentName}`,
    text: `Hi ${name},\n\nCongratulations! ${departmentName} achieved a resilience score of ${resilienceScore} ${campaignLine}.\n\nYour team is now recognized as a Resilient Business Unit.\n\nThank you for championing cyber readiness.`,
    html: `<!doctype html>
<html>
  <body style="margin:0; padding:0; background:#f8fafc;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 8px 24px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:#0f172a; padding:20px 28px; color:#ffffff; font-family:'Montserrat', Arial, sans-serif;">
                <div style="font-size:16px; letter-spacing:2px; text-transform:uppercase;">Resilient Business Unit</div>
                <div style="font-size:24px; font-weight:700; margin-top:6px;">${departmentName}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px; font-family:'Montserrat', Arial, sans-serif; color:#0f172a;">
                <p style="margin:0 0 12px;">Hi ${name},</p>
                <p style="margin:0 0 16px;">
                  Congratulations! <strong>${departmentName}</strong> achieved a resilience score of
                  <strong>${resilienceScore}</strong> ${campaignLine}.
                </p>
                <p style="margin:0 0 16px;">
                  Your team is now recognized as a <strong>Resilient Business Unit</strong>.
                </p>
                <p style="margin:0; font-size:12px; color:#64748b;">
                  Thank you for championing cyber readiness across your organization.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  })
}

async function sendBadgeEmail({
  to,
  name,
  badge,
}: {
  to: string
  name: string
  badge: BadgeDefinition
}) {
  const config = getMailerConfig()
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  })
  const imageUrl = buildBadgeUrl(badge.imagePath)

  await transporter.sendMail({
    from: config.from,
    to,
    subject: `🎉 Badge Unlocked: ${badge.label}`,
    text: `Hi ${name},\n\nCongratulations! You just earned the ${badge.label} badge.\n${badge.description}\n\nKeep up the great work!`,
    html: `<!doctype html>
<html>
  <body style="margin:0; padding:0; background:#f8fafc;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 8px 24px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:#0f172a; padding:20px 28px; color:#ffffff; font-family:'Montserrat', Arial, sans-serif;">
                <div style="font-size:16px; letter-spacing:2px; text-transform:uppercase;">Achievement Unlocked</div>
                <div style="font-size:24px; font-weight:700; margin-top:6px;">${badge.label}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px; font-family:'Montserrat', Arial, sans-serif; color:#0f172a;">
                <p style="margin:0 0 16px;">Hi ${name},</p>
                <p style="margin:0 0 16px;">${badge.description}</p>
                <div style="text-align:center; margin:24px 0;">
                  <img src="${imageUrl}" alt="${badge.label} badge" width="180" style="display:inline-block; border-radius:12px; border:1px solid #e2e8f0;" />
                </div>
                <p style="margin:0; font-size:12px; color:#64748b;">Keep building your human firewall streak.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  })
}

function normalizeAchievements(value: unknown): BadgeType[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is BadgeType =>
      typeof entry === "string" && entry in BADGES
    )
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((entry) => entry.trim() as BadgeType)
  }
  return []
}

export async function awardBadge(userId: string, badgeType: BadgeType) {
  const badge = BADGES[badgeType]
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  })
  if (!user) {
    throw new Error("User not found for badge award.")
  }

  const profile = await prisma.userRiskProfile.findUnique({
    where: { userId },
    select: { achievements: true },
  })
  const achievements = normalizeAchievements(profile?.achievements)
  if (achievements.includes(badgeType)) {
    return { awarded: false, achievements }
  }
  const nextAchievements = [...achievements, badgeType]

  await prisma.userRiskProfile.upsert({
    where: { userId },
    update: {
      achievements: nextAchievements,
      lastUpdated: new Date(),
    },
    create: {
      userId,
      achievements: nextAchievements,
      riskScore: 50,
      reportingStreak: 0,
      totalReported: 0,
      lastUpdated: new Date(),
    },
  })

  try {
    await sendBadgeEmail({
      to: user.email,
      name: user.name || "Learner",
      badge,
    })
  } catch (error) {
    logger.error("Failed to send badge email", { error, userId, badge: badgeType })
  }

  return { awarded: true, achievements: nextAchievements }
}

export async function notifyDepartmentHeads(input?: {
  departmentId?: string
  campaignId?: string
  campaignName?: string | null
}) {
  const threshold = 90
  const minRiskScore = Math.max(0, 100 - threshold)
  const departments = await prisma.department.findMany({
    where: {
      ...(input?.departmentId ? { id: input.departmentId } : {}),
      riskScore: { lte: minRiskScore },
    },
    select: { id: true, name: true, riskScore: true },
  })

  if (!departments.length) return []

  let directoryUsers: DirectoryUser[] = []
  try {
    directoryUsers = await getDirectoryUsers()
  } catch (error) {
    logger.error("Failed to fetch directory users for department notifications", { error })
    return []
  }

  const notified: Array<{ departmentId: string; email: string }> = []
  const notifyAfter = subDays(new Date(), RESILIENCE_NOTIFY_WINDOW_DAYS)

  for (const department of departments) {
    const existing = await prisma.auditLog.findFirst({
      where: {
        action: "department.resilience.achieved",
        createdAt: { gte: notifyAfter },
        details: {
          path: ["departmentId"],
          equals: department.id,
        },
      },
      select: { id: true },
    })
    if (existing) {
      continue
    }

    const head = findDepartmentHead(directoryUsers, department.name)
    if (!head?.email) {
      logger.warn("Department head not found for resilience notification", {
        departmentId: department.id,
        departmentName: department.name,
      })
      continue
    }

    try {
      await sendDepartmentHeadEmail({
        to: head.email,
        name: head.displayName ?? head.firstName ?? "Leader",
        departmentName: department.name,
        resilienceScore: Math.max(0, 100 - department.riskScore),
        campaignName: input?.campaignName ?? null,
      })

      await prisma.auditLog.create({
        data: {
          actorId: null,
          action: "department.resilience.achieved",
          details: {
            departmentId: department.id,
            departmentName: department.name,
            resilienceScore: Math.max(0, 100 - department.riskScore),
            campaignId: input?.campaignId ?? null,
            campaignName: input?.campaignName ?? null,
            headEmail: head.email,
          },
        },
      })

      notified.push({ departmentId: department.id, email: head.email })
    } catch (error) {
      logger.error("Failed to send resilience notification", {
        error,
        departmentId: department.id,
        departmentName: department.name,
      })
    }
  }

  return notified
}
