import { VercelRequest, VercelResponse } from '@vercel/node';
import express, { type Express } from 'express';
import { storage } from '../server/storage';
import { scannerService } from '../server/services/scanner';
import { cbomService } from '../server/services/cbom';
import { vdrService } from '../server/services/vdr';
import { integrationsService } from '../server/services/integrations';
import { insertRepositorySchema, insertScanSchema, insertVulnerabilitySchema, insertIntegrationSchema } from '../shared/schema';

let app: Express | null = null;

function setupRoutes(app: Express) {
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
      const data = insertRepositorySchema.parse(req.body);
      const repository = await storage.createRepository(data);
      res.json(repository);
    } catch (error) {
      res.status(400).json({ error: "Invalid repository data" });
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
    
    setupRoutes(app);
  }
  return app;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getApp();
  
  // Handle the request with Express
  app(req as any, res as any);
}