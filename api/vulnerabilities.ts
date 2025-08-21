import { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql, eq, desc } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";

// Schema definitions
const severityEnum = pgEnum("severity", ["critical", "high", "medium", "low", "info"]);
const scanStatusEnum = pgEnum("scan_status", ["pending", "scanning", "completed", "failed"]);
const vulnerabilityStatusEnum = pgEnum("vulnerability_status", ["new", "reviewing", "fixed", "false_positive", "ignored"]);
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

const vulnerabilities = pgTable("vulnerabilities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scanId: varchar("scan_id").references(() => scans.id).notNull(),
  repositoryId: varchar("repository_id").references(() => repositories.id).notNull(),
  cveId: text("cve_id"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: severityEnum("severity").notNull(),
  status: vulnerabilityStatusEnum("status").default("new").notNull(),
  filePath: text("file_path").notNull(),
  startLine: integer("start_line"),
  endLine: integer("end_line"),
  codeSnippet: text("code_snippet"),
  recommendation: text("recommendation"),
  workaround: text("workaround"),
  cvssScore: text("cvss_score"),
  pqcCategory: text("pqc_category"),
  detectedBy: text("detected_by").notNull(),
  metadata: jsonb("metadata").$type<{
    library?: string;
    algorithm?: string;
    keySize?: number;
    nistStandard?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Configure for Vercel edge runtime
neonConfig.webSocketConstructor = globalThis.WebSocket;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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
      const allVulnerabilities = await db
        .select({
          id: vulnerabilities.id,
          scanId: vulnerabilities.scanId,
          repositoryId: vulnerabilities.repositoryId,
          cveId: vulnerabilities.cveId,
          title: vulnerabilities.title,
          description: vulnerabilities.description,
          severity: vulnerabilities.severity,
          status: vulnerabilities.status,
          filePath: vulnerabilities.filePath,
          startLine: vulnerabilities.startLine,
          endLine: vulnerabilities.endLine,
          codeSnippet: vulnerabilities.codeSnippet,
          recommendation: vulnerabilities.recommendation,
          workaround: vulnerabilities.workaround,
          cvssScore: vulnerabilities.cvssScore,
          pqcCategory: vulnerabilities.pqcCategory,
          detectedBy: vulnerabilities.detectedBy,
          metadata: vulnerabilities.metadata,
          createdAt: vulnerabilities.createdAt,
          updatedAt: vulnerabilities.updatedAt,
          repositoryName: repositories.name,
          repositoryUrl: repositories.url
        })
        .from(vulnerabilities)
        .leftJoin(repositories, eq(vulnerabilities.repositoryId, repositories.id))
        .leftJoin(scans, eq(vulnerabilities.scanId, scans.id))
        .orderBy(desc(vulnerabilities.createdAt));
      
      return res.json(allVulnerabilities);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Vulnerabilities API error:', error);
    
    if (error instanceof Error) {
      return res.status(500).json({ error: `Vulnerabilities operation failed: ${error.message}` });
    }
    
    return res.status(500).json({ error: "Internal server error" });
  }
}