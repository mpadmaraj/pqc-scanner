import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { storage } from "../storage";
import type { InsertVulnerability, Scan } from "@shared/schema";

interface ScanResult {
  vulnerabilities: InsertVulnerability[];
  cryptoAssets: Array<{
    name: string;
    algorithm: string;
    keySize?: number;
    location: string;
    nistCompliance?: boolean;
  }>;
}

class ScannerService {
  private activeScanJobs = new Map<string, any>();

  async startScan(scanId: string, repositoryId: string, config?: any) {
    try {
      await storage.updateScanStatus(scanId, "scanning", 0);
      
      const repository = await storage.getRepository(repositoryId);
      if (!repository) {
        throw new Error("Repository not found");
      }

      // Clone or access repository
      const repoPath = await this.prepareRepository(repository);
      
      // Run multiple scanning tools
      const results = await this.runScanningTools(repoPath, config);
      
      // Save vulnerabilities
      for (const vuln of results.vulnerabilities) {
        await storage.createVulnerability({
          ...vuln,
          scanId,
          repositoryId,
        });
      }

      // Update scan status
      await storage.updateScanStatus(scanId, "completed", 100);
      
      // Generate CBOM if crypto assets found
      if (results.cryptoAssets.length > 0) {
        const cbomService = await import("./cbom");
        await cbomService.cbomService.generateCbomFromAssets(repositoryId, scanId, results.cryptoAssets);
      }

    } catch (error) {
      await storage.updateScanStatus(scanId, "failed", 0, (error as Error).message);
      throw error;
    }
  }

