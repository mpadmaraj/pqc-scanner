import { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql, eq, desc } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Schema definitions
const scanStatusEnum = pgEnum("scan_status", ["pending", "scanning", "completed", "failed"]);
const repositoryProviderEnum = pgEnum("repository_provider", ["github", "gitlab", "bitbucket", "local"]);

const repositories = pgTable("repositories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  url: text("url").notNull(),
  provider: repositoryProviderEnum("provider").notNull(),
  description: text("description"),
  languages: jsonb("languages").$type<string[]>().default([]),
  lastScanAt: timestamp("last_scan_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

const scans = pgTable("scans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  repositoryId: varchar("repository_id").references(() => repositories.id).notNull(),
  status: scanStatusEnum("status").default("pending").notNull(),
  progress: integer("progress").default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  totalFiles: integer("total_files").default(0),
  scanConfig: jsonb("scan_config").$type<{
    tools: string[];
    languages: string[];
    customRules?: string[];
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

const insertScanSchema = createInsertSchema(scans).omit({
  id: true,
  createdAt: true,
});

// Configure for Vercel edge runtime
if (typeof window === 'undefined') {
  neonConfig.webSocketConstructor = require('ws');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle({ client: pool });

    if (req.method === 'GET') {
      const allScans = await db
        .select({
          id: scans.id,
          repositoryId: scans.repositoryId,
          status: scans.status,
          progress: scans.progress,
          startedAt: scans.startedAt,
          completedAt: scans.completedAt,
          errorMessage: scans.errorMessage,
          totalFiles: scans.totalFiles,
          scanConfig: scans.scanConfig,
          createdAt: scans.createdAt,
          repositoryName: repositories.name,
          repositoryUrl: repositories.url
        })
        .from(scans)
        .leftJoin(repositories, eq(scans.repositoryId, repositories.id))
        .orderBy(desc(scans.createdAt));
      
      return res.json(allScans);
    }

    if (req.method === 'POST') {
      console.log('Scan creation request body:', req.body);
      
      // Ensure arrays are properly formatted
      const scanData = {
        ...req.body,
        scanConfig: {
          tools: Array.isArray(req.body.scanConfig?.tools) ? req.body.scanConfig.tools : [],
          languages: Array.isArray(req.body.scanConfig?.languages) ? req.body.scanConfig.languages : [],
          customRules: Array.isArray(req.body.scanConfig?.customRules) ? req.body.scanConfig.customRules : undefined,
        }
      };
      
      const data = insertScanSchema.parse(scanData);
      console.log('Schema validation passed, creating scan...');
      
      const [scan] = await db
        .insert(scans)
        .values([data])
        .returning();
      
      console.log('Scan created successfully:', scan.id);
      
      // Note: In a real implementation, you'd trigger the scanning service here
      // For now, we just return the created scan
      
      return res.json(scan);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Scans API error:', error);
    
    if (error instanceof Error) {
      return res.status(400).json({ error: `Scan operation failed: ${error.message}` });
    }
    
    return res.status(500).json({ error: "Internal server error" });
  }
}