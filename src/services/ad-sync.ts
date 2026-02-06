import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { generateWelcomeGuide } from "@/services/onboarding-service"
import { gophishApi, GophishGroup, GophishTarget } from "@/services/gophish-api"

export type DirectoryUser = {
  id?: string
  email: string
  displayName?: string
  firstName?: string
  lastName?: string
  department?: string | null
  jobTitle?: string | null
}

export type ADSyncProvider = "graph" | "ldap"

export type ADSyncOptions = {
  provider?: ADSyncProvider
  dryRun?: boolean
  removeMissingGroups?: boolean
  protectedGroupNames?: string[]
  suppressEmails?: boolean
}

export type ADSyncSummary = {
  provider: ADSyncProvider
  dryRun: boolean
  totalUsers: number
  totalDepartments: number
  created: number
  updated: number
  deleted: number
  skipped: number
}

type DepartmentBucket = {
  name: string
  users: DirectoryUser[]
}

type GraphUser = {
  id?: string
  displayName?: string
  mail?: string
  userPrincipalName?: string
  department?: string
  jobTitle?: string
  givenName?: string
  surname?: string
  accountEnabled?: boolean
}

type GraphUsersResponse = {
  value: GraphUser[]
  "@odata.nextLink"?: string
}

const DEFAULT_DEPARTMENT = "Unassigned"

function normalizeOptional(value?: string | null) {
  const trimmed = (value ?? "").trim()
  return trimmed || undefined
}

function normalizeDepartment(department?: string | null) {
  return normalizeOptional(department) ?? DEFAULT_DEPARTMENT
}

function normalizeGroupName(value: string) {
  return value.trim().toLowerCase()
}

function parseProtectedGroups(value?: string) {
  if (!value) return []
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.toLowerCase())
}

function splitDisplayName(displayName?: string) {
  const cleaned = (displayName ?? "").trim()
  if (!cleaned) return { firstName: undefined, lastName: undefined }
  const parts = cleaned.split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: undefined }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  }
}

function toTarget(user: DirectoryUser): GophishTarget | null {
  const email = normalizeOptional(user.email)
  if (!email) return null
  const fallback = splitDisplayName(user.displayName)
  const firstName = normalizeOptional(user.firstName) ?? fallback.firstName
  const lastName = normalizeOptional(user.lastName) ?? fallback.lastName
  const position = normalizeOptional(user.jobTitle)
  return {
    email,
    first_name: firstName,
    last_name: lastName,
    position,
  }
}

function dedupeTargets(targets: GophishTarget[]): GophishTarget[] {
  const map = new Map<string, GophishTarget>()
  for (const target of targets) {
    const key = target.email.trim().toLowerCase()
    const existing = map.get(key)
    if (!existing) {
      map.set(key, target)
    } else {
      map.set(key, {
        email: existing.email,
        first_name: existing.first_name ?? target.first_name,
        last_name: existing.last_name ?? target.last_name,
        position: existing.position ?? target.position,
      })
    }
  }
  return Array.from(map.values())
}

function normalizeTargetSignature(target: GophishTarget) {
  const normalize = (value?: string) => (value ?? "").trim().toLowerCase()
  return [
    normalize(target.email),
    normalize(target.first_name),
    normalize(target.last_name),
    normalize(target.position),
  ].join("|")
}

function targetsDiffer(existingTargets: GophishTarget[], nextTargets: GophishTarget[]) {
  if (existingTargets.length !== nextTargets.length) return true
  const existingSignatures = new Set(existingTargets.map(normalizeTargetSignature))
  for (const target of nextTargets) {
    if (!existingSignatures.has(normalizeTargetSignature(target))) {
      return true
    }
  }
  return false
}

function resolveProvider(options?: ADSyncOptions): ADSyncProvider {
  if (options?.provider) return options.provider
  const envProvider = (process.env.AD_SYNC_PROVIDER ?? "").toLowerCase()
  if (envProvider === "ldap") return "ldap"
  return "graph"
}

