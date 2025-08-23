import { exec } from "child_process";
import { promisify } from "util";
import { storage } from "../storage";
import path from "path";
import fs from "fs/promises";
import { nanoid } from "nanoid";

const execAsync = promisify(exec);

export interface ScanJob {
  id: string;
  repositoryId: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  config: ScanConfig;
}

export interface ScanConfig {
  tools: string[];
  languages: string[];
  customRules: string[];
  severity: "error" | "warning" | "info";
  maxFileSize: number;
  timeout: number;
}

export interface ScanResult {
  findings: Finding[];
  summary: {
    totalFiles: number;
    scannedFiles: number;
    totalFindings: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };
}

export interface Finding {
  ruleId: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  message: string;
  file: string;
  line: number;
  column?: number;
  code: string;
  category: string;
  technology: string;
}

class AsyncScannerService {
  private jobQueue: Map<string, ScanJob> = new Map();
  private activeJobs: Set<string> = new Set();
  private maxConcurrentJobs = 3;

  constructor() {
    // Start the job processor
    this.processJobs();
  }

  async createScanJob(repositoryId: string, config: ScanConfig): Promise<string> {
    const jobId = nanoid();
    const job: ScanJob = {
      id: jobId,
      repositoryId,
      status: "pending",
      progress: 0,
      config,
    };

    this.jobQueue.set(jobId, job);
    
    // Create scan record in database
    await storage.createScan({
      repositoryId,
      status: "pending",
      scanConfig: config,
    });

    return jobId;
  }

  async getScanJob(jobId: string): Promise<ScanJob | undefined> {
    return this.jobQueue.get(jobId);
  }

  async getAllJobs(): Promise<ScanJob[]> {
    return Array.from(this.jobQueue.values());
  }

  private async processJobs() {
    setInterval(async () => {
      if (this.activeJobs.size >= this.maxConcurrentJobs) {
        return;
      }

      // Find next pending job
      const pendingJob = Array.from(this.jobQueue.values()).find(
        job => job.status === "pending"
      );

      if (pendingJob) {
        await this.executeJob(pendingJob);
      }
    }, 1000);
  }

  private async executeJob(job: ScanJob) {
    try {
      // Mark job as running
      job.status = "running";
      job.startedAt = new Date();
      job.progress = 0;
      this.activeJobs.add(job.id);

      // Update database
      await storage.updateScan(job.id, {
        status: "running",
        progress: 0,
      });

      // Get repository info
      const repository = await storage.getRepository(job.repositoryId);
      if (!repository) {
        throw new Error("Repository not found");
      }

      // Clone repository to temp directory
      job.progress = 10;
      const tempDir = await this.cloneRepository(repository.url, job.id);

      // Run semgrep scan
      job.progress = 30;
      const scanResult = await this.runSemgrepScan(tempDir, job.config);

      // Process results and create vulnerabilities
      job.progress = 80;
      await this.processResults(job.repositoryId, job.id, scanResult);

      // Mark job as completed
      job.status = "completed";
      job.progress = 100;
      job.completedAt = new Date();

      await storage.updateScan(job.id, {
        status: "completed",
        progress: 100,
        completedAt: new Date(),
      });

      // Cleanup temp directory
      await this.cleanup(tempDir);

    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : "Unknown error";
      job.completedAt = new Date();

      await storage.updateScan(job.id, {
        status: "failed",
        error: job.error,
        completedAt: new Date(),
      });

      console.error(`Scan job ${job.id} failed:`, error);
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  private async cloneRepository(url: string, jobId: string): Promise<string> {
    const tempDir = path.join("/tmp", `scan-${jobId}`);
    
    try {
      // Create temp directory
      await fs.mkdir(tempDir, { recursive: true });

      // Clone repository (shallow clone for speed)
      const { stdout, stderr } = await execAsync(
        `git clone --depth 1 "${url}" "${tempDir}"`,
        { timeout: 30000 }
      );

      return tempDir;
    } catch (error) {
      throw new Error(`Failed to clone repository: ${error}`);
    }
  }

  private async runSemgrepScan(directory: string, config: ScanConfig): Promise<ScanResult> {
    const rulesFile = path.join(__dirname, "../semgrep-rules/pqc-rules.yaml");
    
    try {
      // Build semgrep command
      const command = [
        "semgrep",
        "--config", rulesFile,
        "--json",
        "--no-git-ignore",
        directory
      ].join(" ");

      const { stdout, stderr } = await execAsync(command, {
        timeout: config.timeout || 300000, // 5 minutes default
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      // Parse semgrep JSON output
      const semgrepOutput = JSON.parse(stdout);
      
      return this.parseSemgrepOutput(semgrepOutput);
    } catch (error) {
      // Semgrep returns non-zero exit code when findings are present
      if (error instanceof Error && 'stdout' in error) {
        try {
          const semgrepOutput = JSON.parse((error as any).stdout);
          return this.parseSemgrepOutput(semgrepOutput);
        } catch (parseError) {
          throw new Error(`Failed to parse semgrep output: ${parseError}`);
        }
      }
      throw new Error(`Semgrep scan failed: ${error}`);
    }
  }

  private parseSemgrepOutput(semgrepOutput: any): ScanResult {
    const findings: Finding[] = [];
    let totalFiles = 0;
    let scannedFiles = 0;

    if (semgrepOutput.results) {
      findings.push(...semgrepOutput.results.map((result: any) => ({
        ruleId: result.check_id,
        severity: this.mapSeverity(result.extra.severity),
        message: result.extra.message,
        file: result.path,
        line: result.start.line,
        column: result.start.col,
        code: result.extra.lines || "",
        category: result.extra.metadata?.category || "security",
        technology: result.extra.metadata?.technology?.[0] || "unknown",
      })));
    }

    // Count findings by severity
    const errorCount = findings.filter(f => f.severity === "critical" || f.severity === "high").length;
    const warningCount = findings.filter(f => f.severity === "medium" || f.severity === "low").length;
    const infoCount = findings.filter(f => f.severity === "info").length;

    // Get file statistics from semgrep output
    if (semgrepOutput.paths) {
      totalFiles = semgrepOutput.paths.scanned?.length || 0;
      scannedFiles = totalFiles;
    }

    return {
      findings,
      summary: {
        totalFiles,
        scannedFiles,
        totalFindings: findings.length,
        errorCount,
        warningCount,
        infoCount,
      }
    };
  }

  private mapSeverity(semgrepSeverity: string): "critical" | "high" | "medium" | "low" | "info" {
    switch (semgrepSeverity?.toLowerCase()) {
      case "error":
        return "critical";
      case "warning":
        return "medium";
      case "info":
        return "info";
      default:
        return "high";
    }
  }

  private async processResults(repositoryId: string, scanId: string, result: ScanResult) {
    // Delete existing vulnerabilities for this scan
    await storage.deleteVulnerabilitiesByScan(scanId);

    // Create new vulnerabilities
    for (const finding of result.findings) {
      await storage.createVulnerability({
        repositoryId,
        scanId,
        severity: finding.severity,
        title: finding.message,
        description: `[${finding.ruleId}] ${finding.message}`,
        filePath: finding.file,
        detectedBy: "semgrep",
        status: "new",
      });
    }
  }

  private async cleanup(directory: string) {
    try {
      await execAsync(`rm -rf "${directory}"`);
    } catch (error) {
      console.warn(`Failed to cleanup directory ${directory}:`, error);
    }
  }
}

export const asyncScannerService = new AsyncScannerService();