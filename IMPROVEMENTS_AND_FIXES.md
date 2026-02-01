# CyberAware: Comprehensive Improvements & Fixes

This document outlines all improvements and fixes that should be applied to the CyberAware project, organized by priority and category.

---

## ✅ Current Status (in repo)

**Completed (implemented)**
- 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
- 2.1, 2.2, 2.4, 2.5
- 3.1, 3.2, 3.3
- 4.2, 4.3, 4.4 (4.1 intentionally skipped)
- 4.5 (certificate lookup by ID)
- 5.1, 5.3, 5.4
- 6.1, 6.2, 6.3
- 7.1, 7.2, 7.3, 7.4, 7.5
- 8.1
- 10.1, 10.2

**Partially completed / pending**
- 2.3 (DB migration step depends on environment)
- 5.2: Request-level caching via `React.cache()` and `/api/courses` + `/api/users` added. SWR not installed due to npm cache restriction.
- 8.4: Schema updated with composite indexes; needs `npm run db:push` to apply.

**Not started**
- 8.2, 8.3
- 9.1–9.5
- 10.2–10.5
- 11–14

---

## 🔴 CRITICAL FIXES (Must Fix Immediately)

### 1. Security Issues

#### 1.1 Remove Build Error Suppression
**File**: `next.config.ts`
**Issue**: TypeScript and ESLint errors are being ignored during builds
**Fix**: Remove `ignoreBuildErrors: true` and `ignoreDuringBuilds: true`
```typescript
// REMOVE these lines:
typescript: {
  ignoreBuildErrors: true,  // ❌ REMOVE
},
eslint: {
  ignoreDuringBuilds: true,  // ❌ REMOVE
},
```
**Impact**: Production builds may contain type errors and linting issues  
**Status**: ✅ Done

#### 1.2 Missing Environment Variable Validation
**Files**: `src/lib/prisma.ts`, `src/ai/genkit.ts`
**Issue**: No validation that required environment variables exist
**Fix**: Create `src/lib/env.ts`:
```typescript
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  GOOGLE_GENAI_API_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GOPHISH_WEBHOOK_SECRET: z.string().optional(),
})

export const env = envSchema.parse(process.env)
```
**Impact**: App may crash at runtime with unclear error messages  
**Status**: ✅ Done (`src/lib/env.ts` + enforced usage)

#### 1.3 Webhook Security - No Authentication
**File**: `src/app/api/integrations/gophish/webhook/route.ts`
**Issue**: Webhook accepts requests without authentication
**Fix**: Implement HMAC signature verification:
```typescript
import crypto from 'crypto'

const verifyWebhookSignature = (payload: string, signature: string, secret: string): boolean => {
  const hmac = crypto.createHmac('sha256', secret)
  const digest = hmac.update(payload).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
}
```
**Impact**: Anyone can trigger course assignments  
**Status**: ✅ Done (HMAC verification + payload validation)

#### 1.4 No Input Validation/Sanitization
**Files**: All API routes
**Issue**: No validation of incoming data
**Fix**: Add Zod schemas for all API inputs:
```typescript
import { z } from 'zod'

const webhookPayloadSchema = z.object({
  email: z.string().email(),
  details: z.string(),
  // ... other fields
})
```
**Impact**: SQL injection, XSS, data corruption risks  
**Status**: ✅ Done for updated routes (Zod + validation)

#### 1.5 Hardcoded Certificate ID
**File**: `src/app/learn/[enrollmentId]/page.tsx` (line 36)
**Issue**: Hardcoded certificate ID `cert_1`
**Fix**: Use actual certificate lookup:
```typescript
const certificate = await getCertificateForEnrollment(enrollment.id)
if (certificate) {
  // Use certificate.id instead of 'cert_1'
}
```
**Impact**: Certificate links will always fail  
**Status**: ✅ Done (dynamic certificate lookup)

#### 1.6 Missing Certificate Page Import
**File**: `src/app/certificate/[certificateId]/page.tsx`
**Issue**: Missing `Button` import
**Fix**: Add import:
```typescript
import { Button } from "@/components/ui/button"
```
**Status**: ✅ Done

