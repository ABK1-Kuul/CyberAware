import type { User, Course, Enrollment, AuditLog, Certificate, EnrollmentStatus, JsonValue } from './types'
import { subDays, format } from 'date-fns'
import { prisma } from './prisma'
import { DatabaseError } from './errors'

// Type guard for user role
function isValidUserRole(role: string): role is 'admin' | 'learner' {
  return role === 'admin' || role === 'learner'
}

// Helper function to safely map user role
function mapUserRole(role: string): 'admin' | 'learner' {
  return isValidUserRole(role) ? role : 'learner'
}

// Helper function to map Prisma enum values to TypeScript types
// Accepts the actual Prisma enum type (string union) for type safety
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

// API-like functions using Prisma
export async function getDashboardStats() {
  try {
    const totalUsers = await prisma.user.count({
      where: { role: 'learner' }
    })
    const totalCourses = await prisma.course.count()
    const completed = await prisma.enrollment.count({
      where: { status: 'Completed' }
    })
    const inProgress = await prisma.enrollment.count({
      where: { status: 'InProgress' }
    })
    return { totalUsers, totalCourses, completed, inProgress }
  } catch (error) {
    console.error('Database error in getDashboardStats:', error)
    throw new DatabaseError('Failed to fetch dashboard statistics', error)
  }
}

export async function getCompletionData() {
  try {
    const now = new Date()
    const thirtyDaysAgo = subDays(now, 30)
    
    // Optimized: Single query to get all completed enrollments grouped by date
    const completedData = await prisma.$queryRaw<Array<{ date: Date, count: bigint }>>`
      SELECT 
        DATE(completed_at) as date,
        COUNT(*) as count
      FROM enrollments
      WHERE completed_at >= ${thirtyDaysAgo}
        AND completed_at <= ${now}
        AND status = 'Completed'
      GROUP BY DATE(completed_at)
      ORDER BY date ASC
    `
    
    // Get all in-progress enrollments assigned in the last 30 days
    const inProgressEnrollments = await prisma.enrollment.findMany({
      where: {
        assignedAt: { gte: thirtyDaysAgo },
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
    
    // Build result array for all 30 days
    const data: { date: string, Completed: number, 'In Progress': number }[] = []
    for (let i = 29; i >= 0; i--) {
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
    console.error('Database error in getCompletionData:', error)
    throw new DatabaseError('Failed to fetch completion data', error)
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

export async function getRecentActivity(): Promise<AuditLog[]> {
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
      actor: log.actor ? {
        id: log.actor.id,
        name: log.actor.name,
        email: log.actor.email,
        role: mapUserRole(log.actor.role),
        team: log.actor.team,
        createdAt: log.actor.createdAt.toISOString(),
        avatarUrl: log.actor.avatarUrl
      } : null
    }))
  } catch (error) {
    console.error('Database error in getRecentActivity:', error)
    throw new DatabaseError('Failed to fetch recent activity', error)
  }
}

export async function getCourses(): Promise<Course[]> {
  try {
    const courses = await prisma.course.findMany({
      orderBy: { createdAt: 'desc' }
    }) as PrismaCourse[]
    
    return courses.map(course => ({
      id: course.id,
      title: course.title,
      description: course.description,
      version: course.version,
      scormPath: course.scormPath,
      createdAt: course.createdAt.toISOString(),
      enrollmentCount: course.enrollmentCount
    }))
  } catch (error) {
    console.error('Database error in getCourses:', error)
    throw new DatabaseError('Failed to fetch courses', error)
  }
}

export async function getUsers(): Promise<User[]> {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'learner' },
      orderBy: { createdAt: 'desc' }
    }) as PrismaUser[]
    
    return users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: mapUserRole(user.role),
      team: user.team,
      createdAt: user.createdAt.toISOString(),
      avatarUrl: user.avatarUrl
    }))
  } catch (error) {
    console.error('Database error in getUsers:', error)
    throw new DatabaseError('Failed to fetch users', error)
  }
}

