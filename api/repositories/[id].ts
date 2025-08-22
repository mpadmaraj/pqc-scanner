import { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql, eq } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Schema definitions directly in file to avoid module resolution issues
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

const insertRepositorySchema = createInsertSchema(repositories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastScanAt: true,
});

// Configure for Vercel edge runtime
neonConfig.webSocketConstructor = globalThis.WebSocket;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle({ client: pool });

    // Extract repository ID from query parameters (Vercel dynamic routing)
    const { id: repositoryId } = req.query;
    
    if (!repositoryId || typeof repositoryId !== 'string') {
      return res.status(400).json({ error: 'Repository ID is required' });
    }

    if (req.method === 'GET') {
      const [repository] = await db
        .select()
        .from(repositories)
        .where(eq(repositories.id, repositoryId));
      
      if (!repository) {
        return res.status(404).json({ error: 'Repository not found' });
      }
      
      return res.json(repository);
    }

    if (req.method === 'PATCH') {
      const updateSchema = insertRepositorySchema.partial();
      const validatedData = updateSchema.parse(req.body);
      
      const updateData: any = {
        ...validatedData,
        updatedAt: new Date()
      };
      
      // Ensure languages is properly formatted as array
      if (updateData.languages && !Array.isArray(updateData.languages)) {
        updateData.languages = [];
      }
      
      const [updatedRepository] = await db
        .update(repositories)
        .set(updateData)
        .where(eq(repositories.id, repositoryId))
        .returning();
      
      if (!updatedRepository) {
        return res.status(404).json({ error: 'Repository not found' });
      }
      
      return res.json(updatedRepository);
    }

    if (req.method === 'DELETE') {
      console.log(`Attempting to delete repository with ID: ${repositoryId}`);
      
      // First check if repository exists
      const [existingRepository] = await db
        .select()
        .from(repositories)
        .where(eq(repositories.id, repositoryId));
      
      if (!existingRepository) {
        console.log(`Repository with ID ${repositoryId} not found`);
        return res.status(404).json({ error: 'Repository not found' });
      }
      
      // Define related tables that need to be cleaned up
      const scansTable = pgTable("scans", {
        id: varchar("id").primaryKey(),
        repositoryId: varchar("repository_id").notNull(),
      });
      
      const vulnerabilitiesTable = pgTable("vulnerabilities", {
        id: varchar("id").primaryKey(),
        repositoryId: varchar("repository_id").notNull(),
        scanId: varchar("scan_id").notNull(),
      });
      
      const cbomReportsTable = pgTable("cbom_reports", {
        id: varchar("id").primaryKey(),
        repositoryId: varchar("repository_id").notNull(),
      });
      
      const vdrReportsTable = pgTable("vdr_reports", {
        id: varchar("id").primaryKey(),
        vulnerabilityId: varchar("vulnerability_id").notNull(),
      });
      
      // Get all vulnerabilities for this repository to delete their VDR reports
      const vulnerabilitiesToDelete = await db
        .select({ id: vulnerabilitiesTable.id })
        .from(vulnerabilitiesTable)
        .where(eq(vulnerabilitiesTable.repositoryId, repositoryId));
      
      // Delete related records in the correct order (most dependent child tables first)
      if (vulnerabilitiesToDelete.length > 0) {
        console.log('Deleting related VDR reports...');
        for (const vuln of vulnerabilitiesToDelete) {
          await db.delete(vdrReportsTable).where(eq(vdrReportsTable.vulnerabilityId, vuln.id));
        }
      }
      
      console.log('Deleting related vulnerabilities...');
      await db.delete(vulnerabilitiesTable).where(eq(vulnerabilitiesTable.repositoryId, repositoryId));
      
      console.log('Deleting related CBOM reports...');
      await db.delete(cbomReportsTable).where(eq(cbomReportsTable.repositoryId, repositoryId));
      
      console.log('Deleting related scans...');
      await db.delete(scansTable).where(eq(scansTable.repositoryId, repositoryId));
      
      // Finally delete the repository
      console.log('Deleting repository...');
      const [deletedRepository] = await db
        .delete(repositories)
        .where(eq(repositories.id, repositoryId))
        .returning();
      
      console.log(`Successfully deleted repository and all related data: ${deletedRepository.id}`);
      return res.json({ 
        message: 'Repository and all related data deleted successfully', 
        id: deletedRepository.id 
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Repository API error:', error);
    
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return res.status(503).json({ 
          error: "Database connection failed" 
        });
      }
    }
    
    if (error instanceof Error) {
      return res.status(400).json({ error: `Repository operation failed: ${error.message}` });
    }
    
    return res.status(500).json({ error: "Internal server error" });
  }
}