---

### 2. Database & Data Layer Issues

#### 2.1 No Database Connection Error Handling
**File**: `src/lib/data.ts`
**Issue**: Prisma queries have no try-catch blocks
**Fix**: Wrap all database operations:
```typescript
export async function getCourses(): Promise<Course[]> {
  try {
    const courses = await prisma.course.findMany({...})
    return courses.map(...)
  } catch (error) {
    console.error('Database error in getCourses:', error)
    throw new Error('Failed to fetch courses')
  }
}
```
**Impact**: Unhandled database errors crash the app  
**Status**: ✅ Done (consistent try/catch + `DatabaseError`)

#### 2.2 No Database Connection Pooling Configuration
**File**: `src/lib/prisma.ts`
**Issue**: No connection pool limits configured
**Fix**: Add connection pool configuration:
```typescript
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})
// Add connection pool URL parameters in DATABASE_URL:
// mysql://user:pass@host:3306/db?connection_limit=10&pool_timeout=20
```
**Impact**: Potential connection exhaustion under load  
**Status**: ✅ Done (documented via `DATABASE_URL` params)

#### 2.3 Missing Prisma Migration
**Issue**: Initial migration hasn't been generated
**Fix**: Run:
```bash
npm run db:migrate
```
**Impact**: Database schema may not match Prisma schema  
**Status**: ⏳ Pending (environment-specific step)

#### 2.4 No Transaction Support
**File**: `src/lib/data.ts`
**Issue**: Multi-step operations not wrapped in transactions
**Fix**: Use Prisma transactions for operations like enrollment creation:
```typescript
export async function createEnrollment(userId: string, courseId: string) {
  return await prisma.$transaction(async (tx) => {
    const enrollment = await tx.enrollment.create({...})
    await tx.auditLog.create({...})
    return enrollment
  })
}
```
**Impact**: Data inconsistency if operations fail mid-way  
**Status**: ✅ Done (`createEnrollment` uses `$transaction`)

#### 2.5 Inefficient Query in getCompletionData
**File**: `src/lib/data.ts` (lines 34-79)
**Issue**: 30 separate database queries in a loop
**Fix**: Use single query with date grouping:
```typescript
// Use Prisma raw query or optimize with date_trunc equivalent
const results = await prisma.$queryRaw`
  SELECT DATE(completed_at) as date, COUNT(*) as count
  FROM enrollments
  WHERE completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
  GROUP BY DATE(completed_at)
`
```
**Impact**: Slow dashboard loading, database load  
**Status**: ✅ Done (single query + optimized data shape)

---

### 3. Type Safety Issues

#### 3.1 Unsafe Type Assertions
**File**: `src/lib/data.ts`
**Issue**: Multiple `as` type assertions without validation
**Fix**: Use proper type guards or Zod schemas:
```typescript
// Instead of: role: log.actor.role as 'admin' | 'learner'
// Use:
const role = log.actor.role === 'admin' || log.actor.role === 'learner' 
  ? log.actor.role 
  : 'learner'
```
**Impact**: Runtime type errors possible  
**Status**: ✅ Done (type guards + helper mapping)

#### 3.2 Missing Type Validation for Prisma Enums
**File**: `src/lib/data.ts` (mapEnrollmentStatus function)
**Issue**: Function accepts `string` but should accept Prisma enum type
**Fix**: Use proper Prisma enum types:
```typescript
import { EnrollmentStatus as PrismaEnrollmentStatus } from '@prisma/client'

function mapEnrollmentStatus(status: PrismaEnrollmentStatus): EnrollmentStatus {
  // ...
}
```
**Impact**: Type safety compromised  
**Status**: ✅ Done (strict enum mapping)

#### 3.3 Missing Error Types
**Issue**: No custom error classes
**Fix**: Create `src/lib/errors.ts`:
```typescript
export class DatabaseError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message)
    this.name = 'DatabaseError'
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
```
**Status**: ✅ Done

---

