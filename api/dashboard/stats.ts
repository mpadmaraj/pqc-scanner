import { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { vulnerabilities, scans } from '../../shared/schema';
import { eq, count, and } from 'drizzle-orm';

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
      // Get critical vulnerabilities count
      const [criticalCount] = await db
        .select({ count: count() })
        .from(vulnerabilities)
        .where(eq(vulnerabilities.severity, 'critical'));

      // Get quantum vulnerable count (assuming this is tracked in pqcCategory)
      const [quantumVulnCount] = await db
        .select({ count: count() })
        .from(vulnerabilities)
        .where(eq(vulnerabilities.pqcCategory, 'quantum_vulnerable'));

      // Get PQC compliant count (assuming compliant repositories don't have quantum vulnerabilities)
      const [pqcCompliantCount] = await db
        .select({ count: count() })
        .from(vulnerabilities)
        .where(eq(vulnerabilities.pqcCategory, 'pqc_compliant'));

      // Get active scans count
      const [activeScansCount] = await db
        .select({ count: count() })
        .from(scans)
        .where(eq(scans.status, 'scanning'));

      const stats = {
        criticalVulnerabilities: criticalCount.count.toString(),
        quantumVulnerable: quantumVulnCount.count.toString(),
        pqcCompliant: pqcCompliantCount.count.toString(),
        activeScans: activeScansCount.count.toString()
      };
      
      return res.json(stats);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Dashboard stats API error:', error);
    
    if (error instanceof Error) {
      return res.status(500).json({ error: `Dashboard stats operation failed: ${error.message}` });
    }
    
    return res.status(500).json({ error: "Internal server error" });
  }
}