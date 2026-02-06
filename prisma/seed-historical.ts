import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const MONTHS = 6
const TOTAL_EVENTS = 100
const SEED_TAG = "historical"

const DEPARTMENTS = ["Finance", "IT", "HR", "Sales", "Operations", "Marketing"]
const EVENT_TYPES = ["Submitted Data", "Clicked Link", "Email Opened", "Reported Phish"] as const

type EventType = (typeof EVENT_TYPES)[number]

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

function allocateCounts(total: number, buckets: number) {
  const base = Math.floor(total / buckets)
  const remainder = total - base * buckets
  return Array.from({ length: buckets }, (_, index) => base + (index >= buckets - remainder ? 1 : 0))
}

function monthDate(index: number) {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth(), 1)
  date.setMonth(date.getMonth() - (MONTHS - 1 - index))
  date.setHours(9, 0, 0, 0)
  date.setDate(5)
  return date
}

function getMonthRates(index: number) {
  if (index <= 1) {
    return { submitted: 0.3, reported: 0.2, clicked: 0.3, opened: 0.2 }
  }
  if (index >= 4) {
    return { submitted: 0.1, reported: 0.7, clicked: 0.1, opened: 0.1 }
  }
  const progress = (index - 1) / 3
  const submitted = 0.3 - 0.15 * progress
  const reported = 0.2 + 0.35 * progress
  const clicked = 0.25 - 0.05 * progress
  const opened = Math.max(0.05, 1 - submitted - reported - clicked)
  return { submitted, reported, clicked, opened }
}

function pickEventType(rates: ReturnType<typeof getMonthRates>): EventType {
  const roll = Math.random()
  if (roll < rates.submitted) return "Submitted Data"
  if (roll < rates.submitted + rates.reported) return "Reported Phish"
  if (roll < rates.submitted + rates.reported + rates.clicked) return "Clicked Link"
  return "Email Opened"
}

function reportDelayMinutes(index: number) {
  const start = 45
  const end = 8
  const progress = index / Math.max(1, MONTHS - 1)
  return Math.round(start - (start - end) * progress)
}

async function ensureDepartments() {
  return Promise.all(
    DEPARTMENTS.map((name) =>
      prisma.department.upsert({
        where: { name },
        update: {},
        create: { name, totalUsers: 0 },
      })
    )
  )
}

async function ensureUsers() {
  const existing = await prisma.user.findMany({
    select: { id: true, email: true, team: true },
    take: 50,
  })
  if (existing.length >= 8) return existing

  const departments = await ensureDepartments()
  const users = []
  let counter = 1
  for (const department of departments) {
    for (let i = 0; i < 4; i += 1) {
      const email = `seed.user${counter}@example.com`
      const user = await prisma.user.create({
        data: {
          name: `Seed User ${counter}`,
          email,
          role: "learner",
          team: department.name,
          departmentId: department.id,
          avatarUrl: "https://picsum.photos/seed/seed-user/120/120",
        },
      })
      users.push({ id: user.id, email: user.email, team: user.team })
      counter += 1
    }
  }
  return users
}

async function upsertCampaign(name: string, createdAt: Date) {
  const existing = await prisma.phishingCampaign.findFirst({ where: { name } })
  if (existing) return existing
  return prisma.phishingCampaign.create({
    data: {
      name,
      status: "Completed",
      targetGroups: JSON.stringify(DEPARTMENTS),
      createdAt,
    },
  })
}

async function main() {
  const users = await ensureUsers()

  await prisma.phishingEvent.deleteMany({
    where: {
      details: {
        path: ["seed"],
        equals: SEED_TAG,
      },
    },
  })

  const counts = allocateCounts(TOTAL_EVENTS, MONTHS)
  for (let index = 0; index < MONTHS; index += 1) {
    const campaignStart = monthDate(index)
    const name = `Seeded Simulation ${campaignStart.toLocaleString("en-US", {
      month: "short",
      year: "numeric",
    })}`
    const campaign = await upsertCampaign(name, campaignStart)
    const rates = getMonthRates(index)
    const delayMinutes = reportDelayMinutes(index)

    const events = []
    const anchorUser = randomItem(users)
    events.push({
      campaignId: campaign.id,
      userId: anchorUser.id,
      eventType: "Email Opened",
      occurredAt: campaignStart,
      details: {
        seed: SEED_TAG,
        browser: "Chrome",
        os: "Windows 11",
        ip: "10.0.0.1",
      },
    })
    events.push({
      campaignId: campaign.id,
      userId: randomItem(users).id,
      eventType: "Reported Phish",
      occurredAt: new Date(campaignStart.getTime() + delayMinutes * 60 * 1000),
      details: {
        seed: SEED_TAG,
        browser: "Firefox",
        os: "Windows 10",
        ip: "10.0.0.2",
      },
    })

    const remaining = Math.max(0, counts[index] - events.length)
    for (let i = 0; i < remaining; i += 1) {
      const minutesOffset = Math.floor(Math.random() * 60 * 48)
      const eventType = pickEventType(rates)
      const occurredAt = new Date(campaignStart.getTime() + minutesOffset * 60 * 1000)
      events.push({
        campaignId: campaign.id,
        userId: randomItem(users).id,
        eventType,
        occurredAt,
        details: {
          seed: SEED_TAG,
          browser: randomItem(["Chrome", "Edge", "Safari"]),
          os: randomItem(["Windows 11", "Windows 10", "macOS 14", "Ubuntu 22.04"]),
          ip: `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        },
      })
    }

    await prisma.phishingEvent.createMany({ data: events })
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