async function fetchGraphAccessToken() {
  const tenantId = normalizeOptional(process.env.AD_GRAPH_TENANT_ID)
  const clientId = normalizeOptional(process.env.AD_GRAPH_CLIENT_ID)
  const clientSecret = normalizeOptional(process.env.AD_GRAPH_CLIENT_SECRET)
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Graph configuration missing. Set AD_GRAPH_TENANT_ID, AD_GRAPH_CLIENT_ID, and AD_GRAPH_CLIENT_SECRET."
    )
  }
  const scope = normalizeOptional(process.env.AD_GRAPH_SCOPE) ?? "https://graph.microsoft.com/.default"
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope,
  })

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Graph token request failed: ${text || response.statusText}`)
  }
  const json = (await response.json()) as { access_token?: string }
  if (!json.access_token) {
    throw new Error("Graph token response missing access_token.")
  }
  return json.access_token
}

async function fetchGraphUsers(): Promise<DirectoryUser[]> {
  const token = await fetchGraphAccessToken()
  const params = new URLSearchParams({
    $select: "id,displayName,mail,userPrincipalName,department,jobTitle,givenName,surname,accountEnabled",
    $top: "999",
  })
  const filter = normalizeOptional(process.env.AD_GRAPH_USER_FILTER)
  if (filter) params.set("$filter", filter)
  let url = `https://graph.microsoft.com/v1.0/users?${params.toString()}`
  const users: DirectoryUser[] = []

  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Graph user fetch failed: ${text || response.statusText}`)
    }
    const data = (await response.json()) as GraphUsersResponse
    for (const item of data.value ?? []) {
      if (item.accountEnabled === false) continue
      const email = normalizeOptional(item.mail) ?? normalizeOptional(item.userPrincipalName)
      if (!email) continue
      users.push({
        id: item.id,
        email,
        displayName: item.displayName,
        firstName: item.givenName,
        lastName: item.surname,
        department: item.department,
        jobTitle: item.jobTitle,
      })
    }
    url = data["@odata.nextLink"] ?? ""
  }

  return users
}

function getLdapAttribute(entry: Record<string, unknown>, key: string) {
  const value = entry[key]
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined
  }
  return typeof value === "string" ? value : undefined
}

async function fetchLdapUsers(): Promise<DirectoryUser[]> {
  const url = normalizeOptional(process.env.LDAP_URL)
  const bindDn = normalizeOptional(process.env.LDAP_BIND_DN)
  const bindPassword = normalizeOptional(process.env.LDAP_BIND_PASSWORD)
  const baseDn = normalizeOptional(process.env.LDAP_BASE_DN)
  const filter = normalizeOptional(process.env.LDAP_USER_FILTER) ?? "(objectClass=person)"
  const rejectUnauthorized = process.env.LDAP_TLS_REJECT_UNAUTHORIZED !== "false"

  if (!url || !bindDn || !bindPassword || !baseDn) {
    throw new Error(
      "LDAP configuration missing. Set LDAP_URL, LDAP_BIND_DN, LDAP_BIND_PASSWORD, and LDAP_BASE_DN."
    )
  }

  let ldap: any
  try {
    ldap = require("ldapjs")
  } catch {
    throw new Error("LDAP provider selected but ldapjs is not installed. Run npm install ldapjs.")
  }

  const client = ldap.createClient({
    url,
    tlsOptions: { rejectUnauthorized },
  })

  const bind = () =>
    new Promise<void>((resolve, reject) => {
      client.bind(bindDn, bindPassword, (error: Error | null) => {
        if (error) reject(error)
        else resolve()
      })
    })

  const search = () =>
    new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const entries: Record<string, unknown>[] = []
      client.search(
        baseDn,
        {
          filter,
          scope: "sub",
          attributes: [
            "mail",
            "userPrincipalName",
            "displayName",
            "department",
            "givenName",
            "sn",
            "title",
          ],
        },
        (error: Error | null, res: any) => {
          if (error) {
            reject(error)
            return
          }
          res.on("searchEntry", (entry: any) => {
            if (entry?.object) entries.push(entry.object)
          })
          res.on("error", (err: Error) => reject(err))
          res.on("end", () => resolve(entries))
        }
      )
    })

  try {
    await bind()
    const entries = await search()
    return entries
      .map((entry) => {
        const email =
          getLdapAttribute(entry, "mail") ?? getLdapAttribute(entry, "userPrincipalName")
        if (!email) return null
        return {
          email,
          displayName: getLdapAttribute(entry, "displayName"),
          firstName: getLdapAttribute(entry, "givenName"),
          lastName: getLdapAttribute(entry, "sn"),
          department: getLdapAttribute(entry, "department"),
          jobTitle: getLdapAttribute(entry, "title"),
        }
      })
      .filter(Boolean) as DirectoryUser[]
  } finally {
    try {
      client.unbind()
    } catch {
      // ignore unbind errors
    }
  }
}

async function fetchDirectoryUsers(provider: ADSyncProvider): Promise<DirectoryUser[]> {
  return provider === "ldap" ? fetchLdapUsers() : fetchGraphUsers()
}

async function ensureDepartmentRecord(name: string) {
  return prisma.department.upsert({
    where: { name },
    update: { lastSynced: new Date() },
    create: { name, totalUsers: 0 },
  })
}

function buildUserName(user: DirectoryUser) {
  const fallback = splitDisplayName(user.displayName)
  const first = normalizeOptional(user.firstName) ?? fallback.firstName ?? ""
  const last = normalizeOptional(user.lastName) ?? fallback.lastName ?? ""
  const combined = `${first} ${last}`.trim()
  return combined || user.email
}

async function provisionUsers(
  directoryUsers: DirectoryUser[],
  dryRun: boolean,
  suppressEmails: boolean
) {
  if (dryRun) {
    logger.info("Skipping user provisioning (dry run)")
    return
  }

  const normalizedUsers = directoryUsers
    .map((user) => {
      const email = normalizeOptional(user.email)?.toLowerCase()
      if (!email) return null
      return { ...user, email }
    })
    .filter(Boolean) as Array<DirectoryUser & { email: string }>

  if (!normalizedUsers.length) return

  const emails = normalizedUsers.map((user) => user.email)
  const existing = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  })
  const existingByEmail = new Map(
    existing.map((user) => [user.email.trim().toLowerCase(), user])
  )

  for (const user of normalizedUsers) {
    if (existingByEmail.has(user.email)) continue
    const departmentName = normalizeDepartment(user.department)
    const department = await ensureDepartmentRecord(departmentName)
    try {
      const created = await prisma.user.create({
        data: {
          name: buildUserName(user),
          email: user.email,
          role: "learner",
          team: department.name,
          departmentId: department.id,
          avatarUrl: `https://picsum.photos/seed/${encodeURIComponent(user.email)}/120/120`,
        },
      })
      if (!suppressEmails) {
        await generateWelcomeGuide(created.id)
      }
    } catch (error) {
      logger.error("Failed to provision user from directory", { error, email: user.email })
    }
  }
}

