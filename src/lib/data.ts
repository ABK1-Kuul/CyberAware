import { cache } from 'react'
import type { User, Course, Enrollment, AuditLog, Certificate, EnrollmentStatus, JsonValue } from './types'
import { subDays, format } from 'date-fns'
import { prisma } from './prisma'
import { DatabaseError, ValidationError } from './errors'
import { logger } from './logger'
import { DASHBOARD_CHART_DAYS, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from './constants'

// Type guard for user role
function isValidUserRole(role: string): role is 'admin' | 'learner' {
  return role === 'admin' || role === 'learner'
}

// Helper function to safely map user role
function mapUserRole(role: string): 'admin' | 'learner' {
  return isValidUserRole(role) ? role : 'learner'
}

function mapEnrollmentStatus(status: 'NotStarted' | 'InProgress' | 'Completed'): EnrollmentStatus {
  switch (status) {
    case 'NotStarted':
      return 'Not Started'
    case 'InProgress':
      return 'In Progress'
    case 'Completed':
      return 'Completed'
    default:
      return 'Not Started'
  }
}

type PrismaCourse = {
  id: string
  title: string
  description: string
  version: string
  scormPath: string
  createdAt: Date
  enrollmentCount: number
}

type PrismaUser = {
  id: string
  name: string
  email: string
  role: string
  team: string
  createdAt: Date
  avatarUrl: string
}

type AuditLogWithActor = {
  id: string
  actorId: string | null
  action: string
  details: JsonValue
  createdAt: Date
  actor: PrismaUser | null
}

type EnrollmentWithRelations = {
  id: string
  userId: string
  courseId: string
  status: 'NotStarted' | 'InProgress' | 'Completed'
  progress: number
  assignedAt: Date
  completedAt: Date | null
  user: PrismaUser
  course: PrismaCourse
}

function requireNonEmptyId(value: string, name: string): void {
  if (!value || typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${name} is required`, name)
  }
}

function mapPrismaUserToUser(p: PrismaUser): User {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    role: mapUserRole(p.role),
    team: p.team,
    createdAt: p.createdAt.toISOString(),
    avatarUrl: p.avatarUrl,
  }
}

function mapPrismaCourseToCourse(p: PrismaCourse): Course {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    version: p.version,
    scormPath: p.scormPath,
    createdAt: p.createdAt.toISOString(),
    enrollmentCount: p.enrollmentCount,
  }
}

function mapEnrollmentWithRelationsToEnrollment(e: EnrollmentWithRelations): Enrollment {
  return {
    id: e.id,
    userId: e.userId,
    courseId: e.courseId,
    status: mapEnrollmentStatus(e.status),
    progress: e.progress,
    assignedAt: e.assignedAt.toISOString(),
    completedAt: e.completedAt?.toISOString() ?? null,
    user: mapPrismaUserToUser(e.user),
    course: mapPrismaCourseToCourse(e.course),
  }
}

// API-like functions using Prisma (wrapped with React cache() for request-level deduplication)

/** Fetches dashboard stats (learner count, course count, completed/in-progress enrollments). @throws {DatabaseError} */
async function getDashboardStatsImpl() {
  try {
    const [totalUsers, totalCourses, completed, inProgress] = await Promise.all([
      prisma.user.count({ where: { role: 'learner' } }),
      prisma.course.count(),
      prisma.enrollment.count({ where: { status: 'Completed' } }),
      prisma.enrollment.count({ where: { status: 'InProgress' } }),
    ])
    return { totalUsers, totalCourses, completed, inProgress }
  } catch (error) {
    logger.error('Database error in getDashboardStats', { error })
    throw new DatabaseError('Failed to fetch dashboard statistics', error)
  }
}
export const getDashboardStats = cache(getDashboardStatsImpl)

/** Fetches completion chart data for the last DASHBOARD_CHART_DAYS days. @throws {DatabaseError} */
async function getCompletionDataImpl() {
  try {
    const now = new Date()
    const startDate = subDays(now, DASHBOARD_CHART_DAYS)
    
    // Optimized: Single query to get all completed enrollments grouped by date
    const completedData = await prisma.$queryRaw<Array<{ date: Date, count: bigint }>>`
      SELECT 
        DATE(completed_at) as date,
        COUNT(*) as count
      FROM enrollments
      WHERE completed_at >= ${startDate}
        AND completed_at <= ${now}
        AND status = 'Completed'
      GROUP BY DATE(completed_at)
      ORDER BY date ASC
    `
    
    // Get all in-progress enrollments assigned in the last 30 days
    const inProgressEnrollments = await prisma.enrollment.findMany({
      where: {
        assignedAt: { gte: startDate },
        status: 'InProgress',
      },
      select: {
        assignedAt: true,
        completedAt: true,
      },
    })
    
    // Build date map for completed enrollments
    const completedMap = new Map<string, number>()
    completedData.forEach((row) => {
      const dateKey = format(new Date(row.date), 'MMM dd')
      completedMap.set(dateKey, Number(row.count))
    })
    
    // Build date map for in-progress enrollments
    const inProgressMap = new Map<string, number>()
    inProgressEnrollments.forEach((enrollment) => {
      const assignedDate = new Date(enrollment.assignedAt)
      const assignedDateKey = format(assignedDate, 'MMM dd')
      
      // Count as in-progress if not completed or completed after the assigned date
      if (!enrollment.completedAt) {
        const current = inProgressMap.get(assignedDateKey) || 0
        inProgressMap.set(assignedDateKey, current + 1)
      }
    })
    
    const data: { date: string, Completed: number, 'In Progress': number }[] = []
    for (let i = DASHBOARD_CHART_DAYS - 1; i >= 0; i--) {
      const date = subDays(now, i)
      const formattedDate = format(date, 'MMM dd')
      
      data.push({
        date: formattedDate,
        'Completed': completedMap.get(formattedDate) || 0,
        'In Progress': inProgressMap.get(formattedDate) || 0,
      })
    }
    
    return data
  } catch (error) {
    logger.error('Database error in getCompletionData', { error })
    throw new DatabaseError('Failed to fetch completion data', error)
  }
}
export const getCompletionData = cache(getCompletionDataImpl)

/** Fetches the most recent audit log entries (up to 5). @throws {DatabaseError} */
async function getRecentActivityImpl(): Promise<AuditLog[]> {
  try {
    const logs = await prisma.auditLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: true
      }
    }) as AuditLogWithActor[]
    
    return logs.map(log => ({
      id: log.id,
      actorId: log.actorId,
      action: log.action,
      details: log.details,
      createdAt: log.createdAt.toISOString(),
      actor: log.actor ? mapPrismaUserToUser(log.actor) : null
    }))
  } catch (error) {
    logger.error('Database error in getRecentActivity', { error })
    throw new DatabaseError('Failed to fetch recent activity', error)
  }
}
export const getRecentActivity = cache(getRecentActivityImpl)

export type PaginatedCourses = { courses: Course[]; total: number; page: number; pageSize: number }
export type PaginatedUsers = { users: User[]; total: number; page: number; pageSize: number }
export type PaginatedEnrollments = { enrollments: Enrollment[]; total: number; page: number; pageSize: number }

/** Paginated courses. @throws {DatabaseError} */
async function getCoursesImpl(page = DEFAULT_PAGE, pageSize = DEFAULT_PAGE_SIZE): Promise<PaginatedCourses> {
  try {
    const skip = (page - 1) * pageSize
    const [rows, total] = await Promise.all([
      prisma.course.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' }
      }) as Promise<PrismaCourse[]>,
      prisma.course.count()
    ])
    const courses = rows.map(mapPrismaCourseToCourse)
    return { courses, total, page, pageSize }
  } catch (error) {
    logger.error('Database error in getCourses', { error })
    throw new DatabaseError('Failed to fetch courses', error)
  }
}
export const getCourses = cache(getCoursesImpl)

/** Paginated learners (role = learner). @throws {DatabaseError} */
async function getUsersImpl(page = DEFAULT_PAGE, pageSize = DEFAULT_PAGE_SIZE): Promise<PaginatedUsers> {
  try {
    const skip = (page - 1) * pageSize
    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: pageSize,
        where: { role: 'learner' },
        orderBy: { createdAt: 'desc' }
      }) as Promise<PrismaUser[]>,
      prisma.user.count({ where: { role: 'learner' } })
    ])
    const users = rows.map(mapPrismaUserToUser)
    return { users, total, page, pageSize }
  } catch (error) {
    logger.error('Database error in getUsers', { error })
    throw new DatabaseError('Failed to fetch users', error)
  }
}
export const getUsers = cache(getUsersImpl)

/** Paginated enrollments for a course. @throws {ValidationError} If courseId is empty. @throws {DatabaseError} */
async function getEnrollmentsForCourseImpl(
  courseId: string,
  page = DEFAULT_PAGE,
  pageSize = DEFAULT_PAGE_SIZE
): Promise<PaginatedEnrollments> {
  requireNonEmptyId(courseId, 'courseId')
  try {
    const skip = (page - 1) * pageSize
    const [rows, total] = await Promise.all([
      prisma.enrollment.findMany({
        skip,
        take: pageSize,
        where: { courseId },
        include: { user: true, course: true },
        orderBy: { assignedAt: 'desc' }
      }) as Promise<EnrollmentWithRelations[]>,
      prisma.enrollment.count({ where: { courseId } })
    ])
    const enrollments = rows.map(mapEnrollmentWithRelationsToEnrollment)
    return { enrollments, total, page, pageSize }
  } catch (error) {
    logger.error('Database error in getEnrollmentsForCourse', { error })
    throw new DatabaseError('Failed to fetch enrollments for course', error)
  }
}
export const getEnrollmentsForCourse = cache(getEnrollmentsForCourseImpl)

/** Fetches an enrollment by ID. Returns undefined if not found. @throws {ValidationError} If enrollmentId is empty. @throws {DatabaseError} */
export async function getEnrollment(enrollmentId: string): Promise<Enrollment | undefined> {
  requireNonEmptyId(enrollmentId, 'enrollmentId')
  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { user: true, course: true }
    })
    if (!enrollment) return undefined
    return mapEnrollmentWithRelationsToEnrollment(enrollment as EnrollmentWithRelations)
  } catch (error) {
    logger.error('Database error in getEnrollment', { error })
    throw new DatabaseError('Failed to fetch enrollment', error)
  }
}

export async function getCertificateForEnrollment(enrollmentId: string): Promise<Certificate | undefined> {
  requireNonEmptyId(enrollmentId, 'enrollmentId')
  try {
    const certificate = await prisma.certificate.findUnique({
      where: { enrollmentId }
    })
    
    if (!certificate) return undefined
    
    return {
      id: certificate.id,
      enrollmentId: certificate.enrollmentId,
      path: certificate.path,
      issuedAt: certificate.issuedAt.toISOString(),
      uuid: certificate.uuid
    }
  } catch (error) {
    logger.error('Database error in getCertificateForEnrollment', { error })
    throw new DatabaseError('Failed to fetch certificate for enrollment', error)
  }
}

/** Fetches a certificate by ID. Returns undefined if not found. @throws {ValidationError} If certificateId is empty. @throws {DatabaseError} */
export async function getCertificateById(certificateId: string): Promise<Certificate | undefined> {
  requireNonEmptyId(certificateId, 'certificateId')
  try {
    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId }
    })

    if (!certificate) return undefined

    return {
      id: certificate.id,
      enrollmentId: certificate.enrollmentId,
      path: certificate.path,
      issuedAt: certificate.issuedAt.toISOString(),
      uuid: certificate.uuid
    }
  } catch (error) {
    logger.error('Database error in getCertificateById', { error })
    throw new DatabaseError('Failed to fetch certificate by ID', error)
  }
}

/**
 * Create an enrollment with transaction support.
 * This ensures that if enrollment creation fails, no partial data is saved.
 * Also creates an audit log entry atomically.
 * @throws {ValidationError} If userId, courseId, or actorId is empty
 * @throws {DatabaseError} If enrollment already exists or DB operation fails
 */
export async function createEnrollment(
  userId: string,
  courseId: string,
  actorId: string
): Promise<Enrollment> {
  requireNonEmptyId(userId, 'userId')
  requireNonEmptyId(courseId, 'courseId')
  requireNonEmptyId(actorId, 'actorId')
  try {
    return await prisma.$transaction(async (tx) => {
      // Check if enrollment already exists
      const existing = await tx.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId,
          },
        },
      })

      if (existing) {
        throw new DatabaseError('Enrollment already exists for this user and course')
      }

      // Create enrollment
      const enrollment = await tx.enrollment.create({
        data: {
          userId,
          courseId,
          status: 'NotStarted',
          progress: 0,
        },
        include: {
          user: true,
          course: true,
        },
      })

      // Update course enrollment count
      await tx.course.update({
        where: { id: courseId },
        data: {
          enrollmentCount: {
            increment: 1,
          },
        },
      })

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'ENROLLMENT_CREATED',
          details: {
            enrollmentId: enrollment.id,
            userId,
            courseId,
          },
        },
      })

      return mapEnrollmentWithRelationsToEnrollment(enrollment as EnrollmentWithRelations)
    })
  } catch (error) {
    if (error instanceof DatabaseError || error instanceof ValidationError) {
      throw error
    }
    logger.error('Database error in createEnrollment', { error })
    throw new DatabaseError('Failed to create enrollment', error)
  }
}
