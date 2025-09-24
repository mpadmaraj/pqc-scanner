import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { scannerService } from "./services/scanner";
import { cbomService } from "./services/cbom";
import { vdrService } from "./services/vdr";
import { integrationsService } from "./services/integrations";
import { initializeDefaultIntegrations } from "./services/integrations";
import { repositoryImportService } from "./services/repository-import";
import { pdfGenerator } from "./services/pdf-generator";
import { githubAPI } from "./services/github-api";
import path from 'path';
import { promises as fs } from 'fs';
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
        branches: Array.isArray(req.body.branches) ? req.body.branches : ["main"],
        availableBranches: Array.isArray(req.body.availableBranches) ? req.body.availableBranches : [],
      };
      
      // If updating only availableBranches, this is a branch refresh from GitHub
      if (req.body.availableBranches && Object.keys(req.body).length === 1) {
        console.log(`Updating repository ${req.params.id} with ${req.body.availableBranches.length} available branches from GitHub:`, req.body.availableBranches);
      }
      
      const repository = await storage.updateRepository(req.params.id, updateData);
      res.json(repository);
    } catch (error) {
      console.error("Update repository error:", error);
      res.status(400).json({ error: "Invalid repository data" });
    }
  });

  app.put("/api/repositories/:id", async (req, res) => {
    try {
      const updateData = {
        name: req.body.name,
        url: req.body.url,
        provider: req.body.provider,
        description: req.body.description,
        languages: Array.isArray(req.body.languages) ? req.body.languages : [],
        branches: Array.isArray(req.body.branches) ? req.body.branches : ["main"],
        availableBranches: Array.isArray(req.body.availableBranches) ? req.body.availableBranches : [],
      };
      
      // If updating only availableBranches, this is a branch refresh from GitHub
      if (req.body.availableBranches && Object.keys(req.body).length === 1) {
        console.log(`Updating repository ${req.params.id} with ${req.body.availableBranches.length} available branches from GitHub:`, req.body.availableBranches);
      }
      
      const repository = await storage.updateRepository(req.params.id, updateData);
      res.json(repository);
    } catch (error) {
      console.error("Update repository error:", error);
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

  // GitHub API routes for branch fetching
  // Temporary endpoint for fetching branches before repository creation (must be before :id route)
  app.get("/api/repositories/temp/branches", async (req, res) => {
    try {
      const repoUrl = req.query.url as string;
      if (!repoUrl) {
        return res.status(400).json({ error: "Repository URL is required" });
      }

      if (!repoUrl.includes('github.com')) {
        return res.status(400).json({ error: "Branch fetching only supported for GitHub repositories" });
      }

      // Try to get GitHub token from provider tokens (future implementation)
      // For now, try without token (public repos only)
      const branches = await githubAPI.fetchRepositoryBranches(repoUrl);
      res.json({ branches });
    } catch (error) {
      console.error("Error fetching branches:", error);
      res.status(500).json({ 
        error: "Failed to fetch branches", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  app.get("/api/repositories/:id/branches", async (req, res) => {
    try {
      const repository = await storage.getRepository(req.params.id);
      if (!repository) {
        return res.status(404).json({ error: "Repository not found" });
      }

      if (repository.provider !== 'github') {
        return res.status(400).json({ error: "Branch fetching only supported for GitHub repositories" });
      }

      // Try to get GitHub token from provider tokens (future implementation)
      // For now, try without token (public repos only)
      const branches = await githubAPI.fetchRepositoryBranches(repository.url);
      res.json({ branches });
    } catch (error) {
      console.error("Error fetching branches:", error);
      res.status(500).json({ 
        error: "Failed to fetch branches", 
        details: error instanceof Error ? error.message : String(error) 
      });
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

  // Generate and download PDF report
  app.get("/api/cbom-reports/:scanId/pdf", async (req, res) => {
    try {
      const { scanId } = req.params;
      const report = await storage.getCbomReportByScanId(scanId);
      
      if (!report) {
        return res.status(404).json({ error: "CBOM report not found" });
      }

      const repository = await storage.getRepository(report.repositoryId);
      if (!repository) {
        return res.status(404).json({ error: "Repository not found" });
      }

      // Generate PDF buffer directly
      const pdfBuffer = await pdfGenerator.generateCBOMPDF(report, repository.name);

      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="cbom-report-${repository.name}-${scanId}.pdf"`);
      
      // Send the PDF buffer
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating PDF report:", error);
      res.status(500).json({ error: "Failed to generate PDF report" });
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
      const { name, provider, accessToken, organizationAccess } = req.body;
      
      if (!name || !provider || !accessToken) {
        return res.status(400).json({ error: "Name, provider and access token are required" });
      }

      // For now, we'll use a hardcoded user ID since we don't have auth yet
      const userId = "demo-user";

      // Check if a token with this name already exists for this user
      const existingToken = await storage.getProviderTokenByName(userId, name);
      if (existingToken) {
        return res.status(400).json({ error: "A provider with this name already exists. Please choose a different name." });
      }

      const tokenData = {
        userId,
        name,
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
      let errorMessage = "";

      switch (token.provider) {
        case "github":
          try {
            const response = await fetch("https://api.github.com/user", {
              headers: {
                "Authorization": `Bearer ${token.accessToken}`,
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "Q-Scan-App"
              }
            });
            
            if (response.ok) {
              testResult = true;
            } else {
              const errorData = await response.json().catch(() => ({}));
              errorMessage = errorData.message || `HTTP ${response.status}: ${response.statusText}`;
            }
          } catch (error) {
            errorMessage = error instanceof Error ? error.message : "Network error";
            testResult = false;
          }
          break;
        case "gitlab":
          try {
            const response = await fetch("https://gitlab.com/api/v4/user", {
              headers: {
                "Authorization": `Bearer ${token.accessToken}`,
                "Accept": "application/json"
              }
            });
            
            if (response.ok) {
              testResult = true;
            } else {
              const errorData = await response.json().catch(() => ({}));
              errorMessage = errorData.message || `HTTP ${response.status}: ${response.statusText}`;
            }
          } catch (error) {
            errorMessage = error instanceof Error ? error.message : "Network error";
            testResult = false;
          }
          break;
        case "bitbucket":
          try {
            const response = await fetch("https://api.bitbucket.org/2.0/user", {
              headers: {
                "Authorization": `Bearer ${token.accessToken}`,
                "Accept": "application/json"
              }
            });
            
            if (response.ok) {
              testResult = true;
            } else {
              const errorData = await response.json().catch(() => ({}));
              errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
            }
          } catch (error) {
            errorMessage = error instanceof Error ? error.message : "Network error";
            testResult = false;
          }
          break;
        default:
          return res.status(400).json({ error: "Unsupported provider for testing" });
      }

      if (testResult) {
        // Update token as active
        await storage.updateProviderToken(token.id, { isActive: true });
        res.json({ success: true, message: "Token is valid and active" });
      } else {
        // Mark token as inactive
        await storage.updateProviderToken(token.id, { isActive: false });
        res.status(401).json({ success: false, message: errorMessage || "Token is invalid or expired" });
      }
    } catch (error) {
      console.error("Token test error:", error);
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
  app.post("/api/repositories/fetch-organization", async (req, res) => {
    try {
      const { providerTokenId, organization } = req.body;
      
      if (!providerTokenId || !organization) {
        return res.status(400).json({ error: "Provider token ID and organization are required" });
      }

      const token = await storage.getProviderToken(providerTokenId);
      if (!token) {
        return res.status(404).json({ error: "Provider token not found" });
      }

      let repositories = [];

      // Fetch repositories from the actual provider
      try {
        switch (token.provider) {
          case "github":
            let githubResponse;
            let attemptType = "organization";
            
            try {
              // Try organization first
              console.log(`Trying GitHub organization: ${organization}`);
              githubResponse = await fetch(`https://api.github.com/orgs/${organization}/repos?per_page=100`, {
                headers: {
                  "Authorization": `Bearer ${token.accessToken}`,
                  "Accept": "application/vnd.github.v3+json",
                  "User-Agent": "Q-Scan-App"
                }
              });

              console.log(`GitHub org response status: ${githubResponse.status}`);

              // If organization doesn't exist (404), try as a user
              if (githubResponse.status === 404) {
                console.log(`Organization not found, trying as user: ${organization}`);
                attemptType = "user";
                githubResponse = await fetch(`https://api.github.com/users/${organization}/repos?per_page=100`, {
                  headers: {
                    "Authorization": `Bearer ${token.accessToken}`,
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "Q-Scan-App"
                  }
                });
                console.log(`GitHub user response status: ${githubResponse.status}`);
              }

              if (!githubResponse.ok) {
                const errorData = await githubResponse.json().catch(() => ({}));
                const errorDetails = {
                  status: githubResponse.status,
                  statusText: githubResponse.statusText,
                  attemptType,
                  organization,
                  message: errorData.message,
                  documentation_url: errorData.documentation_url
                };
                
                let userFriendlyMessage = "";
                if (githubResponse.status === 404) {
                  userFriendlyMessage = `GitHub ${attemptType} '${organization}' not found. Please check the ${attemptType} name and ensure it exists.`;
                } else if (githubResponse.status === 401) {
                  userFriendlyMessage = `GitHub token is invalid or expired. Please check your token permissions.`;
                } else if (githubResponse.status === 403) {
                  userFriendlyMessage = `GitHub token doesn't have permission to access '${organization}' repositories. Make sure the token has 'repo' scope.`;
                } else {
                  userFriendlyMessage = `GitHub API error (${githubResponse.status}): ${errorData.message || githubResponse.statusText}`;
                }

                throw new Error(`${userFriendlyMessage} | Details: ${JSON.stringify(errorDetails)}`);
              }

              repositories = await githubResponse.json();
              console.log(`Successfully fetched ${repositories.length} repositories from GitHub ${attemptType}: ${organization}`);
            } catch (fetchError) {
              console.error("GitHub fetch error:", fetchError);
              throw fetchError;
            }
            break;

          case "gitlab":
            const gitlabResponse = await fetch(`https://gitlab.com/api/v4/groups/${organization}/projects?per_page=100`, {
              headers: {
                "Authorization": `Bearer ${token.accessToken}`,
                "Accept": "application/json"
              }
            });

            if (!gitlabResponse.ok) {
              const errorData = await gitlabResponse.json().catch(() => ({}));
              throw new Error(errorData.message || `GitLab API error: ${gitlabResponse.status}`);
            }

            repositories = await gitlabResponse.json();
            break;

          case "bitbucket":
            const bitbucketResponse = await fetch(`https://api.bitbucket.org/2.0/repositories/${organization}?pagelen=100`, {
              headers: {
                "Authorization": `Bearer ${token.accessToken}`,
                "Accept": "application/json"
              }
            });

            if (!bitbucketResponse.ok) {
              const errorData = await bitbucketResponse.json().catch(() => ({}));
              throw new Error(errorData.error?.message || `Bitbucket API error: ${bitbucketResponse.status}`);
            }

            const bitbucketData = await bitbucketResponse.json();
            repositories = bitbucketData.values || [];
            break;

          default:
            throw new Error(`Unsupported provider: ${token.provider}`);
        }

        res.json({ 
          success: true, 
          repositories: repositories,
          count: repositories.length
        });
      } catch (apiError) {
        console.error("API Error:", apiError);
        res.status(500).json({ 
          error: "Failed to fetch repositories from provider",
          details: apiError instanceof Error ? apiError.message : "Unknown error"
        });
      }
    } catch (error) {
      console.error("Fetch organization error:", error);
      res.status(500).json({ error: "Failed to fetch organization repositories" });
    }
  });

  app.post("/api/repositories/import-bulk", async (req, res) => {
    try {
      const { repositories: reposToImport } = req.body;
      
      if (!Array.isArray(reposToImport) || reposToImport.length === 0) {
        return res.status(400).json({ error: "Repositories array is required" });
      }

      const importedRepos = [];
      
      for (const repoData of reposToImport) {
        try {
          const repository = await storage.createRepository({
            name: repoData.name,
            url: repoData.url,
            provider: repoData.provider,
            description: repoData.description || "",
            languages: repoData.languages || [],
            branches: repoData.branches || ["main"],
          });
          importedRepos.push(repository);
        } catch (error) {
          console.error(`Failed to import repository ${repoData.name}:`, error);
          // Continue with other repositories even if one fails
        }
      }

      res.json({ 
        success: true, 
        count: importedRepos.length,
        repositories: importedRepos
      });
    } catch (error) {
      console.error("Bulk import error:", error);
      res.status(500).json({ error: "Failed to import repositories" });
    }
  });

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

