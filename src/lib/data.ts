import type { User, Course, Enrollment, AuditLog, Certificate, EnrollmentStatus } from './types'
import { subDays, format } from 'date-fns'

const now = new Date()

// Mock Users
export const users: User[] = [
  { id: 'usr_1', name: 'Alice Johnson', email: 'alice@example.com', role: 'learner', team: 'Sales', createdAt: subDays(now, 25).toISOString(), avatarUrl: 'https://picsum.photos/seed/usr_1/100/100' },
  { id: 'usr_2', name: 'Bob Williams', email: 'bob@example.com', role: 'learner', team: 'Engineering', createdAt: subDays(now, 45).toISOString(), avatarUrl: 'https://picsum.photos/seed/usr_2/100/100' },
  { id: 'usr_3', name: 'Charlie Brown', email: 'charlie@example.com', role: 'learner', team: 'Marketing', createdAt: subDays(now, 10).toISOString(), avatarUrl: 'https://picsum.photos/seed/usr_3/100/100' },
  { id: 'usr_4', name: 'Diana Prince', email: 'diana@example.com', role: 'learner', team: 'Engineering', createdAt: subDays(now, 80).toISOString(), avatarUrl: 'https://picsum.photos/seed/usr_4/100/100' },
  { id: 'usr_5', name: 'Ethan Hunt', email: 'ethan@example.com', role: 'learner', team: 'Sales', createdAt: subDays(now, 5).toISOString(), avatarUrl: 'https://picsum.photos/seed/usr_5/100/100' },
  { id: 'usr_admin', name: 'Admin User', email: 'admin@cyberaware.com', role: 'admin', team: 'IT', createdAt: subDays(now, 365).toISOString(), avatarUrl: 'https://picsum.photos/seed/admin/100/100' },
]

// Mock Courses
export const courses: Course[] = [
  { id: 'crs_1', title: 'Phishing Awareness 101', description: 'Learn to identify and report phishing attempts.', version: '1.2', scormPath: '/scorm/phishing-101', createdAt: subDays(now, 60).toISOString(), enrollmentCount: 3 },
  { id: 'crs_2', title: 'Secure Password Practices', description: 'Create and manage strong, unique passwords.', version: '1.0', scormPath: '/scorm/passwords-10', createdAt: subDays(now, 90).toISOString(), enrollmentCount: 2 },
  { id: 'crs_3', title: 'Social Engineering Defense', description: 'Recognize and thwart social engineering tactics.', version: '2.0', scormPath: '/scorm/social-eng-20', createdAt: subDays(now, 30).toISOString(), enrollmentCount: 1 },
  { id: 'crs_4', title: 'Advanced Threat Protection', description: 'A deep dive into modern cyber threats for technical staff.', version: '1.5', scormPath: '/scorm/adv-threat-15', createdAt: subDays(now, 120).toISOString(), enrollmentCount: 1 },
]

// Mock Enrollments
export const enrollments: Enrollment[] = [
  { id: 'enr_1', userId: 'usr_1', courseId: 'crs_1', status: 'Completed', progress: 100, assignedAt: subDays(now, 20).toISOString(), completedAt: subDays(now, 18).toISOString(), user: users[0], course: courses[0] },
  { id: 'enr_2', userId: 'usr_2', courseId: 'crs_1', status: 'In Progress', progress: 50, assignedAt: subDays(now, 15).toISOString(), completedAt: null, user: users[1], course: courses[0] },
  { id: 'enr_3', userId: 'usr_3', courseId: 'crs_1', status: 'Not Started', progress: 0, assignedAt: subDays(now, 5).toISOString(), completedAt: null, user: users[2], course: courses[0] },
  { id: 'enr_4', userId: 'usr_1', courseId: 'crs_2', status: 'In Progress', progress: 25, assignedAt: subDays(now, 10).toISOString(), completedAt: null, user: users[0], course: courses[1] },
  { id: 'enr_5', userId: 'usr_4', courseId: 'crs_2', status: 'Completed', progress: 100, assignedAt: subDays(now, 40).toISOString(), completedAt: subDays(now, 35).toISOString(), user: users[3], course: courses[1] },
  { id: 'enr_6', userId: 'usr_5', courseId: 'crs_3', status: 'Not Started', progress: 0, assignedAt: subDays(now, 2).toISOString(), completedAt: null, user: users[4], course: courses[2] },
  { id: 'enr_7', userId: 'usr_2', courseId: 'crs_4', status: 'In Progress', progress: 75, assignedAt: subDays(now, 60).toISOString(), completedAt: null, user: users[1], course: courses[3] },
]

