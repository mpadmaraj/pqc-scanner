import { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { repositories, insertRepositorySchema } from '../shared/schema';

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
        provider: req.body.provider || 'github',
        description: req.body.description || null,
        languages: req.body.languages || [],
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