## 🟠 HIGH PRIORITY FIXES (Fix Soon)

### 4. Missing Core Functionality

#### 4.1 No Authentication System
**Files**: `src/app/page.tsx`, `src/app/(admin)/layout.tsx`
**Issue**: Login page is just UI, no actual auth
**Fix**: Implement NextAuth.js or Clerk:
- Create `src/lib/auth.ts` with auth configuration
- Add middleware for protected routes
- Update login page to use real authentication
**Impact**: No security, anyone can access admin panel

#### 4.2 Upload Dialog Doesn't Upload
**File**: `src/components/app/courses/upload-course-dialog.tsx`
**Issue**: `handleUpload` only shows toast, doesn't upload
**Fix**: Implement file upload API route and connect it:
```typescript
const handleUpload = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch('/api/courses/upload', {
    method: 'POST',
    body: formData,
  })
  // Handle response
}
```
**Impact**: Feature completely non-functional  
**Status**: ✅ Done (`POST /api/courses/upload` + wired UI)

#### 4.3 Assign Learner Dialog Doesn't Assign
**File**: `src/components/app/courses/course-table.tsx` (lines 44-84)
**Issue**: `handleAssign` only shows toast, doesn't create enrollment
**Fix**: Create API route and connect:
```typescript
const handleAssign = async (userId: string, courseId: string) => {
  await fetch('/api/enrollments', {
    method: 'POST',
    body: JSON.stringify({ userId, courseId }),
  })
}
```
**Impact**: Feature completely non-functional  
**Status**: ✅ Done (`POST /api/enrollments` + wired UI)

#### 4.4 Course Player is Simulated
**File**: `src/app/learn/[enrollmentId]/page.tsx`
**Issue**: No real SCORM player, just placeholder
**Fix**: Implement SCORM runtime API and player component
**Impact**: Core feature doesn't work  
**Status**: ✅ Partial (completion API + actions wired; SCORM player still TODO)

#### 4.5 Certificate Page Uses Hardcoded ID
**File**: `src/app/certificate/[certificateId]/page.tsx` (line 10)
**Issue**: Uses hardcoded `'enr_1'` instead of `certificateId` param
**Fix**: Look up certificate by UUID:
```typescript
const certificate = await prisma.certificate.findUnique({
  where: { uuid: params.certificateId }
})
```
**Impact**: Certificate verification doesn't work  
**Status**: ✅ Done (certificate lookup by ID)

---

### 5. Performance Issues

#### 5.1 No Pagination
**Files**: `src/lib/data.ts` - `getCourses()`, `getUsers()`, `getEnrollmentsForCourse()`
**Issue**: All queries fetch all records
**Fix**: Add pagination:
```typescript
export async function getCourses(page = 1, pageSize = 10) {
  const skip = (page - 1) * pageSize
  const [courses, total] = await Promise.all([
    prisma.course.findMany({ skip, take: pageSize }),
    prisma.course.count(),
  ])
  return { courses, total, page, pageSize }
}
```
**Impact**: Slow queries with large datasets  
**Status**: ✅ Done (paginated APIs + UI pagination)

#### 5.2 No Caching
**Issue**: No caching layer for frequently accessed data
**Fix**: Add React Query or SWR:
```typescript
import useSWR from 'swr'

const { data, error } = useSWR('/api/courses', fetcher, {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
})
```
**Impact**: Unnecessary database queries, slow UI  
**Status**: ⚠️ Partial (request-level caching via `React.cache()`, `/api/courses` + `/api/users` added; SWR not installed)

#### 5.3 N+1 Query Problem
**File**: `src/lib/data.ts` - `getEnrollmentsForCourse()`
**Issue**: Already uses `include`, but check other functions
**Fix**: Ensure all relations are fetched in single query
**Impact**: Multiple database round trips  
**Status**: ✅ Done (audit complete)

