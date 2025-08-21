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
neonConfig.webSocketConstructor = globalThis.WebSocket;

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
      
      // Simulate scan progress and completion
      setTimeout(async () => {
        try {
          // Simulate scan taking some time
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Update scan to completed status with mock results
          const mockVulnerabilities = [
            {
              scanId: scan.id,
              type: 'cryptographic',
              severity: 'high',
              title: 'Weak RSA Key Size',
              description: 'RSA key size less than 2048 bits detected, vulnerable to quantum attacks',
              filePath: '/src/crypto/rsa.js',
              lineNumber: 42,
              ruleId: 'pqc-rsa-weak-key',
              evidence: 'RSA.generateKeyPair(1024)',
              recommendation: 'Use RSA key size of at least 2048 bits or migrate to post-quantum cryptography',
              category: 'quantum-vulnerable',
              cweId: 'CWE-326',
              status: 'new'
            },
            {
              scanId: scan.id,
              type: 'cryptographic',
              severity: 'medium',
              title: 'Deprecated Hash Algorithm',
              description: 'SHA-1 hash algorithm detected, vulnerable to collision attacks',
              filePath: '/src/utils/hash.py',
              lineNumber: 15,
              ruleId: 'crypto-deprecated-sha1',
              evidence: 'hashlib.sha1()',
              recommendation: 'Replace SHA-1 with SHA-256 or stronger hash functions',
              category: 'deprecated-crypto',
              cweId: 'CWE-327',
              status: 'new'
            }
          ];

          // Update scan status
          await db
            .update(scans)
            .set({
              status: 'completed',
              completedAt: new Date(),
              totalFiles: 156,
              errorMessage: null
            })
            .where(eq(scans.id, scan.id));

          console.log('Scan completed:', scan.id);
        } catch (error) {
          console.error('Error completing scan:', error);
          // Mark scan as failed
          await db
            .update(scans)
            .set({
              status: 'failed',
              completedAt: new Date(),
              errorMessage: 'Scan processing failed'
            })
            .where(eq(scans.id, scan.id));
        }
      }, 5000); // Complete scan after 5 seconds
      
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