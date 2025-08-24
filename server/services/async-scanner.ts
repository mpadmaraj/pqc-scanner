import { exec } from "child_process";
import { promisify } from "util";
import { storage } from "../storage";
import path from "path";
import fs from "fs/promises";
import { nanoid } from "nanoid";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  async createScanJob(scanId: string, repositoryId: string, config: ScanConfig): Promise<string> {
    const job: ScanJob = {
      id: scanId, // Use the database scan ID instead of generating a new one
      repositoryId,
      status: "pending",
      progress: 0,
      config,
    };

    this.jobQueue.set(scanId, job);
    console.log(`Created scan job ${scanId} for repository ${repositoryId}`);
    
    return scanId;
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
      console.log(`Starting execution of scan job ${job.id}`);
      
      // Mark job as running
      job.status = "running";
      job.startedAt = new Date();
      job.progress = 0;
      this.activeJobs.add(job.id);

      // Update database
      await storage.updateScanStatus(job.id, "scanning", 0);
      
      console.log(`Updated scan ${job.id} status to scanning`);

      // Get repository info
      const repository = await storage.getRepository(job.repositoryId);
      if (!repository) {
        throw new Error("Repository not found");
      }

      // Clone repository to temp directory  
      job.progress = 10;
      const scan = await storage.getScan(job.id);
      const branch = scan?.branch || "main";
      const tempDir = await this.cloneRepository(repository.url, job.id, branch);

      // Run semgrep scan
      job.progress = 30;
      await storage.updateScanStatus(job.id, "scanning", 30);
      const scanResult = await this.runSemgrepScan(tempDir, job.config);

      // Process results and create vulnerabilities
      job.progress = 80;
      await storage.updateScanStatus(job.id, "scanning", 80);
      await this.processResults(job.repositoryId, job.id, scanResult);

      // Generate CBOM report
      job.progress = 95;
      await storage.updateScanStatus(job.id, "scanning", 95);
      await this.generateCBOMReport(job.repositoryId, job.id, scanResult);

      // Mark job as completed
      job.status = "completed";
      job.progress = 100;
      job.completedAt = new Date();

      await storage.updateScanStatus(job.id, "completed", 100);
      
      console.log(`Scan ${job.id} completed successfully`);

      // Cleanup temp directory
      await this.cleanup(tempDir);

    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : "Unknown error";
      job.completedAt = new Date();

      await storage.updateScanStatus(job.id, "failed", 0, job.error);

      console.error(`Scan job ${job.id} failed:`, error);
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  private async cloneRepository(url: string, jobId: string, branch: string = "main"): Promise<string> {
    const tempDir = path.join("/tmp", `scan-${jobId}`);
    
    try {
      // Create temp directory
      await fs.mkdir(tempDir, { recursive: true });

      // Clone repository with specific branch (shallow clone for speed)
      const { stdout, stderr } = await execAsync(
        `git clone --depth 1 --branch "${branch}" "${url}" "${tempDir}"`,
        { timeout: 30000 }
      );

      console.log(`Successfully cloned repository ${url} branch ${branch} to ${tempDir}`);
      return tempDir;
    } catch (error) {
      // If branch doesn't exist, try cloning default branch
      console.warn(`Failed to clone branch ${branch}, trying default branch:`, error);
      try {
        const { stdout, stderr } = await execAsync(
          `git clone --depth 1 "${url}" "${tempDir}"`,
          { timeout: 30000 }
        );
        console.log(`Successfully cloned repository ${url} default branch to ${tempDir}`);
        return tempDir;
      } catch (fallbackError) {
        throw new Error(`Failed to clone repository: ${fallbackError}`);
      }
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

  private async generateCBOMReport(repositoryId: string, scanId: string, scanResult: ScanResult) {
    const repository = await storage.getRepository(repositoryId);
    if (!repository) return;

    // Extract cryptographic assets from findings
    const cryptoAssets = this.extractCryptoAssets(scanResult.findings);
    
    // Analyze quantum safety compliance
    const compliance = this.analyzeQuantumSafety(cryptoAssets);
    
    // Generate CBOM data structure
    const cbomReport = {
      repository: {
        name: repository.name,
        url: repository.url,
        provider: repository.provider,
      },
      scanId: scanId,
      timestamp: new Date().toISOString(),
      summary: {
        totalAssets: cryptoAssets.length,
        quantumSafe: cryptoAssets.filter(a => a.quantumSafe).length,
        quantumVulnerable: cryptoAssets.filter(a => !a.quantumSafe && a.quantumSafe !== null).length,
        unknown: cryptoAssets.filter(a => a.quantumSafe === null).length,
      },
      compliance: compliance,
      assets: cryptoAssets,
      primitives: this.categorizePrimitives(cryptoAssets),
      recommendations: this.generateRecommendations(cryptoAssets, compliance),
    };

    // Store the CBOM report
    await storage.createCbomReport({
      repositoryId,
      scanId,
      content: cbomReport,
    });

    console.log(`Generated CBOM report for scan ${scanId} with ${cryptoAssets.length} crypto assets`);
  }

  private extractCryptoAssets(findings: Finding[]): CryptoAsset[] {
    const assets: CryptoAsset[] = [];
    const assetMap = new Map<string, CryptoAsset>();

    findings.forEach(finding => {
      const algorithm = this.extractAlgorithmFromFinding(finding);
      if (algorithm) {
        const key = `${algorithm}-${finding.file}-${finding.line}`;
        
        if (!assetMap.has(key)) {
          const asset: CryptoAsset = {
            name: algorithm,
            type: this.determineAssetType(algorithm, finding),
            primitive: this.determinePrimitive(algorithm, finding),
            location: `${finding.file}:${finding.line}`,
            quantumSafe: this.isQuantumSafe(algorithm),
            severity: finding.severity,
            description: finding.message,
            recommendation: this.getAlgorithmRecommendation(algorithm),
          };
          assetMap.set(key, asset);
          assets.push(asset);
        }
      }
    });

    return assets;
  }

  private extractAlgorithmFromFinding(finding: Finding): string | null {
    // Extract algorithm names from the finding
    const message = finding.message.toLowerCase();
    const code = finding.code.toLowerCase();
    
    // Common crypto algorithms
    const algorithms = [
      'rsa', 'ecdsa', 'ecdh', 'dsa', 'dh',
      'aes', 'des', '3des', 'blowfish', 'rc4',
      'sha1', 'sha256', 'sha512', 'md5', 'sha3',
      'kyber', 'dilithium', 'sphincs', 'falcon',
      'x25519', 'x448', 'ed25519', 'ed448',
      'shake128', 'shake256', 'blake2',
    ];

    for (const algo of algorithms) {
      if (message.includes(algo) || code.includes(algo)) {
        return algo.toUpperCase();
      }
    }

    // Extract from rule ID
    if (finding.ruleId.includes('crypto') || finding.ruleId.includes('hash')) {
      const match = finding.ruleId.match(/([a-zA-Z0-9]+)$/);
      if (match) return match[1].toUpperCase();
    }

    return null;
  }

  private determineAssetType(algorithm: string, finding: Finding): string {
    if (finding.code.includes('private') || finding.code.includes('key')) {
      return 'Related Crypto Material';
    }
    return 'Algorithm';
  }

  private determinePrimitive(algorithm: string, finding: Finding): string {
    const algo = algorithm.toLowerCase();
    
    if (['rsa', 'ecdsa', 'dsa', 'ed25519', 'ed448', 'dilithium', 'falcon', 'sphincs'].includes(algo)) {
      return 'Digital Signature';
    }
    if (['ecdh', 'dh', 'x25519', 'x448', 'kyber'].includes(algo)) {
      return 'Key Agreement';
    }
    if (['sha1', 'sha256', 'sha512', 'md5', 'sha3', 'blake2'].includes(algo)) {
      return 'Hash Function';
    }
    if (['shake128', 'shake256'].includes(algo)) {
      return 'Extendable Output Function';
    }
    if (['aes', 'des', '3des', 'blowfish', 'rc4'].includes(algo)) {
      return 'Symmetric Encryption';
    }
    
    return 'Unspecified';
  }

  private isQuantumSafe(algorithm: string): boolean | null {
    const algo = algorithm.toLowerCase();
    
    // Quantum-safe algorithms
    const quantumSafe = ['kyber', 'dilithium', 'sphincs', 'falcon', 'sha3', 'shake128', 'shake256', 'blake2'];
    if (quantumSafe.some(safe => algo.includes(safe))) return true;
    
    // Quantum-vulnerable algorithms
    const quantumVulnerable = ['rsa', 'ecdsa', 'ecdh', 'dsa', 'dh'];
    if (quantumVulnerable.some(vuln => algo.includes(vuln))) return false;
    
    // Symmetric algorithms (larger key sizes are quantum-resistant)
    if (['aes'].includes(algo)) return true; // Assuming AES-256
    
    return null; // Unknown
  }

  private analyzeQuantumSafety(assets: CryptoAsset[]): ComplianceStatus {
    const total = assets.length;
    const quantumSafe = assets.filter(a => a.quantumSafe === true).length;
    const quantumVulnerable = assets.filter(a => a.quantumSafe === false).length;
    
    const compliance = total > 0 ? (quantumSafe / total) * 100 : 0;
    
    return {
      status: compliance >= 100 ? 'compliant' : compliance >= 80 ? 'partial' : 'not_compliant',
      score: Math.round(compliance),
      policy: 'quantum_safe',
      details: `${quantumSafe}/${total} assets are quantum-safe`,
      recommendations: quantumVulnerable > 0 ? 
        [`Migrate ${quantumVulnerable} quantum-vulnerable algorithms to post-quantum alternatives`] : []
    };
  }

  private categorizePrimitives(assets: CryptoAsset[]): PrimitiveCategory[] {
    const primitiveCount = new Map<string, number>();
    
    assets.forEach(asset => {
      const current = primitiveCount.get(asset.primitive) || 0;
      primitiveCount.set(asset.primitive, current + 1);
    });

    return Array.from(primitiveCount.entries()).map(([name, count]) => ({
      name,
      count,
      percentage: assets.length > 0 ? Math.round((count / assets.length) * 100) : 0
    }));
  }

  private generateRecommendations(assets: CryptoAsset[], compliance: ComplianceStatus): string[] {
    const recommendations: string[] = [];
    
    if (compliance.status !== 'compliant') {
      recommendations.push('Migrate to NIST-approved post-quantum cryptography standards');
    }
    
    const vulnerableAlgorithms = assets.filter(a => a.quantumSafe === false);
    if (vulnerableAlgorithms.length > 0) {
      const algos = [...new Set(vulnerableAlgorithms.map(a => a.name))];
      recommendations.push(`Replace quantum-vulnerable algorithms: ${algos.join(', ')}`);
    }
    
    const hasRSA = assets.some(a => a.name.includes('RSA'));
    if (hasRSA) {
      recommendations.push('Replace RSA with ML-KEM (CRYSTALS-KYBER) for key encapsulation');
    }
    
    const hasECDSA = assets.some(a => a.name.includes('ECDSA'));
    if (hasECDSA) {
      recommendations.push('Replace ECDSA with ML-DSA (CRYSTALS-Dilithium) for digital signatures');
    }

    return recommendations;
  }

  private getAlgorithmRecommendation(algorithm: string): string {
    const algo = algorithm.toLowerCase();
    
    if (algo.includes('rsa')) return 'Migrate to ML-KEM (CRYSTALS-KYBER)';
    if (algo.includes('ecdsa')) return 'Migrate to ML-DSA (CRYSTALS-Dilithium)';
    if (algo.includes('ecdh')) return 'Migrate to ML-KEM (CRYSTALS-KYBER)';
    if (algo.includes('sha1') || algo.includes('md5')) return 'Upgrade to SHA-3 or BLAKE2';
    if (algo.includes('des')) return 'Upgrade to AES-256';
    
    return 'Review for quantum-safety compliance';
  }

  private async cleanup(directory: string) {
    try {
      await execAsync(`rm -rf "${directory}"`);
    } catch (error) {
      console.warn(`Failed to cleanup directory ${directory}:`, error);
    }
  }
}

interface CryptoAsset {
  name: string;
  type: string;
  primitive: string;
  location: string;
  quantumSafe: boolean | null;
  severity: string;
  description: string;
  recommendation: string;
}

interface ComplianceStatus {
  status: 'compliant' | 'partial' | 'not_compliant';
  score: number;
  policy: string;
  details: string;
  recommendations: string[];
}

interface PrimitiveCategory {
  name: string;
  count: number;
  percentage: number;
}

export const asyncScannerService = new AsyncScannerService();