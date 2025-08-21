import { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { integrations } from '../shared/schema';
import { desc } from 'drizzle-orm';

// Configure for Vercel edge runtime
if (typeof window === 'undefined') {
  neonConfig.webSocketConstructor = require('ws');
}

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
      const allIntegrations = await db
        .select()
        .from(integrations)
        .orderBy(desc(integrations.createdAt));
      
      return res.json(allIntegrations);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Integrations API error:', error);
    
    if (error instanceof Error) {
      return res.status(500).json({ error: `Integrations operation failed: ${error.message}` });
    }
    
    return res.status(500).json({ error: "Internal server error" });
  }
}