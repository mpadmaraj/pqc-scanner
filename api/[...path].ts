import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq } from 'drizzle-orm';
import { pgTable, text, timestamp, varchar, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import ws from 'ws';

// Enums
const scanStatusEnum = pgEnum("scan_status", ["pending", "scanning", "completed", "failed"]);

// Simplified database schema for serverless (matching actual schema)
const cbomReports = pgTable('cbom_reports', {
  id: varchar('id').primaryKey(),
  scanId: varchar('scan_id'),
  repositoryId: varchar('repository_id').notNull(),
  content: jsonb('content').notNull(), // JSONB type - matches actual database
  createdAt: timestamp('created_at').defaultNow(),
});

const vdrReports = pgTable('vdr_reports', {
  id: varchar('id').primaryKey(),
  vulnerabilityId: varchar('vulnerability_id'),
  content: jsonb('content').notNull(), // JSONB type - matches actual database
  createdAt: timestamp('created_at').defaultNow(),
});

const repositories = pgTable('repositories', {
  id: varchar('id').primaryKey(),
  name: text('name').notNull(),
});

const scans = pgTable('scans', {
  id: varchar('id').primaryKey(),
  repositoryId: varchar('repository_id').notNull(),
  branch: text('branch'),
  status: scanStatusEnum('status'),
  progress: integer('progress'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  errorMessage: text('error_message'),
  totalFiles: integer('total_files'),
  integrationId: varchar('integration_id'),
  scanConfig: jsonb('scan_config'),
  createdAt: timestamp('created_at'),
});

const integrations = pgTable('integrations', {
  id: varchar('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  apiKey: text('api_key').notNull(),
  config: jsonb('config'),
  isActive: text('is_active'),
  lastUsed: timestamp('last_used'),
  createdAt: timestamp('created_at'),
});

const providerTokens = pgTable('provider_tokens', {
  id: varchar('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  name: varchar('name').notNull(),
  provider: varchar('provider').notNull(),
  tokenType: varchar('token_type').notNull(),
  accessToken: varchar('access_token').notNull(),
  refreshToken: varchar('refresh_token'),
  expiresAt: timestamp('expires_at'),
  scopes: varchar('scopes'),
  organizationAccess: jsonb('organization_access'),
  isActive: text('is_active'),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
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
    
    // Debug logging
    console.log('Request URL:', requestUrl);
    console.log('Query params:', req.query);

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
    else if (requestUrl.includes('cbom-reports')) {
      console.log('Processing CBOM report request for URL:', requestUrl);
      
      // Extract scan ID from URL path
      const pathParts = requestUrl.split('/').filter(part => part.length > 0);
      console.log('Path parts:', pathParts);
      
      let scanId = '';
      let format = 'json';
      
      // Find cbom-reports index and extract scan ID
      const cbomIndex = pathParts.findIndex(part => part === 'cbom-reports');
      if (cbomIndex >= 0 && cbomIndex < pathParts.length - 1) {
        scanId = pathParts[cbomIndex + 1];
        if (cbomIndex < pathParts.length - 2) {
          format = pathParts[cbomIndex + 2] || 'json';
        }
      }
      
      console.log('Extracted scan ID:', scanId);
      console.log('Extracted format:', format);
      
      if (!scanId) {
        return res.status(400).json({ error: 'Invalid report URL format - no scan ID found' });
      }
      
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
          // Return JSON data directly - content is already parsed from jsonb
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="cbom-report-${scanId}.json"`);
          res.json(report.content || {});
        } else {
          // For PDF, return simplified text-based report
          const reportData = report.content || {}; // Already parsed from jsonb
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
      // Support both /vdr-reports/scanId/format and /vdr-reports/scanId (default to json)
      const match = requestUrl.match(/\/vdr-reports\/([^\/]+)(?:\/(pdf|json))?/);
      if (!match) {
        return res.status(400).json({ error: 'Invalid report URL format' });
      }
      
      const [, scanId, format = 'json'] = match;
      
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
          // Return JSON data directly - content is already parsed from jsonb
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="vdr-report-${scanId}.json"`);
          res.json(report.content || {});
        } else {
          // For PDF, return simplified text-based report
          const reportData = report.content || {}; // Already parsed from jsonb
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
    // Handle provider tokens endpoints
    else if (requestUrl.includes('/settings/provider-tokens')) {
      if (req.method === 'GET') {
        try {
          const database = getDatabase();
          // Using hardcoded user ID like the main server
          const userId = "demo-user";
          const tokens = await database.select().from(providerTokens).where(eq(providerTokens.userId, userId));
          res.json(tokens);
        } catch (error) {
          console.error("Provider tokens fetch error:", error);
          res.status(500).json({ error: "Failed to get provider tokens" });
        }
      } else if (req.method === 'POST') {
        try {
          const { name, provider, accessToken, organizationAccess } = req.body;
          
          if (!name || !provider || !accessToken) {
            return res.status(400).json({ error: "Name, provider and access token are required" });
          }

          const database = getDatabase();
          const userId = "demo-user";

          // Check if a token with this name already exists
          const existingTokens = await database.select().from(providerTokens)
            .where(eq(providerTokens.userId, userId));
          const existingToken = existingTokens.find(t => t.name === name);
          
          if (existingToken) {
            return res.status(400).json({ error: "A provider with this name already exists. Please choose a different name." });
          }

          const tokenData = {
            id: crypto.randomUUID(),
            userId,
            name,
            provider,
            accessToken,
            organizationAccess: organizationAccess || [],
            tokenType: "personal_access_token",
            isActive: "true",
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await database.insert(providerTokens).values(tokenData);
          res.status(201).json(tokenData);
        } catch (error) {
          console.error("Provider tokens create error:", error);
          res.status(500).json({ error: "Failed to create provider token" });
        }
      } else {
        res.status(405).json({ error: "Method not allowed" });
      }
    }
    // Handle scans endpoints
    else if (requestUrl.includes('/scans') && !requestUrl.includes('cbom-reports') && !requestUrl.includes('vdr-reports')) {
      if (req.method === 'GET') {
        try {
          const database = getDatabase();
          const scansData = await database.select().from(scans);
          res.json(scansData);
        } catch (error) {
          console.error("Scans fetch error:", error);
          res.status(500).json({ error: "Failed to fetch scans" });
        }
      } else if (req.method === 'POST') {
        try {
          const { repositoryId, branch, scanConfig } = req.body;
          
          if (!repositoryId) {
            return res.status(400).json({ error: "Repository ID is required" });
          }

          const database = getDatabase();
          const scanData = {
            id: crypto.randomUUID(),
            repositoryId,
            branch: branch || "main",
            status: "pending" as const,
            progress: 0,
            totalFiles: 0,
            scanConfig,
            createdAt: new Date(),
          };

          await database.insert(scans).values(scanData);
          
          // Note: In production, you'd want to trigger the actual scanning process here
          // For now, we'll just create the scan record
          res.json({ ...scanData, jobId: `job-${scanData.id}` });
        } catch (error) {
          console.error("Scan create error:", error);
          res.status(500).json({ error: "Failed to create scan" });
        }
      } else {
        res.status(405).json({ error: "Method not allowed" });
      }
    }
    // Handle integrations endpoints
    else if (requestUrl.includes('/integrations')) {
      if (req.method === 'GET') {
        try {
          const database = getDatabase();
          const integrationsData = await database.select().from(integrations);
          res.json(integrationsData);
        } catch (error) {
          console.error("Integrations fetch error:", error);
          res.status(500).json({ error: "Failed to fetch integrations" });
        }
      } else {
        res.status(405).json({ error: "Method not allowed" });
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