// Mock Audit Logs
export const auditLogs: AuditLog[] = [
  { id: 'aud_1', actorId: 'usr_admin', action: 'Course Uploaded', details: { courseTitle: 'Advanced Threat Protection' }, createdAt: subDays(now, 120).toISOString(), actor: users[5] },
  { id: 'aud_2', actorId: 'usr_admin', action: 'User Assigned', details: { user: 'Alice Johnson', course: 'Phishing Awareness 101' }, createdAt: subDays(now, 20).toISOString(), actor: users[5] },
  { id: 'aud_3', actorId: 'usr_1', action: 'Course Completed', details: { courseTitle: 'Phishing Awareness 101' }, createdAt: subDays(now, 18).toISOString(), actor: users[0] },
  { id: 'aud_4', actorId: 'gophish_webhook', action: 'User Assigned (Auto)', details: { user: 'Charlie Brown', course: 'Phishing Awareness 101', reason: 'Failed phishing test' }, createdAt: subDays(now, 5).toISOString(), actor: { id: 'sys_gophish', name: 'GoPhish Hook', email: 'system@internal', role: 'admin', team: 'System', createdAt: now.toISOString(), avatarUrl: '' } },
  { id: 'aud_5', actorId: 'usr_2', action: 'Course Started', details: { courseTitle: 'Advanced Threat Protection' }, createdAt: subDays(now, 60).toISOString(), actor: users[1] },
]

// Mock Certificates
export const certificates: Certificate[] = [
  { id: 'cert_1', enrollmentId: 'enr_1', path: '/certs/cert_1.pdf', issuedAt: subDays(now, 18).toISOString(), uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
  { id: 'cert_2', enrollmentId: 'enr_5', path: '/certs/cert_2.pdf', issuedAt: subDays(now, 35).toISOString(), uuid: 'a1b2c3d4-e5f6-7890-1234-567890abcdef' },
]

// API-like functions
export async function getDashboardStats() {
  const totalUsers = users.filter(u => u.role === 'learner').length
  const totalCourses = courses.length
  const completed = enrollments.filter(e => e.status === 'Completed').length
  const inProgress = enrollments.filter(e => e.status === 'In Progress').length
  return { totalUsers, totalCourses, completed, inProgress }
}

export async function getCompletionData() {
    const data: { date: string, Completed: number, 'In Progress': number }[] = [];
    for (let i = 29; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const formattedDate = format(date, 'MMM dd');
        
        const completedOnDay = enrollments.filter(e => e.completedAt && format(new Date(e.completedAt), 'MMM dd') === formattedDate).length;
        
        const inProgressOnDay = enrollments.filter(e => {
            const assignedDate = new Date(e.assignedAt);
            return assignedDate <= date && (e.completedAt === null || new Date(e.completedAt) > date);
        }).length;

        data.push({
            date: formattedDate,
            'Completed': completedOnDay,
            'In Progress': inProgressOnDay,
        });
    }
    return data;
}

export async function getRecentActivity(): Promise<AuditLog[]> {
  return auditLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)
}

export async function getCourses(): Promise<Course[]> {
  return courses
}

export async function getUsers(): Promise<User[]> {
    return users.filter(u => u.role === 'learner');
}

export async function getEnrollmentsForCourse(courseId: string): Promise<Enrollment[]> {
  return enrollments.filter(e => e.courseId === courseId);
}

export async function getEnrollment(enrollmentId: string): Promise<Enrollment | undefined> {
    return enrollments.find(e => e.id === enrollmentId);
}

export async function getCertificateForEnrollment(enrollmentId: string): Promise<Certificate | undefined> {
    return certificates.find(c => c.enrollmentId === enrollmentId);
}
