// src/db.ts
import "dotenv/config";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = global as unknown as { prisma: any };

// Debugging: This will help you see if the variable is actually loading
if (!process.env.DATABASE_URL) {
  console.error(
    "CRITICAL: DATABASE_URL is not defined in environment variables!",
  );
}

// 1. Setup the connection pool using your Env var
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// 2. Create the adapter
const adapter = new PrismaPg(pool);

// 3. Pass the adapter to the Client
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter: adapter, // This satisfies the "requires either adapter or accelerateUrl" error
    log: ["query", "error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Need to run
// npm install @prisma/adapter-pg pg
// npm install --save-dev @types/pg
