import { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { vulnerabilities, repositories, scans } from '../shared/schema';
import { eq, desc } from 'drizzle-orm';

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