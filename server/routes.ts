import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { scannerService } from "./services/scanner";
import { cbomService } from "./services/cbom";
import { vdrService } from "./services/vdr";
import { integrationsService } from "./services/integrations";
import { initializeDefaultIntegrations } from "./services/integrations";
import { repositoryImportService } from "./services/repository-import";
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
      // Check for API key authentication
      const authHeader = req.headers.authorization;
      let integrationId = null;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const apiKey = authHeader.substring(7);
        const integration = await integrationsService.authenticateApiKey(apiKey);
        if (integration) {
          integrationId = integration.id;
          // Update last used timestamp
          await storage.updateIntegration(integration.id, { lastUsed: new Date() });
        }
      }
      
      const data = insertRepositorySchema.parse(req.body);
      const repositoryData = {
        ...data,
        integrationId
      };
      const repository = await storage.createRepository(repositoryData);
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
      // Check for API key authentication
      const authHeader = req.headers.authorization;
      let integrationId = null;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const apiKey = authHeader.substring(7);
        const integration = await integrationsService.authenticateApiKey(apiKey);
        if (integration) {
          integrationId = integration.id;
          // Update last used timestamp
          await storage.updateIntegration(integration.id, { lastUsed: new Date() });
        }
      }
      
      const data = insertScanSchema.parse(req.body);
      const scanData = {
        ...data,
        integrationId
      };
      const scan = await storage.createScan(scanData);
      
      // Start scanning process in background using async scanner
      const jobId = await scannerService.startScan(scan.id, scan.repositoryId, data.scanConfig);
      
      res.json({ ...scan, jobId });
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

  // Debug endpoint for job queue status
  app.get("/api/debug/scan-jobs", async (req, res) => {
    try {
      const jobs = await scannerService.getActiveJobs();
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch job queue status" });
    }
  });

  // CBOM Reports
  app.get("/api/cbom-reports/:scanId", async (req, res) => {
    try {
      const cbomReport = await storage.getCBOMReportByScan(req.params.scanId);
      if (!cbomReport) {
        return res.status(404).json({ error: "CBOM report not found" });
      }
      res.json(cbomReport);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch CBOM report" });
    }
  });

  app.get("/api/cbom-reports", async (req, res) => {
    try {
      const { repositoryId } = req.query;
      const cbomReports = await storage.getCBOMReports({ 
        repositoryId: repositoryId as string 
      });
      res.json(cbomReports);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch CBOM reports" });
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

  // Enhanced dashboard analytics
  app.get("/api/dashboard/language-stats", async (req, res) => {
    try {
      const stats = await storage.getRepositoryLanguageStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch language stats" });
    }
  });

  app.get("/api/dashboard/crypto-assets", async (req, res) => {
    try {
      const stats = await storage.getCryptoAssetStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch crypto asset stats" });
    }
  });

  app.get("/api/dashboard/crypto-libraries", async (req, res) => {
    try {
      const stats = await storage.getCryptoLibrariesStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch crypto libraries stats" });
    }
  });

  app.get("/api/dashboard/vulnerability-trends", async (req, res) => {
    try {
      const stats = await storage.getVulnerabilityTrends();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vulnerability trends" });
    }
  });

  app.get("/api/dashboard/detailed-stats", async (req, res) => {
    try {
      const stats = await storage.getDetailedStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch detailed stats" });
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
      // Generate API key for the integration
      const apiKey = integrationsService.generateApiKey();
      const integrationData = {
        ...data,
        apiKey
      };
      const integration = await storage.createIntegration(integrationData);
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

  app.post("/api/integrations/:id/regenerate-key", async (req, res) => {
    try {
      const integration = await storage.getIntegration(req.params.id);
      if (!integration) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      const newApiKey = integrationsService.generateApiKey();
      const updatedIntegration = await storage.updateIntegration(req.params.id, { apiKey: newApiKey });
      res.json(updatedIntegration);
    } catch (error) {
      res.status(500).json({ error: "Failed to regenerate API key" });
    }
  });

  app.get("/api/integrations/:id/instructions", async (req, res) => {
    try {
      const integration = await storage.getIntegration(req.params.id);
      if (!integration) {
        return res.status(404).json({ error: "Integration not found" });
      }
      const instructionsData = integrationsService.generateIntegrationInstructions(integration);
      res.json(instructionsData);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate instructions" });
    }
  });

  app.post("/api/integrations/:id/test", async (req, res) => {
    try {
      const integration = await storage.getIntegration(req.params.id);
      if (!integration) {
        return res.status(404).json({ error: "Integration not found" });
      }

      let testResult = false;
      switch (integration.type) {
        case "github_actions":
          if (integration.apiKey) {
            testResult = await integrationsService.testGitHubConnection(integration.apiKey);
          }
          break;
        case "jenkins":
          testResult = await integrationsService.testJenkinsConnection(integration.config);
          break;
        case "sonarqube":
          testResult = await integrationsService.testSonarQubeConnection(integration.config);
          break;
        case "api_key":
          testResult = true; // API keys are always "testable"
          break;
      }

      res.json({ success: testResult });
    } catch (error) {
      res.status(500).json({ error: "Test connection failed" });
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

  // Provider token management routes
  app.get("/api/settings/provider-tokens", async (req, res) => {
    try {
      // For now, we'll use a hardcoded user ID since we don't have auth yet
      const userId = "demo-user";
      const tokens = await storage.getProviderTokens(userId);
      res.json(tokens);
    } catch (error) {
      res.status(500).json({ error: "Failed to get provider tokens" });
    }
  });

  app.post("/api/settings/provider-tokens", async (req, res) => {
    try {
      const { provider, accessToken, organizationAccess } = req.body;
      
      if (!provider || !accessToken) {
        return res.status(400).json({ error: "Provider and access token are required" });
      }

      // For now, we'll use a hardcoded user ID since we don't have auth yet
      const userId = "demo-user";

      // Check if a token for this provider already exists
      const existingToken = await storage.getProviderTokenByProvider(userId, provider);
      if (existingToken) {
        return res.status(400).json({ error: "Token for this provider already exists. Please update or delete the existing token first." });
      }

      const tokenData = {
        userId,
        provider,
        accessToken,
        organizationAccess: organizationAccess || [],
        tokenType: "personal_access_token" as const,
        isActive: true
      };

      const createdToken = await storage.createProviderToken(tokenData);
      res.status(201).json(createdToken);
    } catch (error) {
      res.status(500).json({ error: "Failed to create provider token" });
    }
  });

  app.post("/api/settings/provider-tokens/:id/test", async (req, res) => {
    try {
      const token = await storage.getProviderToken(req.params.id);
      if (!token) {
        return res.status(404).json({ error: "Provider token not found" });
      }

      // Test the token by making a simple API call
      let testResult = false;

      switch (token.provider) {
        case "github":
          try {
            const response = await fetch("https://api.github.com/user", {
              headers: {
                "Authorization": `Bearer ${token.accessToken}`,
                "Accept": "application/vnd.github.v3+json"
              }
            });
            testResult = response.ok;
          } catch (error) {
            testResult = false;
          }
          break;
        case "gitlab":
          try {
            const response = await fetch("https://gitlab.com/api/v4/user", {
              headers: {
                "Authorization": `Bearer ${token.accessToken}`
              }
            });
            testResult = response.ok;
          } catch (error) {
            testResult = false;
          }
          break;
        case "bitbucket":
          try {
            const response = await fetch("https://api.bitbucket.org/2.0/user", {
              headers: {
                "Authorization": `Bearer ${token.accessToken}`
              }
            });
            testResult = response.ok;
          } catch (error) {
            testResult = false;
          }
          break;
        default:
          return res.status(400).json({ error: "Unsupported provider" });
      }

      if (testResult) {
        res.json({ success: true });
      } else {
        res.status(401).json({ error: "Token validation failed" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to test provider token" });
    }
  });

  app.delete("/api/settings/provider-tokens/:id", async (req, res) => {
    try {
      const token = await storage.getProviderToken(req.params.id);
      if (!token) {
        return res.status(404).json({ error: "Provider token not found" });
      }

      await storage.deleteProviderToken(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete provider token" });
    }
  });

  // Organization repository import routes
  app.post("/api/repositories/scan-organization", async (req, res) => {
    try {
      const { provider, organization } = req.body;
      
      if (!provider || !organization) {
        return res.status(400).json({ error: "Provider and organization are required" });
      }

      // For now, we'll use a hardcoded user ID since we don't have auth yet
      const userId = "demo-user";
      
      const result = await repositoryImportService.scanOrganization(userId, provider, organization);
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to scan organization" 
      });
    }
  });

  app.post("/api/repositories/rescan-all", async (req, res) => {
    try {
      // For now, we'll use a hardcoded user ID since we don't have auth yet
      const userId = "demo-user";
      
      const results = await repositoryImportService.rescanAllProviders(userId);
      res.json(results);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to rescan repositories" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
