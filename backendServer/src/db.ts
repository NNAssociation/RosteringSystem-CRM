// src/db.ts
import "dotenv/config";
// Go up one level from 'src' to find 'generated'
// We use the .js extension because your project is "type": "module"
import pkg from "../generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Destructure PrismaClient from the default package export
const { PrismaClient } = pkg;

// Correct the type definition for global caching
const globalForPrisma = global as unknown as { prisma: any };

// Debugging: This will help you see if the variable is actually loading
if (!process.env.DATABASE_URL) {
  console.error(
    "CRITICAL: DATABASE_URL is not defined in environment variables!",
  );
}

// 1. Setup the connection pool using your Env var
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Bypass the type version mismatch
const adapter = new PrismaPg(pool as any);

// 3. Pass the adapter to the Client
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter: adapter,
    log: ["query", "error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Need to run
// npm install @prisma/adapter-pg pg
// npm install --save-dev @types/pg
