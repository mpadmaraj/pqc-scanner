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
      
      const [deletedRepository] = await db
        .delete(repositories)
        .where(eq(repositories.id, repositoryId))
        .returning();
      
      if (!deletedRepository) {
        console.log(`Repository with ID ${repositoryId} not found`);
        return res.status(404).json({ error: 'Repository not found' });
      }
      
      console.log(`Successfully deleted repository: ${deletedRepository.id}`);
      return res.json({ message: 'Repository deleted successfully', id: deletedRepository.id });
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