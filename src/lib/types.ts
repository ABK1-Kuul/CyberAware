export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'learner';
  team: string;
  createdAt: string;
  avatarUrl: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  version: string;
  scormPath: string;
  createdAt: string;
  enrollmentCount: number;
}

export type EnrollmentStatus = 'Not Started' | 'In Progress' | 'Completed';

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  status: EnrollmentStatus;
  progress: number;
  assignedAt: string;
  completedAt: string | null;
  user: User;
  course: Course;
}

export interface ScormData {
  id: string;
  enrollmentId: string;
  cmiData: Record<string, any>;
  lastLocation: string;
}

export interface Certificate {
  id: string;
  enrollmentId: string;
  path: string;
  issuedAt: string;
  uuid: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  details: Record<string, any>;
  createdAt: string;
  actor: User;
}
