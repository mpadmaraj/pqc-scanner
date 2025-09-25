/**
 * Scan Controllers
 * 
 * Handles all scanning-related HTTP requests
 * Manages vulnerability scans and their lifecycle
 */
import { Request, Response } from 'express';
import { storage } from '../storage';
import { scannerService } from '../services/scanner';
import { integrationsService } from '../services/integrations';
import { externalScannerService } from '../services/external-scanner';
import { insertScanSchema } from '@shared/schema';
import { createAppError } from '../middleware/error-handler';

/**
 * Get all scans
 * GET /api/scans
 */
export async function getAllScans(req: Request, res: Response) {
  const scans = await storage.getScans();
  res.json(scans);
}

/**
 * Get a single scan by ID
 * GET /api/scans/:id
 */
export async function getScan(req: Request, res: Response) {
  const { id } = req.params;
  
  const scan = await storage.getScan(id);
  if (!scan) {
    throw createAppError('Scan not found', 404);
  }
  
  res.json(scan);
}

/**
 * Create and start a new scan
 * POST /api/scans
 */
export async function createScan(req: Request, res: Response) {
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
  
  // Request body is already validated by middleware
  const { repositoryId, branch = 'main', scanConfig } = req.body;
  
  // Verify repository exists
  const repository = await storage.getRepository(repositoryId);
  if (!repository) {
    throw createAppError('Repository not found', 404);
  }
  
  const scanData = {
    repositoryId,
    branch,
    scanConfig,
    integrationId
  };
  
  // Create the scan record
  const scan = await storage.createScan(scanData);
  
  // Start the built-in scan asynchronously
  scannerService.startScan(scan.id, repositoryId, scanConfig)
    .catch(error => {
      console.error(`Scan ${scan.id} failed:`, error);
      // Update scan status to failed
      storage.updateScan(scan.id, {
        status: 'failed',
        error: error.message,
        completedAt: new Date()
      });
    });

  // Check for external scanner integrations and trigger them as well
  try {
    const externalScanners = await externalScannerService.getExternalScannerIntegrations();
    if (externalScanners.length > 0) {
      console.log(`Found ${externalScanners.length} external scanner integrations for scan ${scan.id}`);
      
      // Trigger external scans for each integration
      for (const integration of externalScanners) {
        if (integration.isActive && integration.config.enabled) {
          console.log(`Triggering external scan with integration: ${integration.name} (${integration.id})`);
          
          externalScannerService.triggerExternalScan(
            repositoryId,
            scan.id,
            repository.url,
            branch,
            integration.id
          ).then(result => {
            if (result.success) {
              console.log(`External scan triggered successfully for integration ${integration.name}: ${result.externalScanId}`);
            } else {
              console.error(`Failed to trigger external scan for integration ${integration.name}:`, result.error);
            }
          }).catch(error => {
            console.error(`Error triggering external scan for integration ${integration.name}:`, error);
          });
        }
      }
    }
  } catch (error) {
    console.error('Error checking external scanner integrations:', error);
    // Don't fail the entire scan if external scanners fail
  }
  
  res.status(201).json(scan);
}

/**
 * Update scan status or configuration
 * PATCH /api/scans/:id
 */
export async function updateScan(req: Request, res: Response) {
  const { id } = req.params;
  
  // Check if scan exists
  const existingScan = await storage.getScan(id);
  if (!existingScan) {
    throw createAppError('Scan not found', 404);
  }
  
  const updateData = {
    status: req.body.status,
    progress: req.body.progress,
    error: req.body.error,
    completedAt: req.body.completedAt ? new Date(req.body.completedAt) : undefined
  };
  
  const scan = await storage.updateScan(id, updateData);
  res.json(scan);
}

/**
 * Cancel a running scan
 * POST /api/scans/:id/cancel
 */
export async function cancelScan(req: Request, res: Response) {
  const { id } = req.params;
  
  // Check if scan exists and is running
  const existingScan = await storage.getScan(id);
  if (!existingScan) {
    throw createAppError('Scan not found', 404);
  }
  
  if (existingScan.status === 'completed' || existingScan.status === 'failed') {
    throw createAppError('Cannot cancel a completed or failed scan', 400);
  }
  
  // Update scan status to cancelled
  await storage.updateScan(id, {
    status: 'failed',
    error: 'Scan cancelled by user',
    completedAt: new Date()
  });
  
  res.json({ message: 'Scan cancelled successfully' });
}

/**
 * Get scan results and statistics
 * GET /api/scans/:id/results
 */
export async function getScanResults(req: Request, res: Response) {
  const { id } = req.params;
  
  // Check if scan exists
  const scan = await storage.getScan(id);
  if (!scan) {
    throw createAppError('Scan not found', 404);
  }
  
  // Get vulnerabilities for this scan
  const vulnerabilities = await storage.getVulnerabilities({ scanId: id });
  
  // Get scan statistics
  const stats = {
    total: vulnerabilities.length,
    critical: vulnerabilities.filter(v => v.severity === 'critical').length,
    high: vulnerabilities.filter(v => v.severity === 'high').length,
    medium: vulnerabilities.filter(v => v.severity === 'medium').length,
    low: vulnerabilities.filter(v => v.severity === 'low').length,
    info: vulnerabilities.filter(v => v.severity === 'info').length
  };
  
  res.json({
    scan,
    vulnerabilities,
    stats
  });
}