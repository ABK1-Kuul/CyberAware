# CyberAware Project Analysis

## Executive Summary

**CyberAware** (codenamed **RedFox**) is a modern, enterprise-grade cybersecurity training platform built with Next.js 15, TypeScript, MySQL, and Prisma. The platform enables organizations to deliver SCORM-compliant security courses with intelligent automation, progress tracking, and certificate generation.

**Current Status**: Active development - Foundation complete, core features in progress
**Database**: Migrated from Firebase to MySQL with Prisma ORM ✅
**UI/UX**: Complete dark-themed design system with 30+ Shadcn UI components ✅

---

## Project Overview

### Purpose
A Learning Management System (LMS) specifically designed for cybersecurity training that:
- Delivers SCORM-compliant training courses
- Tracks employee progress and completion rates
- Automates course assignments based on security events (GoPhish integration)
- Generates professional completion certificates
- Provides comprehensive admin dashboards

### Design Philosophy
Inspired by the rare Ethiopian fox, emphasizing:
- **Agility**: Fast, responsive interface
- **Alertness**: Real-time progress tracking
- **Unique Presence**: Distinctive dark-themed UI with Fox Red (#FF4500) branding

---

## Technology Stack

### Frontend
- **Framework**: Next.js 15.3.3 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3.4.1 + Shadcn UI (30+ components)
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts 2.15.1
- **Icons**: Lucide React
- **State Management**: React hooks + Next.js server components

### Backend & Database
- **Database**: MySQL 8.0+
- **ORM**: Prisma 5.22.0
- **API**: Next.js API Routes (Serverless Functions)
- **File Storage**: Not yet implemented (planned: S3/Cloudinary/local)

### AI & Integrations
- **AI Framework**: Google Genkit 1.20.0
- **AI Model**: Gemini 2.5 Flash
- **Webhooks**: GoPhish integration endpoint (partial implementation)

### Development Tools
- **Package Manager**: npm
- **Build Tool**: Next.js Turbopack
- **Linting**: ESLint
- **Type Checking**: TypeScript (strict mode)

---

## Architecture

### Application Structure

```
CyberAware/
├── src/
│   ├── ai/                    # AI/Genkit integration
│   │   ├── dev.ts             # Genkit dev server config
│   │   └── genkit.ts          # Genkit instance (Gemini 2.5 Flash)
│   │
│   ├── app/                   # Next.js App Router
│   │   ├── (admin)/           # Protected admin routes
│   │   │   ├── dashboard/    # Analytics dashboard
│   │   │   ├── courses/      # Course management
│   │   │   ├── users/        # User management
│   │   │   ├── settings/     # System settings
│   │   │   └── layout.tsx    # Admin layout with sidebar
│   │   │
│   │   ├── api/              # API routes
│   │   │   └── integrations/
│   │   │       └── gophish/
│   │   │           └── webhook/route.ts  # GoPhish webhook handler
│   │   │
│   │   ├── learn/            # Course player
│   │   │   └── [enrollmentId]/page.tsx
│   │   │
│   │   ├── certificate/      # Certificate display
│   │   │   └── [certificateId]/page.tsx
│   │   │
│   │   ├── globals.css       # Global styles & theme
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Landing/login page
│   │
│   ├── components/
│   │   ├── app/              # Feature-specific components
│   │   │   ├── app-sidebar.tsx
│   │   │   ├── certificate-display.tsx
│   │   │   ├── courses/
│   │   │   │   ├── course-table.tsx
│   │   │   │   └── upload-course-dialog.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── completion-chart.tsx
│   │   │   │   ├── recent-activity-table.tsx
│   │   │   │   └── stats-cards.tsx
│   │   │   └── header.tsx
│   │   │
│   │   └── ui/               # Shadcn UI components (30+)
│   │
│   ├── hooks/                # Custom React hooks
│   │   ├── use-mobile.tsx
│   │   └── use-toast.ts
│   │
│   └── lib/                  # Shared utilities
│       ├── data.ts           # Data access layer (Prisma)
│       ├── prisma.ts         # Prisma client singleton
│       ├── types.ts          # TypeScript type definitions
│       └── utils.ts          # Utility functions
│
├── prisma/
│   ├── schema.prisma         # Database schema (MySQL)
│   ├── seed.sql              # SQL dump with initial data
│   ├── MIGRATION_GUIDE.md    # Database setup guide
│   └── README.md             # Prisma documentation
│
└── docs/
    ├── blueprint.md          # Core feature specifications
    └── IMPROVEMENTS_AND_MILESTONES.md  # Development roadmap
```

---

## Database Schema (Prisma)

### Models

1. **User**
   - Fields: id, name, email (unique), role (enum: admin/learner), team, createdAt, avatarUrl
   - Relations: enrollments, auditLogs
   - Indexes: email, role

2. **Course**
   - Fields: id, title, description, version, scormPath, createdAt, enrollmentCount
   - Relations: enrollments
   - Indexes: createdAt

3. **Enrollment**
   - Fields: id, userId, courseId, status (enum: NotStarted/InProgress/Completed), progress (0-100), assignedAt, completedAt
   - Relations: user, course, scormData (optional), certificate (optional)
   - Indexes: userId, courseId, status, assignedAt, completedAt
   - Unique: (userId, courseId)

4. **ScormData**
   - Fields: id, enrollmentId (unique), cmiData (JSON), lastLocation
   - Relations: enrollment
   - Purpose: Stores SCORM runtime tracking data

5. **Certificate**
   - Fields: id, enrollmentId (unique), path, issuedAt, uuid (unique)
   - Relations: enrollment
   - Indexes: uuid, issuedAt

6. **AuditLog**
   - Fields: id, actorId, action, details (JSON), createdAt
   - Relations: actor (User)
   - Indexes: actorId, createdAt, action

### Key Features
- Foreign keys with cascade deletes
- Indexes on frequently queried fields
- Enum types for status and roles
- JSON columns for flexible data storage (SCORM data, audit details)

---

## Data Access Layer

### Location: `src/lib/data.ts`

All data access functions use Prisma queries:

- `getDashboardStats()` - Aggregates users, courses, enrollments
- `getCompletionData()` - Time-series completion data (30 days)
- `getRecentActivity()` - Latest 5 audit log entries with user relations
- `getCourses()` - All courses ordered by creation date
- `getUsers()` - All learners ordered by creation date
- `getEnrollmentsForCourse(courseId)` - Enrollments for a specific course
- `getEnrollment(enrollmentId)` - Single enrollment with relations
- `getCertificateForEnrollment(enrollmentId)` - Certificate lookup

**Status Mapping**: Automatically converts Prisma enum values (NotStarted, InProgress) to TypeScript types ('Not Started', 'In Progress').

---

## Design System

### Color Palette (Dark Theme)

- **Primary (Fox Red)**: `hsl(16 100% 50%)` (#FF4500)
  - Used for primary actions, branding, emphasis
  
- **Accent (Yellow)**: `hsl(52 100% 73%)` (#FFE973)
  - Used for highlights and subtle contrast
  
- **Background**: `hsl(222 17% 9%)` (#121317)
  - Deep grayish blue for modern, sleek look
  
- **Card/Surface**: `hsl(220 21% 5%)` (#0B0C10)
  - Slightly lighter than background for depth

### Typography

- **Headlines**: `Space Grotesk` - Geometric sans-serif for techy feel
- **Body**: `Inter` - Highly legible sans-serif for readability

### Layout

- **Sidebar Layout**: Structured navigation for admin users
- **Spacing**: 4px/8px grid system
- **Responsive**: Mobile-first with `lg` breakpoint for desktop sidebar

---

## Current Implementation Status

### ✅ Completed

1. **UI/UX Foundation**
   - Complete dark theme implementation
   - 30+ Shadcn UI components integrated
   - Responsive layout with sidebar navigation
   - Professional design system

2. **Database Layer**
   - MySQL schema with Prisma ORM
   - All 6 models defined with relationships
   - All data access functions migrated to Prisma
   - Seed data SQL dump available

3. **Admin Dashboard**
   - Stats cards (users, courses, completions)
   - Completion chart (30-day time series)
   - Recent activity table
   - Course management table
   - User management page structure

4. **Component Library**
   - Feature-specific components (sidebar, header, tables, charts)
   - Reusable UI components (buttons, cards, dialogs, forms, etc.)

### ⚠️ In Progress / Not Implemented

1. **Authentication**
   - Login page UI exists but no real auth system
   - No protected route middleware
   - No session management
   - Database ready (User model exists)

2. **SCORM Processing**
   - Upload dialog UI exists
   - No backend file upload handling
   - No SCORM package validation
   - No metadata extraction (AI ready but not integrated)

3. **Course Player**
   - Page structure exists (`/learn/[enrollmentId]`)
   - Simulated content area only
   - No real SCORM runtime API
   - No progress persistence

4. **Certificate Generation**
   - Display page exists (`/certificate/[certificateId]`)
   - No PDF generation
   - No automatic certificate creation

5. **GoPhish Integration**
   - Webhook endpoint exists (`/api/integrations/gophish/webhook`)
   - Receives payloads but doesn't process
   - No course assignment logic
   - No email notifications

6. **File Storage**
   - No file upload/storage system
   - SCORM packages need storage solution

7. **Email System**
   - Not implemented
   - Needed for course assignments and notifications

---

## Key Components

### Application Components

1. **AppSidebar** (`src/components/app/app-sidebar.tsx`)
   - Main navigation hub for administrators
   - Menu items: Dashboard, Courses, Learners, Settings
   - Footer with upload CTA and user profile

2. **CourseTable** (`src/components/app/courses/course-table.tsx`)
   - Data table for managing SCORM packages
   - Actions: Assign Learner, View Details
   - Status indicators

3. **StatsCards** (`src/components/app/dashboard/stats-cards.tsx`)
   - Dashboard summary cards
   - Metrics: Total Users, Total Courses, Completed, In Progress

4. **CompletionChart** (`src/components/app/dashboard/completion-chart.tsx`)
   - 30-day completion trend visualization
   - Uses Recharts library

5. **RecentActivityTable** (`src/components/app/dashboard/recent-activity-table.tsx`)
   - Latest 5 audit log entries
   - Shows actor, action, timestamp

### Pages

1. **Dashboard** (`src/app/(admin)/dashboard/page.tsx`)
   - Server component fetching stats, completion data, recent activity
   - Displays stats cards, chart, and activity table

2. **Courses** (`src/app/(admin)/courses/page.tsx`)
   - Lists all courses
   - Includes upload dialog trigger
   - Shows course table with enrollments

3. **Learn** (`src/app/learn/[enrollmentId]/page.tsx`)
   - Course player page
   - Currently shows simulated SCORM content
   - Progress bar and completion button

4. **Certificate** (`src/app/certificate/[certificateId]/page.tsx`)
   - Certificate display page
   - Not yet connected to real certificate generation

---

## API Routes

### GoPhish Webhook
**Location**: `src/app/api/integrations/gophish/webhook/route.ts`

**Current State**: 
- Receives POST requests
- Logs payload to console
- Returns success response
- **Not implemented**: User lookup, course assignment, email sending, audit logging

**Planned Functionality**:
1. Validate webhook payload and secret key
2. Look up user by email
3. Find appropriate remediation course
4. Create Enrollment record
5. Send email with course link
6. Create AuditLog entry

---

## Development Workflow

### Scripts

```bash
# Development
npm run dev              # Start dev server (port 9002, Turbopack)
npm run genkit:dev       # Start Genkit AI dev server
npm run genkit:watch     # Genkit with watch mode

# Database
npm run db:generate      # Generate Prisma Client
npm run db:push          # Push schema changes
npm run db:migrate       # Create and apply migrations
npm run db:studio        # Open Prisma Studio (database GUI)

# Build & Production
npm run build            # Build for production
npm start                # Start production server
npm run typecheck        # TypeScript type checking
npm run lint             # ESLint
```

### Environment Variables

Required (`.env`):
```env
DATABASE_URL="mysql://user:password@localhost:3306/cyberaware"
GOOGLE_GENAI_API_KEY=your_genai_key
GOPHISH_WEBHOOK_SECRET=your_webhook_secret
NODE_ENV=development
```

---

## Development Roadmap

### 8 Milestones

1. **Foundation & Authentication** (Week 1-2) - 🔄 In Progress
   - Firebase/NextAuth setup
   - User authentication
   - Protected routes
   - RBAC implementation

2. **Data Layer & Storage** ✅ **COMPLETED**
   - MySQL/Prisma integration
   - All data functions migrated
   - Schema complete

3. **SCORM Processing & Upload** (Week 3-4)
   - Package validation
   - Metadata extraction (AI-powered)
   - File upload API
   - Course management

4. **Course Player & Runtime** (Week 4-5)
   - SCORM runtime API
   - Progress tracking
   - Resume functionality
   - Player UI

5. **Enrollment & Assignment** (Week 5-6)
   - Manual assignment
   - Group management
   - Email system
   - Course launch links

6. **Certificates & Completion** (Week 6-7)
   - PDF generation
   - Completion detection
   - Certificate storage
   - Verification system

7. **Integrations & Automation** (Week 7-8)
   - GoPhish webhook completion
   - Automation rules
   - Webhook security

8. **Polish & Production** (Week 8-9)
   - Testing
   - Performance optimization
   - Error monitoring
   - Documentation
   - Security audit

**Total Estimated Time**: ~12 weeks (~3 months)

---

## Key Files Reference

### Configuration
- `package.json` - Dependencies and scripts
- `next.config.ts` - Next.js configuration
- `tailwind.config.ts` - Tailwind CSS theme
- `tsconfig.json` - TypeScript configuration
- `components.json` - Shadcn UI configuration

### Core Logic
- `src/lib/prisma.ts` - Prisma client singleton
- `src/lib/data.ts` - Data access layer (all Prisma queries)
- `src/lib/types.ts` - TypeScript type definitions
- `src/lib/utils.ts` - Utility functions

### Database
- `prisma/schema.prisma` - Database schema
- `prisma/seed.sql` - Initial seed data

### Documentation
- `README.md` - Project overview and getting started
- `docs/blueprint.md` - Core feature specifications
- `docs/IMPROVEMENTS_AND_MILESTONES.md` - Detailed roadmap
- `THEME_AND_ARCHITECTURE_follow.md` - Design system guidelines
- `MIGRATION_SUMMARY.md` - Firebase to MySQL migration details

---

## Technical Debt & Known Issues

1. **Authentication**: No real auth system (UI only)
2. **File Storage**: No implementation yet
3. **SCORM Processing**: Upload UI exists but no backend
4. **Course Player**: Simulated only, no real SCORM runtime
5. **Certificate Generation**: Display only, no PDF generation
6. **GoPhish Integration**: Webhook receives but doesn't process
7. **Email System**: Not implemented
8. **Migrations**: Initial Prisma migration needs to be generated
9. **Error Handling**: Limited error handling in data layer
10. **Testing**: No test coverage yet

---

## Strengths

1. **Modern Stack**: Latest Next.js 15 with App Router
2. **Type Safety**: Full TypeScript with Prisma type generation
3. **UI Foundation**: Complete design system with 30+ components
4. **Database**: Well-structured schema with proper relationships
5. **Architecture**: Clean separation of concerns
6. **Documentation**: Comprehensive documentation and roadmap
7. **Scalability**: Designed for enterprise use

---

## Next Steps (Recommended)

1. **Immediate**:
   - Generate and apply initial Prisma migration
   - Set up authentication system
   - Implement file upload/storage

2. **Short-term**:
   - Complete SCORM processing pipeline
   - Build SCORM runtime API
   - Implement course player

3. **Medium-term**:
   - Certificate generation
   - Email system
   - Complete GoPhish integration

4. **Long-term**:
   - Testing infrastructure
   - Performance optimization
   - Production deployment

---

## Conclusion

CyberAware is a well-architected, modern LMS platform with a solid foundation. The UI/UX is complete, the database layer is fully migrated to MySQL/Prisma, and the codebase follows best practices. The main work remaining is implementing the core features (authentication, SCORM processing, course player, certificates) and integrations.

The project demonstrates:
- Strong architectural decisions
- Modern development practices
- Comprehensive planning and documentation
- Scalable design patterns

**Status**: Ready for active feature development
