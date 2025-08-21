import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { scannerService } from "./services/scanner";
import { cbomService } from "./services/cbom";
import { vdrService } from "./services/vdr";
import { integrationsService } from "./services/integrations";
import { insertRepositorySchema, insertScanSchema, insertVulnerabilitySchema, insertIntegrationSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
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

  app.get("/api/repositories/:id", async (req, res) => {
    try {
      const repository = await storage.getRepository(req.params.id);
      if (!repository) {
        return res.status(404).json({ error: "Repository not found" });
      }
      res.json(repository);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch repository" });
    }
  });

  app.patch("/api/repositories/:id", async (req, res) => {
    try {
      const updateData = {
        name: req.body.name,
        url: req.body.url,
        provider: req.body.provider,
        description: req.body.description,
        languages: Array.isArray(req.body.languages) ? req.body.languages : [],
      };
      const repository = await storage.updateRepository(req.params.id, updateData);
      res.json(repository);
    } catch (error) {
      res.status(400).json({ error: "Invalid repository data" });
    }
  });

  app.delete("/api/repositories/:id", async (req, res) => {
    try {
      const repository = await storage.getRepository(req.params.id);
      if (!repository) {
        return res.status(404).json({ error: "Repository not found" });
      }
      
      await storage.deleteRepository(req.params.id);
      res.json({ message: "Repository deleted successfully" });
    } catch (error) {
      console.error("Delete repository error:", error);
      res.status(500).json({ error: "Failed to delete repository", details: error instanceof Error ? error.message : String(error) });
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

  app.get("/api/scans/:id", async (req, res) => {
    try {
      const scan = await storage.getScan(req.params.id);
      if (!scan) {
        return res.status(404).json({ error: "Scan not found" });
      }
      res.json(scan);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch scan" });
    }
  });

  app.get("/api/scans/:id/progress", async (req, res) => {
    try {
      const scan = await storage.getScan(req.params.id);
      if (!scan) {
        return res.status(404).json({ error: "Scan not found" });
      }
      res.json({ progress: scan.progress, status: scan.status });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch scan progress" });
    }
  });

  // Vulnerabilities
  app.get("/api/vulnerabilities", async (req, res) => {
    try {
      const { repositoryId, severity, status, limit, offset } = req.query;
      const vulnerabilities = await storage.getVulnerabilities({
        repositoryId: repositoryId as string,
        severity: severity as any,
        status: status as any,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(vulnerabilities);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vulnerabilities" });
    }
  });

  app.get("/api/vulnerabilities/:id", async (req, res) => {
    try {
      const vulnerability = await storage.getVulnerability(req.params.id);
      if (!vulnerability) {
        return res.status(404).json({ error: "Vulnerability not found" });
      }
      res.json(vulnerability);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vulnerability" });
    }
  });

  app.patch("/api/vulnerabilities/:id", async (req, res) => {
    try {
      const { status, workaround } = req.body;
      const vulnerability = await storage.updateVulnerabilityStatus(req.params.id, status, workaround);
      res.json(vulnerability);
    } catch (error) {
      res.status(400).json({ error: "Failed to update vulnerability" });
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

  // CBOM Reports
  app.get("/api/cbom/:repositoryId", async (req, res) => {
    try {
      const cbomReport = await storage.getCbomReport(req.params.repositoryId);
      if (!cbomReport) {
        return res.status(404).json({ error: "CBOM report not found" });
      }
      res.json(cbomReport);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch CBOM report" });
    }
  });

  app.post("/api/cbom/:repositoryId/generate", async (req, res) => {
    try {
      const cbomReport = await cbomService.generateCbom(req.params.repositoryId);
      res.json(cbomReport);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate CBOM report" });
    }
  });

  // VDR Reports
  app.get("/api/vdr/:vulnerabilityId", async (req, res) => {
    try {
      const vdrReport = await storage.getVdrReport(req.params.vulnerabilityId);
      if (!vdrReport) {
        return res.status(404).json({ error: "VDR report not found" });
      }
      res.json(vdrReport);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch VDR report" });
    }
  });

  app.post("/api/vdr/:vulnerabilityId/generate", async (req, res) => {
    try {
      const vdrReport = await vdrService.generateVdr(req.params.vulnerabilityId);
      res.json(vdrReport);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate VDR report" });
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

  app.post("/api/integrations", async (req, res) => {
    try {
      const data = insertIntegrationSchema.parse(req.body);
      const integration = await storage.createIntegration(data);
      res.json(integration);
    } catch (error) {
      res.status(400).json({ error: "Invalid integration data" });
    }
  });

  app.patch("/api/integrations/:id", async (req, res) => {
    try {
      const { config, isActive } = req.body;
      const integration = await storage.updateIntegration(req.params.id, { config, isActive });
      res.json(integration);
    } catch (error) {
      res.status(400).json({ error: "Failed to update integration" });
    }
  });

  // NIST PQC Compliance check
  app.get("/api/compliance/:repositoryId", async (req, res) => {
    try {
      const compliance = await scannerService.checkNistCompliance(req.params.repositoryId);
      res.json(compliance);
    } catch (error) {
      res.status(500).json({ error: "Failed to check compliance" });
    }
  });

  // File content for editor integration
  app.get("/api/file-content", async (req, res) => {
    try {
      const { repositoryId, filePath, startLine, endLine } = req.query;
      const fileContent = await scannerService.getFileContent(
        repositoryId as string,
        filePath as string,
        startLine ? parseInt(startLine as string) : undefined,
        endLine ? parseInt(endLine as string) : undefined
      );
      res.json({ content: fileContent });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch file content" });
    }
  });

  // Health check endpoint for deployment
  app.get("/api/health", async (req, res) => {
    try {
      // Check database connectivity
      await storage.getDashboardStats();
      res.json({ 
        status: "healthy", 
        timestamp: new Date().toISOString(),
        database: "connected",
        version: "1.0.0"
      });
    } catch (error) {
      res.status(503).json({ 
        status: "unhealthy", 
        timestamp: new Date().toISOString(),
        database: "disconnected",
        error: "Database connection failed"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
