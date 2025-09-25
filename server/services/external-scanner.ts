/**
 * External Scanner Service
 * 
 * Handles integration with external scanning services
 * Manages scan requests, polling for completion, and storing results
 */
import { storage } from '../storage';
import type { Integration, ScanJob } from '@shared/schema';

interface ExternalScanRequest {
  repoUrl: string;
  tool: string;
  branch: string;
}

interface ExternalScanResponse {
  status: string;
  id: string;
}

interface ExternalScanStatusResponse {
  id: string;
  repoUrl: string;
  ref: string;
  tool: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  createdAt: string;
  updatedAt: string;
  semgrepOutput?: string;
  cbomkitOutput?: string;
  pqcScore?: number;
  errorMessage?: string | null;
}

export class ExternalScannerService {
  
  /**
   * Trigger scan with external scanner integration
   */
  async triggerExternalScan(
    repositoryId: string, 
    scanId: string,
    repoUrl: string, 
    branch: string = 'main',
    integrationId: string
  ): Promise<{ success: boolean; externalScanId?: string; error?: string }> {
    try {
      // Get integration details
      const integration = await storage.getIntegration(integrationId);
      if (!integration || integration.type !== 'external_scanner') {
        return { success: false, error: 'Invalid external scanner integration' };
      }

      const { scanUrl } = integration.config;
      if (!scanUrl) {
        return { success: false, error: 'Scan URL not configured for integration' };
      }

      // Prepare scan request
      const requestBody: ExternalScanRequest = {
        repoUrl,
        tool: 'both', // Default to both semgrep and cbomkit
        branch
      };

      // Make POST request to external scanner
      const response = await fetch(scanUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('External scanner API error:', response.status, errorText);
        return { 
          success: false, 
          error: `External scanner API error: ${response.status} - ${errorText}` 
        };
      }

      const scanResponse: ExternalScanResponse = await response.json();
      
      if (scanResponse.status !== 'QUEUED') {
        return { 
          success: false, 
          error: `Unexpected scan response status: ${scanResponse.status}` 
        };
      }

      console.log(`External scan triggered: ${scanResponse.id} for repository ${repositoryId}`);
      
      // Start polling for results in background
      this.startPollingForResults(
        scanResponse.id, 
        repositoryId, 
        scanId, 
        integration.config.statusUrl || scanUrl,
        integration.id
      );

      return { 
        success: true, 
        externalScanId: scanResponse.id 
      };

    } catch (error) {
      console.error('Error triggering external scan:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Start polling for scan completion results
   */
  private startPollingForResults(
    externalScanId: string,
    repositoryId: string, 
    scanId: string,
    statusUrl: string,
    integrationId: string
  ): void {
    // Use timeout to avoid blocking
    setTimeout(() => {
      this.pollForResults(externalScanId, repositoryId, scanId, statusUrl, integrationId);
    }, 5000); // Start polling after 5 seconds
  }

  /**
   * Poll external scanner for scan completion
   */
  private async pollForResults(
    externalScanId: string,
    repositoryId: string,
    scanId: string, 
    statusUrl: string,
    integrationId: string,
    attempt: number = 1,
    maxAttempts: number = 120 // 10 minutes maximum (5 second intervals)
  ): Promise<void> {
    try {
      // Construct status check URL
      const fullStatusUrl = statusUrl.endsWith('/') 
        ? `${statusUrl}${externalScanId}`
        : `${statusUrl}/${externalScanId}`;

      const response = await fetch(fullStatusUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        console.error(`External scanner status check failed (attempt ${attempt}):`, response.status);
        if (attempt < maxAttempts) {
          setTimeout(() => {
            this.pollForResults(externalScanId, repositoryId, scanId, statusUrl, integrationId, attempt + 1, maxAttempts);
          }, 5000);
        } else {
          console.error(`External scanner polling failed after ${maxAttempts} attempts`);
        }
        return;
      }

      const statusResponse: ExternalScanStatusResponse = await response.json();
      console.log(`External scan ${externalScanId} status: ${statusResponse.status} (attempt ${attempt})`);

      if (statusResponse.status === 'COMPLETED') {
        // Scan completed successfully - store results
        await this.storeExternalScanResults(repositoryId, scanId, statusResponse, integrationId);
        console.log(`External scan ${externalScanId} completed and results stored`);
      } else if (statusResponse.status === 'FAILED') {
        // Scan failed
        console.error(`External scan ${externalScanId} failed:`, statusResponse.errorMessage);
        // Could update scan status to failed here if needed
      } else if (statusResponse.status === 'QUEUED' || statusResponse.status === 'RUNNING') {
        // Still processing - continue polling if within limits
        if (attempt < maxAttempts) {
          setTimeout(() => {
            this.pollForResults(externalScanId, repositoryId, scanId, statusUrl, integrationId, attempt + 1, maxAttempts);
          }, 5000);
        } else {
          console.error(`External scan ${externalScanId} polling timeout after ${maxAttempts} attempts`);
        }
      }

    } catch (error) {
      console.error(`Error polling external scanner status (attempt ${attempt}):`, error);
      if (attempt < maxAttempts) {
        setTimeout(() => {
          this.pollForResults(externalScanId, repositoryId, scanId, statusUrl, integrationId, attempt + 1, maxAttempts);
        }, 5000);
      }
    }
  }

  /**
   * Store external scan results in CBOM reports table
   */
  private async storeExternalScanResults(
    repositoryId: string,
    scanId: string,
    scanResults: ExternalScanStatusResponse,
    integrationId: string
  ): Promise<void> {
    try {
      if (!scanResults.semgrepOutput) {
        console.warn('No semgrepOutput in external scan results');
        return;
      }

      // Parse the stringified JSON
      let parsedSemgrepOutput;
      try {
        parsedSemgrepOutput = typeof scanResults.semgrepOutput === 'string' 
          ? JSON.parse(scanResults.semgrepOutput)
          : scanResults.semgrepOutput;
      } catch (parseError) {
        console.error('Failed to parse semgrepOutput:', parseError);
        return;
      }

      // Create CBOM report with external scan results
      const cbomReport = await storage.createCBOMReport({
        repositoryId,
        scanId,
        bomFormat: 'CycloneDX',
        specVersion: '1.6',
        content: parsedSemgrepOutput,
        cryptoAssets: [], // Could be enhanced to extract crypto assets from semgrep results
      });

      console.log(`Created CBOM report ${cbomReport.id} from external scan ${scanResults.id}`);

      // Update integration last used timestamp
      await storage.updateIntegration(integrationId, { lastUsed: new Date() });

    } catch (error) {
      console.error('Error storing external scan results:', error);
    }
  }

  /**
   * Get all external scanner integrations
   */
  async getExternalScannerIntegrations(): Promise<Integration[]> {
    const integrations = await storage.getIntegrations();
    return integrations.filter(integration => integration.type === 'external_scanner');
  }

  /**
   * Test external scanner integration connectivity
   */
  async testExternalScannerIntegration(integrationId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const integration = await storage.getIntegration(integrationId);
      if (!integration || integration.type !== 'external_scanner') {
        return { success: false, error: 'Invalid external scanner integration' };
      }

      const { scanUrl } = integration.config;
      if (!scanUrl) {
        return { success: false, error: 'Scan URL not configured' };
      }

      // Test connectivity with a HEAD request or simple GET
      const response = await fetch(scanUrl, {
        method: 'HEAD',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      return { 
        success: response.ok,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
      };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }
}

export const externalScannerService = new ExternalScannerService();