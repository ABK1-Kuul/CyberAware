# Database Migration Guide: Firebase to MySQL with Prisma

This guide walks you through setting up MySQL with Prisma to replace Firebase data storage.

## Prerequisites

- MySQL server installed and running (version 8.0 or higher recommended)
- Node.js and npm installed
- Access to create databases and users in MySQL

## Step 1: Install Dependencies

Install the new Prisma dependencies:

```bash
npm install
```

This will install:
- `@prisma/client` - Prisma Client for database access
- `prisma` (dev dependency) - Prisma CLI for migrations and schema management

## Step 2: Configure Database Connection

1. Create a `.env` file in the project root (copy from `.env.example` if it exists):

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE"
```

Example:
```env
DATABASE_URL="mysql://root:password@localhost:3306/cyberaware"
```

2. Create the database in MySQL:

```sql
CREATE DATABASE cyberaware CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## Step 3: Generate Prisma Client

Generate the Prisma Client based on the schema:

```bash
npm run db:generate
```

## Step 4: Run Migrations

Create and apply the initial migration:

```bash
npm run db:migrate
```

This will:
- Create a migration file in `prisma/migrations/`
- Apply the migration to your MySQL database
- Create all tables, indexes, and foreign keys

Alternatively, if you want to push the schema without creating a migration (useful for prototyping):

```bash
npm run db:push
```

## Step 5: Import Seed Data

After migrations are complete, import the seed data:

```bash
mysql -u your_user -p cyberaware < prisma/seed.sql
```

Or using MySQL command line:

```sql
USE cyberaware;
SOURCE prisma/seed.sql;
```

## Step 6: Verify Setup

1. Open Prisma Studio to view your data:

```bash
npm run db:studio
```

2. Verify the application works by running:

```bash
npm run dev
```

## Database Schema Overview

The schema includes the following tables:

- **users** - User accounts (learners and admins)
- **courses** - Training courses
- **enrollments** - User-course enrollments with progress tracking
- **certificates** - Certificates issued for completed courses
- **scorm_data** - SCORM tracking data for enrollments
- **audit_logs** - System audit trail

### Key Relationships

- Users can have multiple enrollments
- Courses can have multiple enrollments
- Each enrollment can have one certificate (when completed)
- Each enrollment can have SCORM data
- Audit logs reference users (actors)

### Indexes

The schema includes indexes on:
- User email and role
- Enrollment status, dates, and foreign keys
- Certificate UUID
- Audit log actor and creation date

## Environment Variables

Required environment variables:

- `DATABASE_URL` - MySQL connection string

Optional (for development):
- `NODE_ENV` - Set to `development` for query logging

## Troubleshooting

### Connection Issues

If you encounter connection errors:

1. Verify MySQL is running: `mysql -u root -p`
2. Check the DATABASE_URL format matches: `mysql://user:password@host:port/database`
3. Ensure the database exists
4. Verify user permissions

### Migration Issues

If migrations fail:

1. Check MySQL version compatibility (8.0+)
2. Verify character set: `SHOW VARIABLES LIKE 'character_set%';`
3. Ensure foreign key checks are enabled
4. Review migration files in `prisma/migrations/`

### Data Import Issues

If seed data doesn't import:

1. Verify foreign key constraints are satisfied
2. Check enum values match Prisma schema
3. Ensure dates are in correct format
4. Review error messages for specific issues

## Next Steps

- Update API routes to use Prisma queries
- Add authentication middleware
- Implement data validation with Zod
- Set up database backups
- Configure connection pooling for production

## Removing Firebase

Firebase has been removed from `package.json`. If you still see Firebase references:

1. Remove `firebase` from dependencies (already done)
2. Remove any Firebase initialization code
3. Remove Firebase configuration files
4. Update `.gitignore` to remove Firebase-specific entries if needed
