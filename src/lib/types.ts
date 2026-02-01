export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[]

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
  cmiData: JsonValue;
  lastLocation: string;
  completionStatus?: string | null;
  successStatus?: string | null;
  scoreRaw?: number | null;
  scoreMin?: number | null;
  scoreMax?: number | null;
  totalTimeSeconds?: number | null;
  sessionTimeSeconds?: number | null;
  lastCommitAt?: string | null;
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
  actorId: string | null;
  action: string;
  details: JsonValue;
  createdAt: string;
  actor: User | null;
}
