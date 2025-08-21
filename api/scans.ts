import { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { scans, repositories, insertScanSchema } from '../shared/schema';
import { eq, desc } from 'drizzle-orm';

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
      
      const data = insertScanSchema.parse(req.body);
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