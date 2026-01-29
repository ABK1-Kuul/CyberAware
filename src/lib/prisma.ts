import { PrismaClient } from '@prisma/client'
import { env } from './env'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Prisma Client singleton with connection pooling configuration.
 * 
 * Connection pooling is configured via DATABASE_URL query parameters:
 * - connection_limit: Maximum number of connections in the pool (default: 10)
 * - pool_timeout: Maximum time to wait for a connection (default: 20 seconds)
 * 
 * Example DATABASE_URL:
 * mysql://user:password@host:3306/database?connection_limit=10&pool_timeout=20
 * 
 * For production, consider:
 * - connection_limit=20-50 (based on server capacity)
 * - pool_timeout=30-60 (based on expected load)
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
