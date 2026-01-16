import type { User, Course, Enrollment, AuditLog, Certificate, EnrollmentStatus } from './types'
import { subDays, format } from 'date-fns'
import { prisma } from './prisma'

// Helper function to map Prisma enum values to TypeScript types
function mapEnrollmentStatus(status: string): EnrollmentStatus {
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
}

export async function getCompletionData() {
  const data: { date: string, Completed: number, 'In Progress': number }[] = [];
  const now = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = subDays(now, i);
    const formattedDate = format(date, 'MMM dd');
    
    // Create date boundaries for the day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Get completed enrollments on this day
    const completedOnDay = await prisma.enrollment.count({
      where: {
        completedAt: {
          gte: startOfDay,
          lt: endOfDay
        }
      }
    });
    
    // Get in-progress enrollments (assigned before or on this day, not completed or completed after)
    const inProgressEnrollments = await prisma.enrollment.findMany({
      where: {
        assignedAt: { lte: endOfDay },
        status: 'InProgress',
        OR: [
          { completedAt: null },
          { completedAt: { gt: endOfDay } }
        ]
      }
    });
    
    const inProgressOnDay = inProgressEnrollments.length;

    data.push({
      date: formattedDate,
      'Completed': completedOnDay,
      'In Progress': inProgressOnDay,
    });
  }
  return data;
}

export async function getRecentActivity(): Promise<AuditLog[]> {
  const logs = await prisma.auditLog.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      actor: true
    }
  })
  
  return logs.map(log => ({
    id: log.id,
    actorId: log.actorId,
    action: log.action,
    details: log.details as Record<string, any>,
    createdAt: log.createdAt.toISOString(),
    actor: {
      id: log.actor.id,
      name: log.actor.name,
      email: log.actor.email,
      role: log.actor.role as 'admin' | 'learner',
      team: log.actor.team,
      createdAt: log.actor.createdAt.toISOString(),
      avatarUrl: log.actor.avatarUrl
    }
  }))
}

export async function getCourses(): Promise<Course[]> {
  const courses = await prisma.course.findMany({
    orderBy: { createdAt: 'desc' }
  })
  
  return courses.map(course => ({
    id: course.id,
    title: course.title,
    description: course.description,
    version: course.version,
    scormPath: course.scormPath,
    createdAt: course.createdAt.toISOString(),
    enrollmentCount: course.enrollmentCount
  }))
}

export async function getUsers(): Promise<User[]> {
  const users = await prisma.user.findMany({
    where: { role: 'learner' },
    orderBy: { createdAt: 'desc' }
  })
  
  return users.map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as 'admin' | 'learner',
    team: user.team,
    createdAt: user.createdAt.toISOString(),
    avatarUrl: user.avatarUrl
  }))
}

export async function getEnrollmentsForCourse(courseId: string): Promise<Enrollment[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId },
    include: {
      user: true,
      course: true
    }
  })
  
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
      role: enrollment.user.role as 'admin' | 'learner',
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
}

export async function getEnrollment(enrollmentId: string): Promise<Enrollment | undefined> {
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
      role: enrollment.user.role as 'admin' | 'learner',
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
}

export async function getCertificateForEnrollment(enrollmentId: string): Promise<Certificate | undefined> {
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
}