export async function getEnrollmentsForCourse(courseId: string): Promise<Enrollment[]> {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId },
      include: {
        user: true,
        course: true
      }
    }) as EnrollmentWithRelations[]
    
    return enrollments.map(enrollment => ({
      id: enrollment.id,
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      status: mapEnrollmentStatus(enrollment.status),
      progress: enrollment.progress,
      assignedAt: enrollment.assignedAt.toISOString(),
      completedAt: enrollment.completedAt?.toISOString() ?? null,
      user: {
        id: enrollment.user.id,
        name: enrollment.user.name,
        email: enrollment.user.email,
        role: mapUserRole(enrollment.user.role),
        team: enrollment.user.team,
        createdAt: enrollment.user.createdAt.toISOString(),
        avatarUrl: enrollment.user.avatarUrl
      },
      course: {
        id: enrollment.course.id,
        title: enrollment.course.title,
        description: enrollment.course.description,
        version: enrollment.course.version,
        scormPath: enrollment.course.scormPath,
        createdAt: enrollment.course.createdAt.toISOString(),
        enrollmentCount: enrollment.course.enrollmentCount
      }
    }))
  } catch (error) {
    console.error('Database error in getEnrollmentsForCourse:', error)
    throw new DatabaseError('Failed to fetch enrollments for course', error)
  }
}

export async function getEnrollment(enrollmentId: string): Promise<Enrollment | undefined> {
  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        user: true,
        course: true
      }
    })
    
    if (!enrollment) return undefined
    
    return {
      id: enrollment.id,
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      status: mapEnrollmentStatus(enrollment.status),
      progress: enrollment.progress,
      assignedAt: enrollment.assignedAt.toISOString(),
      completedAt: enrollment.completedAt?.toISOString() ?? null,
      user: {
        id: enrollment.user.id,
        name: enrollment.user.name,
        email: enrollment.user.email,
        role: mapUserRole(enrollment.user.role),
        team: enrollment.user.team,
        createdAt: enrollment.user.createdAt.toISOString(),
        avatarUrl: enrollment.user.avatarUrl
      },
      course: {
        id: enrollment.course.id,
        title: enrollment.course.title,
        description: enrollment.course.description,
        version: enrollment.course.version,
        scormPath: enrollment.course.scormPath,
        createdAt: enrollment.course.createdAt.toISOString(),
        enrollmentCount: enrollment.course.enrollmentCount
      }
    }
  } catch (error) {
    console.error('Database error in getEnrollment:', error)
    throw new DatabaseError('Failed to fetch enrollment', error)
  }
}

export async function getCertificateForEnrollment(enrollmentId: string): Promise<Certificate | undefined> {
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
    console.error('Database error in getCertificateForEnrollment:', error)
    throw new DatabaseError('Failed to fetch certificate for enrollment', error)
  }
}

export async function getCertificateById(certificateId: string): Promise<Certificate | undefined> {
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
    console.error('Database error in getCertificateById:', error)
    throw new DatabaseError('Failed to fetch certificate by ID', error)
  }
}

/**
 * Create an enrollment with transaction support.
 * This ensures that if enrollment creation fails, no partial data is saved.
 * Also creates an audit log entry atomically.
 */
export async function createEnrollment(
  userId: string,
  courseId: string,
  actorId: string
): Promise<Enrollment> {
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

      // Map to return type
      return {
        id: enrollment.id,
        userId: enrollment.userId,
        courseId: enrollment.courseId,
        status: mapEnrollmentStatus(enrollment.status),
        progress: enrollment.progress,
        assignedAt: enrollment.assignedAt.toISOString(),
        completedAt: enrollment.completedAt?.toISOString() ?? null,
        user: {
          id: enrollment.user.id,
          name: enrollment.user.name,
          email: enrollment.user.email,
          role: enrollment.user.role as 'admin' | 'learner',
          team: enrollment.user.team,
          createdAt: enrollment.user.createdAt.toISOString(),
          avatarUrl: enrollment.user.avatarUrl,
        },
        course: {
          id: enrollment.course.id,
          title: enrollment.course.title,
          description: enrollment.course.description,
          version: enrollment.course.version,
          scormPath: enrollment.course.scormPath,
          createdAt: enrollment.course.createdAt.toISOString(),
          enrollmentCount: enrollment.course.enrollmentCount,
        },
      }
    })
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error
    }
    console.error('Database error in createEnrollment:', error)
    throw new DatabaseError('Failed to create enrollment', error)
  }
}