#### 5.4 No Loading States
**Files**: All page components
**Issue**: No loading indicators while fetching data
**Fix**: Add Suspense boundaries and loading skeletons:
```typescript
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

<Suspense fallback={<Skeleton />}>
  <DashboardContent />
</Suspense>
```
**Impact**: Poor UX, appears broken while loading  
**Status**: ✅ Done (loading skeletons for dashboard/courses/learn)

---

### 6. Error Handling

#### 6.1 No Error Boundaries
**Issue**: No React error boundaries
**Fix**: Create `src/components/error-boundary.tsx`:
```typescript
'use client'
import { Component, ReactNode } from 'react'

export class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean}> {
  // Implementation
}
```
**Impact**: Entire app crashes on any error  
**Status**: ✅ Done (`app/error.tsx`, `(admin)/error.tsx`, error boundary component)

#### 6.2 Generic Error Messages
**File**: `src/app/api/integrations/gophish/webhook/route.ts`
**Issue**: Returns generic "Error processing webhook"
**Fix**: Return specific error messages (but don't leak sensitive info):
```typescript
catch (error) {
  console.error('Error:', error)
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
```
**Impact**: Difficult to debug issues  
**Status**: ✅ Done (specific, non-leaky errors)

#### 6.3 No Error Logging
**Issue**: Only console.error, no structured logging
**Fix**: Add logging service (Winston, Pino, or Sentry):
```typescript
import { logger } from '@/lib/logger'

logger.error('Database error', { error, context })
```
**Impact**: Can't track errors in production  
**Status**: ✅ Done (minimal structured logger in `src/lib/logger.ts`)

---

## 🟡 MEDIUM PRIORITY IMPROVEMENTS

### 7. Code Quality

#### 7.1 Inconsistent Error Handling Patterns
**Issue**: Some functions throw, some return undefined, some return null
**Fix**: Standardize error handling:
- Use Result types or consistent error throwing
- Document error behavior in JSDoc
**Status**: ✅ Done (consistent `DatabaseError`/`ValidationError` patterns + JSDoc)

#### 7.2 Missing JSDoc Comments
**Issue**: No documentation for functions
**Fix**: Add JSDoc to all exported functions:
```typescript
/**
 * Fetches all courses from the database
 * @returns Promise resolving to array of Course objects
 * @throws {DatabaseError} If database query fails
 */
export async function getCourses(): Promise<Course[]> {
  // ...
}
```
**Status**: ✅ Done (data layer exports documented)

#### 7.3 Magic Numbers/Strings
**File**: `src/lib/data.ts` (line 38: `for (let i = 29; i >= 0; i--)`)
**Issue**: Hardcoded `29` for 30 days
**Fix**: Extract to constants:
```typescript
const DASHBOARD_CHART_DAYS = 30
```
**Status**: ✅ Done (`DASHBOARD_CHART_DAYS`, `DEFAULT_PAGE_SIZE`, etc.)

#### 7.4 Duplicate Code
**File**: `src/lib/data.ts`
**Issue**: Similar mapping logic repeated in multiple functions
**Fix**: Extract to helper functions:
```typescript
function mapPrismaUserToUser(prismaUser: PrismaUser): User {
  // Common mapping logic
}
```
**Status**: ✅ Done (shared mapping helpers)

#### 7.5 Missing Input Validation
**File**: All data access functions
**Issue**: No validation of input parameters (e.g., empty strings, invalid IDs)
**Fix**: Add parameter validation:
```typescript
export async function getEnrollment(enrollmentId: string) {
  if (!enrollmentId || enrollmentId.trim() === '') {
    throw new ValidationError('enrollmentId is required')
  }
  // ...
}
```
**Status**: ✅ Done (`ValidationError` + input guards)

---

### 8. Database Schema Improvements

#### 8.1 Missing Constraints
**File**: `prisma/schema.prisma`
**Issue**: No check constraints for progress (0-100)
**Fix**: Add validation in application layer or use Prisma validation:
```prisma
// Note: MySQL doesn't support check constraints well, validate in app
```
**Status**: ✅ Done (clamped progress in completion API; constants)

#### 8.2 Missing Soft Deletes
**Issue**: No soft delete support
**Fix**: Add `deletedAt` field to models:
```prisma
model Course {
  deletedAt DateTime? @map("deleted_at")
  // ...
}
```

#### 8.3 Missing Updated Timestamps
**Issue**: Only `createdAt`, no `updatedAt`
**Fix**: Add `updatedAt` to all models:
```prisma
updatedAt DateTime @updatedAt @map("updated_at")
```

#### 8.4 Missing Indexes
**Issue**: Some frequently queried fields not indexed
**Fix**: Review query patterns and add indexes:
```prisma
model Enrollment {
  // Add composite index for common queries
  @@index([userId, status])
  @@index([courseId, status])
}
```
**Status**: ✅ Done in schema, pending `npm run db:push`

---

### 9. API Improvements

#### 9.1 No API Versioning
**Issue**: API routes don't have versioning
**Fix**: Add version prefix:
```
/api/v1/courses
/api/v1/enrollments
```
**Status**: ✅ Done (v1 routes added; re-exported handlers)

#### 9.2 No Rate Limiting
**Issue**: No rate limiting on API routes
**Fix**: Add rate limiting middleware:
```typescript
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  await rateLimit(request)
  // ...
}
```
**Status**: ✅ Done (in-memory limiter on API routes)

#### 9.3 No Request Logging
**Issue**: No logging of API requests
**Fix**: Add request logging middleware
**Status**: ✅ Done (request logging helper wired to API routes)

#### 9.4 Missing HTTP Status Codes
**File**: API routes
**Issue**: Some routes return 200 for errors
**Fix**: Use proper status codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 404: Not Found
- 500: Internal Server Error
**Status**: ✅ Done (current API routes return proper status codes)

#### 9.5 No API Documentation
**Issue**: No OpenAPI/Swagger documentation
**Fix**: Add API documentation using Swagger/OpenAPI

---

### 10. UI/UX Improvements

#### 10.1 No Empty States
**Issue**: No empty state components when no data
**Fix**: Add empty state components:
```typescript
if (courses.length === 0) {
  return <EmptyState message="No courses found" />
}
```
**Status**: ✅ Done (courses + recent activity)

#### 10.2 No Optimistic Updates
**Issue**: UI doesn't update optimistically
**Fix**: Use React Query mutations with optimistic updates
**Status**: ✅ Done (assign: optimistic enrollment count; upload: optimistic course add on page 1)

#### 10.3 Hardcoded Text
**Issue**: Text hardcoded in components
**Fix**: Extract to constants or i18n:
```typescript
const MESSAGES = {
  COURSE_UPLOAD_SUCCESS: 'Course uploaded successfully',
  // ...
}
```
**Status**: ✅ Done (centralized UI text in `src/lib/ui-messages.ts`)

#### 10.4 Missing Accessibility
**Issue**: Missing ARIA labels, keyboard navigation
**Fix**: Add proper accessibility attributes:
```typescript
<Button aria-label="Upload course">
  <UploadCloud />
</Button>
```
**Status**: ✅ Partial (ARIA labels added to upload controls; more to do)

#### 10.5 No Form Validation Feedback
**File**: `src/components/app/courses/upload-course-dialog.tsx`
**Issue**: File input has no validation feedback
**Fix**: Add file validation and error messages:
```typescript
const [error, setError] = useState<string | null>(null)

const validateFile = (file: File) => {
  if (file.size > MAX_FILE_SIZE) {
    setError('File too large')
    return false
  }
  if (!file.name.endsWith('.zip')) {
    setError('Must be a ZIP file')
    return false
  }
  return true
}
```
**Status**: ✅ Done (inline error message + toasts)

---

## 🟢 LOW PRIORITY IMPROVEMENTS

### 11. Developer Experience

#### 11.1 Missing .env.example
**Issue**: No example environment file
**Fix**: Create `.env.example`:
```env
DATABASE_URL="mysql://user:password@localhost:3306/cyberaware"
GOOGLE_GENAI_API_KEY=your_key_here
GOPHISH_WEBHOOK_SECRET=your_secret_here
NODE_ENV=development
```

#### 11.2 No Pre-commit Hooks
**Issue**: No linting/formatting on commit
**Fix**: Add Husky + lint-staged:
```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"]
  }
}
```

#### 11.3 Missing Scripts
**Issue**: Missing useful scripts
**Fix**: Add scripts:
```json
{
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "db:reset": "prisma migrate reset",
    "db:seed": "tsx prisma/seed.ts"
  }
}
```

#### 11.4 No Docker Setup
**Issue**: No Docker configuration
**Fix**: Add `Dockerfile` and `docker-compose.yml` for local development

#### 11.5 Missing CI/CD
**Issue**: No CI/CD pipeline
**Fix**: Add GitHub Actions workflow:
- Run tests
- Type checking
- Linting
- Build verification

---

### 12. Testing

#### 12.1 No Tests
**Issue**: Zero test coverage
**Fix**: Add testing framework:
- Jest + React Testing Library for unit/integration tests
- Playwright for E2E tests
- Start with critical paths (auth, enrollment, course upload)

#### 12.2 No Test Data Fixtures
**Issue**: No test data setup
**Fix**: Create test fixtures and seed data

---

### 13. Monitoring & Observability

#### 13.1 No Error Tracking
**Issue**: No error tracking service
**Fix**: Integrate Sentry or similar:
```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.init({ dsn: process.env.SENTRY_DSN })
```

#### 13.2 No Performance Monitoring
**Issue**: No APM
**Fix**: Add performance monitoring (New Relic, Datadog, etc.)

#### 13.3 No Analytics
**Issue**: No user analytics
**Fix**: Add analytics (Google Analytics, Mixpanel, etc.)

---

### 14. Documentation

#### 14.1 Missing API Documentation
**Issue**: No API docs
**Fix**: Add OpenAPI/Swagger documentation

#### 14.2 Missing Component Documentation
**Issue**: No Storybook or component docs
**Fix**: Add Storybook for UI components

#### 14.3 Missing Deployment Guide
**Issue**: No deployment instructions
**Fix**: Add deployment guide to README

#### 14.4 Missing Contributing Guide
**Issue**: No CONTRIBUTING.md
**Fix**: Add contributing guidelines

---

## 📋 Summary Checklist

### Critical (Do First)
- [ ] Remove build error suppression
- [ ] Add environment variable validation
- [ ] Implement webhook authentication
- [ ] Add input validation/sanitization
- [ ] Fix hardcoded certificate ID
- [ ] Add database error handling
- [ ] Generate Prisma migration
- [ ] Optimize getCompletionData query

### High Priority (Do Next)
- [ ] Implement authentication system
- [ ] Fix upload dialog functionality
- [ ] Fix assign learner functionality
- [ ] Implement SCORM player
- [ ] Fix certificate page lookup
- [ ] Add pagination
- [ ] Add caching
- [ ] Add loading states
- [ ] Add error boundaries

### Medium Priority (Do Soon)
- [ ] Standardize error handling
- [ ] Add JSDoc comments
- [ ] Extract magic numbers/strings
- [ ] Add soft deletes
- [ ] Add updatedAt timestamps
- [ ] Add API versioning
- [ ] Add rate limiting
- [ ] Add empty states
- [ ] Improve accessibility

### Low Priority (Do Eventually)
- [ ] Add .env.example
- [ ] Add pre-commit hooks
- [ ] Add Docker setup
- [ ] Add CI/CD
- [ ] Add tests
- [ ] Add error tracking
- [ ] Add API documentation
- [ ] Add deployment guide

---

## 🎯 Recommended Implementation Order

1. **Week 1**: Critical fixes (security, error handling, database)
2. **Week 2**: High priority fixes (authentication, core functionality)
3. **Week 3**: Medium priority (code quality, API improvements)
4. **Week 4**: Low priority (testing, documentation, DX improvements)

---

## 📝 Notes

- This list is comprehensive but not exhaustive
- Some items may be addressed as part of milestone work
- Prioritize based on business needs and user impact
- Regular code reviews will help catch issues early
