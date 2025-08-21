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

    if (req.method === 'GET') {
      const allRepositories = await db.select().from(repositories);
      return res.json(allRepositories);
    }

    if (req.method === 'POST') {
      console.log('Repository creation request body:', req.body);
      
      // Validate required fields
      if (!req.body.name || !req.body.url) {
        return res.status(400).json({ 
          error: "Name and URL are required fields" 
        });
      }
      
      // Prepare data with defaults
      const requestData = {
        name: req.body.name,
        url: req.body.url,
        provider: req.body.provider || 'github' as const,
        description: req.body.description || null,
        languages: Array.isArray(req.body.languages) ? req.body.languages : [],
      };
      
      console.log('Processed request data:', requestData);
      const data = insertRepositorySchema.parse(requestData);
      console.log('Schema validation passed, creating repository...');
      
      const [repository] = await db
        .insert(repositories)
        .values([data])
        .returning();
      
      console.log('Repository created successfully:', repository.id);
      return res.json(repository);
    }

    // Handle individual repository operations - extract ID from URL
    const urlParts = (req.url || '').split('/');
    const repositoryId = urlParts[urlParts.length - 1];
    
    if (req.method === 'PATCH' && repositoryId && repositoryId !== 'repositories') {
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

    if (req.method === 'DELETE' && repositoryId && repositoryId !== 'repositories') {
      const [deletedRepository] = await db
        .delete(repositories)
        .where(eq(repositories.id, repositoryId))
        .returning();
      
      if (!deletedRepository) {
        return res.status(404).json({ error: 'Repository not found' });
      }
      
      return res.json({ message: 'Repository deleted successfully' });
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