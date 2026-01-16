# Prisma Database Setup

This directory contains the Prisma schema and migration files for the CyberAware application.

## Files

- `schema.prisma` - Prisma schema definition with all models, relationships, and indexes
- `seed.sql` - SQL dump file containing initial seed data converted from mock data
- `MIGRATION_GUIDE.md` - Step-by-step guide for setting up the database

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file with:
   ```env
   DATABASE_URL="mysql://user:password@localhost:3306/cyberaware"
   ```

3. **Create the database:**
   ```sql
   CREATE DATABASE cyberaware CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

4. **Generate Prisma Client:**
   ```bash
   npm run db:generate
   ```

5. **Run migrations:**
   ```bash
   npm run db:migrate
   ```

6. **Import seed data:**
   ```bash
   mysql -u your_user -p cyberaware < prisma/seed.sql
   ```

## Schema Overview

### Models

- **User** - User accounts (learners and admins)
- **Course** - Training courses
- **Enrollment** - User-course enrollments with progress tracking
- **Certificate** - Certificates issued for completed courses
- **ScormData** - SCORM tracking data for enrollments
- **AuditLog** - System audit trail

### Relationships

- Users ↔ Enrollments (one-to-many)
- Courses ↔ Enrollments (one-to-many)
- Enrollments ↔ Certificates (one-to-one)
- Enrollments ↔ ScormData (one-to-one)
- Users ↔ AuditLogs (one-to-many, as actors)

### Indexes

All foreign keys and frequently queried fields are indexed for optimal performance.

## Available Scripts

- `npm run db:generate` - Generate Prisma Client
- `npm run db:push` - Push schema changes to database (prototyping)
- `npm run db:migrate` - Create and apply migrations
- `npm run db:studio` - Open Prisma Studio (database GUI)

## Notes

- The schema uses MySQL-specific features (JSON columns, enum types)
- Foreign keys use CASCADE deletes for enrollments and SET NULL for audit logs
- All timestamps use MySQL DATETIME type
- Enum values in Prisma match database enum values (no spaces)