export async function getDirectoryUsers(options: ADSyncOptions = {}): Promise<DirectoryUser[]> {
  const provider = resolveProvider(options)
  return fetchDirectoryUsers(provider)
}

function buildDepartmentBuckets(users: DirectoryUser[]) {
  const map = new Map<string, DepartmentBucket>()
  for (const user of users) {
    const departmentName = normalizeDepartment(user.department)
    const key = normalizeGroupName(departmentName)
    const bucket = map.get(key) ?? { name: departmentName, users: [] }
    bucket.users.push(user)
    map.set(key, bucket)
  }
  return map
}

export async function syncUsersToGophish(options: ADSyncOptions = {}): Promise<ADSyncSummary> {
  const provider = resolveProvider(options)
  const dryRun = options.dryRun ?? process.env.AD_SYNC_DRY_RUN === "true"
  const suppressEmails =
    options.suppressEmails ?? process.env.AD_SYNC_SUPPRESS_EMAILS === "true"
  const removeMissingGroups =
    options.removeMissingGroups ?? process.env.AD_SYNC_REMOVE_MISSING_GROUPS === "true"
  const protectedGroupNames = new Set(
    options.protectedGroupNames?.map(normalizeGroupName) ??
      parseProtectedGroups(process.env.AD_SYNC_PROTECTED_GROUPS)
  )

  logger.info("Starting AD sync", { provider, dryRun, removeMissingGroups })

  const directoryUsers = await fetchDirectoryUsers(provider)
  if (suppressEmails) {
    logger.info("Suppressing onboarding emails for AD sync")
  }
  await provisionUsers(directoryUsers, dryRun, suppressEmails)
  const departmentBuckets = buildDepartmentBuckets(directoryUsers)
  const existingGroups = await gophishApi.getGroups()
  const existingByName = new Map(
    existingGroups.map((group) => [normalizeGroupName(group.name), group] as const)
  )

  let created = 0
  let updated = 0
  let deleted = 0
  let skipped = 0

  for (const [departmentKey, bucket] of departmentBuckets.entries()) {
    const targets = dedupeTargets(
      bucket.users.map(toTarget).filter(Boolean) as GophishTarget[]
    )
    const existing = existingByName.get(departmentKey)
    if (existing) {
      const existingTargets = existing.targets ?? []
      if (targetsDiffer(existingTargets, targets)) {
        updated += 1
        if (!dryRun) {
          await gophishApi.updateGroup(existing.id, {
            name: bucket.name,
            targets,
          })
        }
      } else {
        skipped += 1
      }
    } else {
      created += 1
      if (!dryRun) {
        await gophishApi.createGroup({
          name: bucket.name,
          targets,
        })
      }
    }
  }

  if (removeMissingGroups) {
    for (const group of existingGroups) {
      const groupKey = normalizeGroupName(group.name)
      if (departmentBuckets.has(groupKey)) continue
      if (protectedGroupNames.has(groupKey)) continue
      deleted += 1
      if (!dryRun) {
        await gophishApi.deleteGroup(group.id)
      }
    }
  }

  const summary: ADSyncSummary = {
    provider,
    dryRun,
    totalUsers: directoryUsers.length,
    totalDepartments: departmentBuckets.size,
    created,
    updated,
    deleted,
    skipped,
  }

  logger.info("AD sync complete", summary)
  return summary
}

export const adSyncService = {
  syncUsersToGophish,
  getDirectoryUsers,
}