  private async prepareRepository(repository: any): Promise<string> {
    const tempDir = path.join(process.cwd(), "temp", repository.id);
    
    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });
    
    if (repository.provider === "github" || repository.provider === "gitlab") {
      // Clone repository
      await this.cloneRepository(repository.url, tempDir);
    } else {
      // Copy local repository
      throw new Error("Local repository scanning not yet implemented");
    }
    
    return tempDir;
  }

  private async cloneRepository(url: string, targetPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const git = spawn("git", ["clone", "--depth", "1", url, targetPath]);
      
      git.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Git clone failed with code ${code}`));
        }
      });
      
      git.on("error", reject);
    });
  }

  private async runScanningTools(repoPath: string, config: any): Promise<ScanResult> {
    const results: ScanResult = {
      vulnerabilities: [],
      cryptoAssets: []
    };

    // Run Semgrep for crypto vulnerabilities
    const semgrepResults = await this.runSemgrep(repoPath);
    results.vulnerabilities.push(...semgrepResults.vulnerabilities);
    results.cryptoAssets.push(...semgrepResults.cryptoAssets);

    // Run Bandit for Python
    if (await this.hasFiles(repoPath, "**/*.py")) {
      const banditResults = await this.runBandit(repoPath);
      results.vulnerabilities.push(...banditResults);
    }

    // Run PMD for Java
    if (await this.hasFiles(repoPath, "**/*.java")) {
      const pmdResults = await this.runPMD(repoPath);
      results.vulnerabilities.push(...pmdResults);
    }

    // Run custom PQC rules
    const pqcResults = await this.runPQCAnalysis(repoPath);
    results.vulnerabilities.push(...pqcResults.vulnerabilities);
    results.cryptoAssets.push(...pqcResults.cryptoAssets);

    return results;
  }

  private async runSemgrep(repoPath: string): Promise<{ vulnerabilities: InsertVulnerability[]; cryptoAssets: any[] }> {
    return new Promise((resolve, reject) => {
      const semgrep = spawn("semgrep", [
        "--config=security.cryptography",
        "--json",
        repoPath
      ]);

      let output = "";
      semgrep.stdout.on("data", (data) => {
        output += data.toString();
      });

      semgrep.on("close", (code) => {
        try {
          const results = JSON.parse(output);
          const vulnerabilities: InsertVulnerability[] = [];
          const cryptoAssets: any[] = [];

          results.results?.forEach((finding: any) => {
            vulnerabilities.push({
              repositoryId: "", // Will be set by caller
              scanId: "", // Will be set by caller
              title: finding.extra?.message || "Cryptographic vulnerability",
              description: finding.extra?.message || "",
              severity: this.mapSeverity(finding.extra?.severity || "medium"),
              filePath: finding.path,
              startLine: finding.start?.line,
              endLine: finding.end?.line,
              codeSnippet: finding.extra?.lines,
              recommendation: this.getCryptoRecommendation(finding),
              detectedBy: "semgrep",
              pqcCategory: this.getPQCCategory(finding),
              metadata: {
                library: finding.extra?.metadata?.library,
                algorithm: finding.extra?.metadata?.algorithm,
              }
            });

            // Extract crypto assets
            if (finding.extra?.metadata?.algorithm) {
              cryptoAssets.push({
                name: finding.extra.metadata.algorithm,
                algorithm: finding.extra.metadata.algorithm,
                location: `${finding.path}:${finding.start?.line}`,
                nistCompliance: this.checkNistComplianceAlgorithm(finding.extra.metadata.algorithm)
              });
            }
          });

          resolve({ vulnerabilities, cryptoAssets });
        } catch (error) {
          reject(error);
        }
      });

      semgrep.on("error", reject);
    });
  }

  private async runBandit(repoPath: string): Promise<InsertVulnerability[]> {
    return new Promise((resolve, reject) => {
      const bandit = spawn("bandit", ["-r", "-f", "json", repoPath]);

      let output = "";
      bandit.stdout.on("data", (data) => {
        output += data.toString();
      });

      bandit.on("close", (code) => {
        try {
          const results = JSON.parse(output);
          const vulnerabilities: InsertVulnerability[] = [];

          results.results?.forEach((finding: any) => {
            if (finding.test_name?.includes("crypto") || finding.issue_text?.toLowerCase().includes("crypt")) {
              vulnerabilities.push({
                repositoryId: "", // Will be set by caller
                scanId: "", // Will be set by caller
                title: finding.test_name || "Python cryptographic issue",
                description: finding.issue_text,
                severity: this.mapBanditSeverity(finding.issue_severity),
                filePath: finding.filename,
                startLine: finding.line_number,
                endLine: finding.line_number,
                codeSnippet: finding.code,
                recommendation: this.getBanditRecommendation(finding),
                detectedBy: "bandit",
                pqcCategory: this.getPQCCategoryFromBandit(finding),
              });
            }
          });

          resolve(vulnerabilities);
        } catch (error) {
          resolve([]); // Bandit might fail on some repos
        }
      });

      bandit.on("error", () => resolve([]));
    });
  }

  private async runPMD(repoPath: string): Promise<InsertVulnerability[]> {
    // PMD implementation for Java crypto analysis
    return [];
  }

  private async runPQCAnalysis(repoPath: string): Promise<{ vulnerabilities: InsertVulnerability[]; cryptoAssets: any[] }> {
    // Custom PQC-specific analysis using regex patterns
    const vulnerabilities: InsertVulnerability[] = [];
    const cryptoAssets: any[] = [];

    const pqcPatterns = [
      { pattern: /RSA\.generate\((\d+)\)/, algorithm: "RSA", vulnerable: true },
      { pattern: /Cipher\.getInstance\("RSA/, algorithm: "RSA", vulnerable: true },
      { pattern: /SHA1|MD5/, algorithm: "Weak Hash", vulnerable: true },
      { pattern: /DES|3DES/, algorithm: "DES", vulnerable: true },
      { pattern: /CRYSTALS-KYBER|ML-KEM/, algorithm: "ML-KEM", vulnerable: false },
      { pattern: /CRYSTALS-Dilithium|ML-DSA/, algorithm: "ML-DSA", vulnerable: false },
      { pattern: /SPHINCS\+|SLH-DSA/, algorithm: "SLH-DSA", vulnerable: false },
    ];

    const files = await this.getFiles(repoPath);
    
    for (const file of files) {
      const content = await fs.readFile(file, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, index) => {
        pqcPatterns.forEach((pattern) => {
          const match = line.match(pattern.pattern);
          if (match) {
            if (pattern.vulnerable) {
              vulnerabilities.push({
                repositoryId: "", // Will be set by caller
                scanId: "", // Will be set by caller
                title: `${pattern.algorithm} Quantum Vulnerability`,
                description: `Usage of quantum-vulnerable ${pattern.algorithm} algorithm detected`,
                severity: pattern.algorithm === "RSA" ? "critical" : "high",
                filePath: path.relative(repoPath, file),
                startLine: index + 1,
                endLine: index + 1,
                codeSnippet: line.trim(),
                recommendation: this.getPQCRecommendation(pattern.algorithm),
                detectedBy: "pqc-analyzer",
                pqcCategory: "quantum_vulnerable",
                metadata: {
                  algorithm: pattern.algorithm,
                  keySize: match[1] ? parseInt(match[1]) : undefined,
                }
              });
            }

            cryptoAssets.push({
              name: pattern.algorithm,
              algorithm: pattern.algorithm,
              location: `${path.relative(repoPath, file)}:${index + 1}`,
              nistCompliance: !pattern.vulnerable
            });
          }
        });
      });
    }

    return { vulnerabilities, cryptoAssets };
  }

  private async hasFiles(repoPath: string, pattern: string): Promise<boolean> {
    // Simple check for file existence
    try {
      const files = await this.getFiles(repoPath);
      return files.some(file => file.includes(pattern.replace("**/*.", "").replace("*", "")));
    } catch {
      return false;
    }
  }

  private async getFiles(repoPath: string): Promise<string[]> {
    const files: string[] = [];
    
    async function walkDir(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    }
    
    await walkDir(repoPath);
    return files;
  }

  private mapSeverity(severity: string): "critical" | "high" | "medium" | "low" | "info" {
    const severityMap: Record<string, "critical" | "high" | "medium" | "low" | "info"> = {
      "ERROR": "critical",
      "WARNING": "medium",
      "INFO": "info",
      "critical": "critical",
      "high": "high",
      "medium": "medium",
      "low": "low",
      "info": "info"
    };
    return severityMap[severity.toLowerCase()] || "medium";
  }

  private mapBanditSeverity(severity: string): "critical" | "high" | "medium" | "low" | "info" {
    const severityMap: Record<string, "critical" | "high" | "medium" | "low" | "info"> = {
      "HIGH": "high",
      "MEDIUM": "medium",
      "LOW": "low"
    };
    return severityMap[severity] || "medium";
  }

  private getCryptoRecommendation(finding: any): string {
    // Generate recommendations based on finding
    const algorithm = finding.extra?.metadata?.algorithm;
    if (algorithm?.includes("RSA")) {
      return "Migrate to quantum-safe key encapsulation mechanism (ML-KEM) as per FIPS 203";
    }
    if (algorithm?.includes("ECDSA")) {
      return "Replace with quantum-safe digital signatures (ML-DSA) as per FIPS 204";
    }
    return "Consider migrating to post-quantum cryptography algorithms";
  }

  private getBanditRecommendation(finding: any): string {
    if (finding.test_id === "B303") {
      return "Replace MD5 with SHA-3 or other quantum-resistant hash functions";
    }
    if (finding.test_id === "B101") {
      return "Use cryptographically secure random number generators";
    }
    return "Review and update cryptographic implementation";
  }

  private getPQCCategory(finding: any): string {
    const message = finding.extra?.message?.toLowerCase() || "";
    if (message.includes("rsa") || message.includes("ecdsa")) {
      return "quantum_vulnerable";
    }
    if (message.includes("migration") || message.includes("upgrade")) {
      return "migration_required";
    }
    return "crypto_weakness";
  }

  private getPQCCategoryFromBandit(finding: any): string {
    const testName = finding.test_name?.toLowerCase() || "";
    if (testName.includes("weak") || testName.includes("insecure")) {
      return "quantum_vulnerable";
    }
    return "crypto_weakness";
  }

  private getPQCRecommendation(algorithm: string): string {
    const recommendations: Record<string, string> = {
      "RSA": "Replace RSA with ML-KEM (CRYSTALS-KYBER) for key encapsulation. Use key sizes of at least 1024 for ML-KEM according to FIPS 203.",
      "ECDSA": "Migrate to ML-DSA (CRYSTALS-Dilithium) for digital signatures as specified in FIPS 204.",
      "DES": "Replace DES/3DES with AES-256 and plan migration to quantum-safe symmetric algorithms.",
      "Weak Hash": "Replace MD5/SHA1 with SHA-3 or other quantum-resistant hash functions.",
    };
    return recommendations[algorithm] || "Evaluate quantum-safety and migrate to NIST-approved post-quantum algorithms";
  }

  private checkNistComplianceAlgorithm(algorithm: string): boolean {
    const nistApproved = ["ML-KEM", "CRYSTALS-KYBER", "ML-DSA", "CRYSTALS-Dilithium", "SLH-DSA", "SPHINCS+"];
    return nistApproved.some(approved => algorithm.includes(approved));
  }

  async checkNistCompliance(repositoryId: string) {
    const vulnerabilities = await storage.getVulnerabilities({ repositoryId });
    
    const compliance = {
      fips203: { name: "FIPS 203 (ML-KEM)", status: "missing", description: "CRYSTALS-KYBER Implementation" },
      fips204: { name: "FIPS 204 (ML-DSA)", status: "missing", description: "CRYSTALS-Dilithium Implementation" },
      fips205: { name: "FIPS 205 (SLH-DSA)", status: "missing", description: "SPHINCS+ Implementation" },
    };

    vulnerabilities.forEach(vuln => {
      const algorithm = vuln.metadata?.algorithm;
      if (algorithm?.includes("KYBER") || algorithm?.includes("ML-KEM")) {
        compliance.fips203.status = "compliant";
      }
      if (algorithm?.includes("Dilithium") || algorithm?.includes("ML-DSA")) {
        compliance.fips204.status = "compliant";
      }
      if (algorithm?.includes("SPHINCS") || algorithm?.includes("SLH-DSA")) {
        compliance.fips205.status = "compliant";
      }
    });

    // Check for partial compliance based on vulnerabilities
    const hasQuantumVulnerable = vulnerabilities.some(v => v.pqcCategory === "quantum_vulnerable");
    if (hasQuantumVulnerable) {
      Object.keys(compliance).forEach(key => {
        if (compliance[key as keyof typeof compliance].status === "missing") {
          compliance[key as keyof typeof compliance].status = "partial";
        }
      });
    }

    return compliance;
  }

  async getFileContent(repositoryId: string, filePath: string, startLine?: number, endLine?: number): Promise<string> {
    const repository = await storage.getRepository(repositoryId);
    if (!repository) {
      throw new Error("Repository not found");
    }

    const repoPath = path.join(process.cwd(), "temp", repository.id);
    const fullFilePath = path.join(repoPath, filePath);

    try {
      const content = await fs.readFile(fullFilePath, "utf-8");
      
      if (startLine && endLine) {
        const lines = content.split("\n");
        const selectedLines = lines.slice(Math.max(0, startLine - 5), endLine + 5);
        return selectedLines.join("\n");
      }
      
      return content;
    } catch (error) {
      throw new Error("File not found or inaccessible");
    }
  }
}

export const scannerService = new ScannerService();
