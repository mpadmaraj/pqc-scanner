import { VercelRequest, VercelResponse } from '@vercel/node';
import express, { type Express } from 'express';
import { insertRepositorySchema, insertScanSchema, insertVulnerabilitySchema, insertIntegrationSchema } from '../shared/schema';

let app: Express | null = null;

function setupRoutes(app: Express, services?: {
  storage: any;
  scannerService: any;
  cbomService: any;
  vdrService: any;
  integrationsService: any;
}) {
  
  if (!services) {
    app.use('/api/*', (req, res) => {
      res.status(503).json({ error: 'Services not initialized' });
    });
    return;
  }
  
  const { storage, scannerService, cbomService, vdrService, integrationsService } = services;
  // Health check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      version: "1.0.0"
    });
  });

  // Repositories
  app.get("/api/repositories", async (req, res) => {
    try {
      const repositories = await storage.getRepositories();
      res.json(repositories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch repositories" });
    }
  });

  app.post("/api/repositories", async (req, res) => {
    try {
      console.log('Repository creation request body:', req.body);
      
      // Validate required fields first
      if (!req.body.name || !req.body.url) {
        return res.status(400).json({ 
          error: "Name and URL are required fields" 
        });
      }
      
      // Add default provider if not provided
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
      
      const repository = await storage.createRepository(data);
      console.log('Repository created successfully:', repository.id);
      
      res.json(repository);
    } catch (error) {
      console.error('Repository creation error:', error);
      
      // Check if it's a database connection error
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          return res.status(503).json({ 
            error: "Database connection failed. Please check DATABASE_URL environment variable." 
          });
        }
      }
      
      if (error instanceof Error) {
        res.status(400).json({ error: `Repository creation failed: ${error.message}` });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // Scans
  app.get("/api/scans", async (req, res) => {
    try {
      const scans = await storage.getScans();
      res.json(scans);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch scans" });
    }
  });

  app.post("/api/scans", async (req, res) => {
    try {
      const data = insertScanSchema.parse(req.body);
      const scan = await storage.createScan(data);
      
      // Start scanning process in background
      scannerService.startScan(scan.id, scan.repositoryId, data.scanConfig);
      
      res.json(scan);
    } catch (error) {
      res.status(400).json({ error: "Invalid scan data" });
    }
  });

  // Vulnerabilities
  app.get("/api/vulnerabilities", async (req, res) => {
    try {
      const vulnerabilities = await storage.getVulnerabilities();
      res.json(vulnerabilities);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vulnerabilities" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Integrations
  app.get("/api/integrations", async (req, res) => {
    try {
      const integrations = await storage.getIntegrations();
      res.json(integrations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch integrations" });
    }
  });
}

async function getApp() {
  if (!app) {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    
    // Initialize storage and services lazily in Vercel environment
    try {
      const { storage } = await import('../server/storage');
      const { scannerService } = await import('../server/services/scanner');
      const { cbomService } = await import('../server/services/cbom');
      const { vdrService } = await import('../server/services/vdr');
      const { integrationsService } = await import('../server/services/integrations');
      
      setupRoutes(app, { storage, scannerService, cbomService, vdrService, integrationsService });
    } catch (error) {
      console.error('Failed to initialize services:', error);
      // Setup basic error routes
      app.use('/api/*', (req, res) => {
        res.status(503).json({ error: 'Service initialization failed', details: error.message });
      });
    }
  }
  return app;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getApp();
  
  // Handle the request with Express
  app(req as any, res as any);
}