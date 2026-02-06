import { mockDeep, mockReset } from "jest-mock-extended"
import type { PrismaClient } from "@prisma/client"

const prismaMock = mockDeep<PrismaClient>()

export const prisma = prismaMock
export const resetPrismaMocks = () => mockReset(prismaMock)
