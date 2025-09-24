import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq } from 'drizzle-orm';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import ws from 'ws';

// Simplified database schema for serverless (matching actual schema)
const cbomReports = pgTable('cbom_reports', {
  id: text('id').primaryKey(),
  scanId: text('scan_id'),
  repositoryId: text('repository_id').notNull(),
  content: text('content').notNull(), // This is the actual column name
  createdAt: timestamp('created_at').defaultNow(),
});

const vdrReports = pgTable('vdr_reports', {
  id: text('id').primaryKey(),
  vulnerabilityId: text('vulnerability_id'),
  content: text('content').notNull(), // This is the actual column name  
  createdAt: timestamp('created_at').defaultNow(),
});

const repositories = pgTable('repositories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
});

// Initialize database connection for serverless
let db: any = null;

function getDatabase() {
  if (!db) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required');
    }
    
    neonConfig.webSocketConstructor = ws;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle({ client: pool });
  }
  return db;
}

// Simplified API handler that handles specific endpoints needed on Vercel
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { url: repoUrl } = req.query;
    const requestUrl = req.url || '';

    // Handle temp branches endpoint
    if (requestUrl.includes('/repositories/temp/branches')) {
      if (!repoUrl || typeof repoUrl !== 'string') {
        return res.status(400).json({ error: "Repository URL is required" });
      }

      if (!repoUrl.includes('github.com')) {
        return res.status(400).json({ error: "Branch fetching only supported for GitHub repositories" });
      }

      try {
        // Extract owner and repo from GitHub URL
        const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)(?:\.git)?(?:\/.*)?$/);
        if (!match) {
          return res.status(400).json({ error: "Invalid GitHub repository URL format" });
        }

        const [, owner, repoName] = match;
        const cleanRepoName = repoName.replace(/\.git$/, '');

        // Fetch branches from GitHub API
        const githubResponse = await fetch(`https://api.github.com/repos/${owner}/${cleanRepoName}/branches`);
        
        if (!githubResponse.ok) {
          if (githubResponse.status === 404) {
            return res.status(404).json({ error: "Repository not found" });
          } else if (githubResponse.status === 403) {
            return res.status(403).json({ error: "Access forbidden - repository may be private" });
          }
          throw new Error(`GitHub API error: ${githubResponse.status}`);
        }

        const branches = await githubResponse.json();
        const branchNames = branches.map((branch: any) => branch.name);

        res.json({ branches: branchNames });
      } catch (error) {
        console.error("Branch fetch error:", error);
        res.status(500).json({ 
          error: "Failed to fetch branches", 
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
    // Handle CBOM report downloads
    else if (requestUrl.includes('/cbom-reports/')) {
      const match = requestUrl.match(/\/cbom-reports\/([^\/]+)\/(pdf|json)/);
      if (!match) {
        return res.status(400).json({ error: 'Invalid report URL format' });
      }
      
      const [, scanId, format] = match;
      
      try {
        const database = getDatabase();
        
        // Query for CBOM report using Drizzle ORM
        const reportResults = await database.select().from(cbomReports).where(eq(cbomReports.scanId, scanId));
        
        if (reportResults.length === 0) {
          return res.status(404).json({ error: 'CBOM report not found' });
        }
        
        const report = reportResults[0];
        const repoResults = await database.select().from(repositories).where(eq(repositories.id, report.repositoryId));
        const repository = repoResults[0];
        
        
        if (format === 'json') {
          // Return JSON data directly
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="cbom-report-${scanId}.json"`);
          res.json(JSON.parse(report.content || '{}'));
        } else {
          // For PDF, return simplified text-based report
          const reportData = JSON.parse(report.content || '{}');
          const textReport = `
CBOM Report - ${repository?.name || 'Unknown Repository'}
Generated: ${new Date(report.createdAt || '').toLocaleString()}
Scan ID: ${scanId}

Summary:
${JSON.stringify(reportData, null, 2)}

Note: Full PDF generation is only available in development environment.
To get the full PDF report, please use the local development server.
          `;
          
          res.setHeader('Content-Type', 'text/plain');
          res.setHeader('Content-Disposition', `attachment; filename="cbom-report-${scanId}.txt"`);
          res.send(textReport);
        }
      } catch (error) {
        console.error("CBOM report download error:", error);
        res.status(500).json({ 
          error: "Failed to download CBOM report", 
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
    // Handle VDR report downloads  
    else if (requestUrl.includes('/vdr-reports/')) {
      const match = requestUrl.match(/\/vdr-reports\/([^\/]+)\/(pdf|json)/);
      if (!match) {
        return res.status(400).json({ error: 'Invalid report URL format' });
      }
      
      const [, scanId, format] = match;
      
      try {
        const database = getDatabase();
        
        // Query for VDR report using Drizzle ORM
        // Note: VDR reports are linked to vulnerabilities, not scans directly
        const reportResults = await database.select().from(vdrReports).limit(1);
        
        if (reportResults.length === 0) {
          return res.status(404).json({ error: 'VDR report not found' });
        }
        
        const report = reportResults[0];
        // For VDR reports, we'll use a generic repository name since they're vulnerability-specific
        const repository = { name: 'VDR Report' };
        
        
        if (format === 'json') {
          // Return JSON data directly
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="vdr-report-${scanId}.json"`);
          res.json(JSON.parse(report.content || '{}'));
        } else {
          // For PDF, return simplified text-based report
          const reportData = JSON.parse(report.content || '{}');
          const textReport = `
VDR Report - ${repository?.name || 'Unknown Repository'}
Generated: ${new Date(report.createdAt || '').toLocaleString()}
Scan ID: ${scanId}

Summary:
${JSON.stringify(reportData, null, 2)}

Note: Full PDF generation is only available in development environment.
To get the full PDF report, please use the local development server.
          `;
          
          res.setHeader('Content-Type', 'text/plain');
          res.setHeader('Content-Disposition', `attachment; filename="vdr-report-${scanId}.txt"`);
          res.send(textReport);
        }
      } catch (error) {
        console.error("VDR report download error:", error);
        res.status(500).json({ 
          error: "Failed to download VDR report", 
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
    else {
      // For all other API routes, return a basic response
      res.status(404).json({ error: 'API endpoint not implemented in serverless function' });
    }
  } catch (error) {
    console.error('API Handler Error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}