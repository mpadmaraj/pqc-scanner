import { storage } from "../storage";
import type { InsertCbomReport } from "@shared/schema";

interface CryptographicAsset {
  name: string;
  algorithm: string;
  keySize?: number;
  location: string;
  nistCompliance?: boolean;
  library?: string;
  version?: string;
}

class CbomService {
  async generateCbom(repositoryId: string, scanId?: string): Promise<any> {
    const repository = await storage.getRepository(repositoryId);
    if (!repository) {
      throw new Error("Repository not found");
    }

    // Get crypto assets from vulnerabilities if scanId provided
    const cryptoAssets = scanId 
      ? await this.extractCryptoAssetsFromScan(scanId)
      : await this.extractCryptoAssetsFromRepository(repositoryId);

    const cbomContent = this.generateCycloneDXCBOM(repository, cryptoAssets);

    const cbomReport: InsertCbomReport = {
      repositoryId,
      scanId,
      bomFormat: "CycloneDX",
      specVersion: "1.6",
      content: cbomContent,
      cryptoAssets,
    };

    return await storage.createCbomReport(cbomReport);
  }

  async generateCbomFromAssets(repositoryId: string, scanId: string, assets: CryptographicAsset[]): Promise<any> {
    const repository = await storage.getRepository(repositoryId);
    if (!repository) {
      throw new Error("Repository not found");
    }

    const cbomContent = this.generateCycloneDXCBOM(repository, assets);

    const cbomReport: InsertCbomReport = {
      repositoryId,
      scanId,
      bomFormat: "CycloneDX",
      specVersion: "1.6",
      content: cbomContent,
      cryptoAssets: assets,
    };

    return await storage.createCbomReport(cbomReport);
  }

  private async extractCryptoAssetsFromScan(scanId: string): Promise<CryptographicAsset[]> {
    const vulnerabilities = await storage.getVulnerabilitiesByScan(scanId);
    const assets: CryptographicAsset[] = [];

    vulnerabilities.forEach(vuln => {
      if (vuln.metadata?.algorithm) {
        assets.push({
          name: vuln.metadata.algorithm,
          algorithm: vuln.metadata.algorithm,
          keySize: vuln.metadata.keySize,
          location: `${vuln.filePath}:${vuln.startLine}`,
          nistCompliance: this.checkNistCompliance(vuln.metadata.algorithm),
          library: vuln.metadata.library,
        });
      }
    });

    return this.deduplicateAssets(assets);
  }

  private async extractCryptoAssetsFromRepository(repositoryId: string): Promise<CryptographicAsset[]> {
    const vulnerabilities = await storage.getVulnerabilities({ repositoryId });
    const assets: CryptographicAsset[] = [];

    vulnerabilities.forEach(vuln => {
      if (vuln.metadata?.algorithm) {
        assets.push({
          name: vuln.metadata.algorithm,
          algorithm: vuln.metadata.algorithm,
          keySize: vuln.metadata.keySize,
          location: `${vuln.filePath}:${vuln.startLine}`,
          nistCompliance: this.checkNistCompliance(vuln.metadata.algorithm),
          library: vuln.metadata.library,
        });
      }
    });

    return this.deduplicateAssets(assets);
  }

  private generateCycloneDXCBOM(repository: any, cryptoAssets: CryptographicAsset[]) {
    return {
      bomFormat: "CycloneDX",
      specVersion: "1.6",
      serialNumber: `urn:uuid:${this.generateUUID()}`,
      version: 1,
      metadata: {
        timestamp: new Date().toISOString(),
        tools: [
          {
            vendor: "PQC Scanner",
            name: "PQC Vulnerability Scanner",
            version: "1.0.0"
          }
        ],
        component: {
          type: "application",
          name: repository.name,
          description: repository.description || `Cryptographic analysis of ${repository.name}`,
          scope: "required"
        }
      },
      cryptographyProperties: {
        asymmetricCryptography: this.extractAsymmetricAlgorithms(cryptoAssets),
        symmetricCryptography: this.extractSymmetricAlgorithms(cryptoAssets),
        hashFunctions: this.extractHashFunctions(cryptoAssets),
        keyAgreement: this.extractKeyAgreement(cryptoAssets),
        keyDerivation: this.extractKeyDerivation(cryptoAssets),
        postQuantumCryptography: this.extractPQCAlgorithms(cryptoAssets),
        nistApproved: this.extractNistApproved(cryptoAssets)
      },
      components: this.generateCryptoComponents(cryptoAssets),
      dependencies: this.generateDependencies(cryptoAssets)
    };
  }

  private extractAsymmetricAlgorithms(assets: CryptographicAsset[]): any[] {
    return assets
      .filter(asset => ["RSA", "ECDSA", "DSA", "ML-DSA", "ML-KEM"].some(alg => asset.algorithm.includes(alg)))
      .map(asset => ({
        algorithm: asset.algorithm,
        keySize: asset.keySize,
        padding: asset.algorithm.includes("RSA") ? "PKCS1" : undefined,
        curve: asset.algorithm.includes("ECDSA") ? "P-256" : undefined,
        quantumSafe: this.checkNistCompliance(asset.algorithm)
      }));
  }

  private extractSymmetricAlgorithms(assets: CryptographicAsset[]): any[] {
    return assets
      .filter(asset => ["AES", "DES", "3DES", "ChaCha20"].some(alg => asset.algorithm.includes(alg)))
      .map(asset => ({
        algorithm: asset.algorithm,
        keySize: asset.keySize || this.getDefaultKeySize(asset.algorithm),
        mode: this.getDefaultMode(asset.algorithm),
        quantumSafe: asset.keySize ? asset.keySize >= 256 : false
      }));
  }

  private extractHashFunctions(assets: CryptographicAsset[]): any[] {
    return assets
      .filter(asset => ["SHA", "MD5", "SHA-3", "BLAKE"].some(alg => asset.algorithm.includes(alg)))
      .map(asset => ({
        algorithm: asset.algorithm,
        outputSize: this.getHashOutputSize(asset.algorithm),
        quantumSafe: !["MD5", "SHA1"].includes(asset.algorithm)
      }));
  }

  private extractKeyAgreement(assets: CryptographicAsset[]): any[] {
    return assets
      .filter(asset => ["ECDH", "DH", "ML-KEM"].some(alg => asset.algorithm.includes(alg)))
      .map(asset => ({
        algorithm: asset.algorithm,
        keySize: asset.keySize,
        quantumSafe: asset.algorithm.includes("ML-KEM")
      }));
  }

  private extractKeyDerivation(assets: CryptographicAsset[]): any[] {
    return assets
      .filter(asset => ["PBKDF2", "scrypt", "Argon2", "HKDF"].some(alg => asset.algorithm.includes(alg)))
      .map(asset => ({
        algorithm: asset.algorithm,
        iterations: asset.algorithm.includes("PBKDF2") ? 10000 : undefined,
        quantumSafe: true // Most KDFs are considered quantum-safe
      }));
  }

  private extractPQCAlgorithms(assets: CryptographicAsset[]): any[] {
    return assets
      .filter(asset => this.checkNistCompliance(asset.algorithm))
      .map(asset => ({
        algorithm: asset.algorithm,
        nistStandard: this.getNistStandard(asset.algorithm),
        securityLevel: this.getSecurityLevel(asset.algorithm)
      }));
  }

  private extractNistApproved(assets: CryptographicAsset[]): any[] {
    return assets
      .filter(asset => this.checkNistCompliance(asset.algorithm))
      .map(asset => ({
        algorithm: asset.algorithm,
        fipsApproved: true,
        standard: this.getNistStandard(asset.algorithm)
      }));
  }

  private generateCryptoComponents(assets: CryptographicAsset[]): any[] {
    return assets.map((asset, index) => ({
      type: "library",
      name: asset.library || asset.algorithm,
      version: asset.version || "unknown",
      scope: "required",
      bom_ref: `crypto-component-${index}`,
      cryptoProperties: {
        algorithm: asset.algorithm,
        keySize: asset.keySize,
        quantumSafe: this.checkNistCompliance(asset.algorithm),
        nistApproved: this.checkNistCompliance(asset.algorithm)
      },
      evidence: {
        occurrences: [
          {
            location: asset.location
          }
        ]
      }
    }));
  }

  private generateDependencies(assets: CryptographicAsset[]): any[] {
    const dependencies: any[] = [];
    const libraries = [...new Set(assets.map(a => a.library).filter(Boolean))];
    
    libraries.forEach(library => {
      const relatedAssets = assets.filter(a => a.library === library);
      dependencies.push({
        ref: library,
        dependsOn: relatedAssets.map((_, index) => `crypto-component-${index}`)
      });
    });

    return dependencies;
  }

  private deduplicateAssets(assets: CryptographicAsset[]): CryptographicAsset[] {
    const seen = new Set<string>();
    return assets.filter(asset => {
      const key = `${asset.algorithm}-${asset.location}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private checkNistCompliance(algorithm: string): boolean {
    const nistApproved = [
      "ML-KEM", "CRYSTALS-KYBER", 
      "ML-DSA", "CRYSTALS-Dilithium", 
      "SLH-DSA", "SPHINCS+",
      "AES", "SHA-2", "SHA-3"
    ];
    return nistApproved.some(approved => algorithm.includes(approved));
  }

  private getNistStandard(algorithm: string): string {
    if (algorithm.includes("ML-KEM") || algorithm.includes("KYBER")) return "FIPS 203";
    if (algorithm.includes("ML-DSA") || algorithm.includes("Dilithium")) return "FIPS 204";
    if (algorithm.includes("SLH-DSA") || algorithm.includes("SPHINCS")) return "FIPS 205";
    return "Unknown";
  }

  private getSecurityLevel(algorithm: string): number {
    // NIST security levels (1, 3, 5 corresponding to AES-128, AES-192, AES-256)
    if (algorithm.includes("512") || algorithm.includes("1024")) return 1;
    if (algorithm.includes("768")) return 3;
    if (algorithm.includes("1024") && algorithm.includes("ML-KEM")) return 5;
    return 1;
  }

  private getDefaultKeySize(algorithm: string): number {
    const keySizes: Record<string, number> = {
      "AES": 256,
      "DES": 56,
      "3DES": 168,
      "ChaCha20": 256
    };
    return keySizes[algorithm] || 256;
  }

  private getDefaultMode(algorithm: string): string {
    if (algorithm.includes("AES")) return "GCM";
    if (algorithm.includes("ChaCha20")) return "Poly1305";
    return "CBC";
  }

  private getHashOutputSize(algorithm: string): number {
    const outputSizes: Record<string, number> = {
      "MD5": 128,
      "SHA1": 160,
      "SHA-256": 256,
      "SHA-384": 384,
      "SHA-512": 512,
      "SHA-3": 256
    };
    
    for (const [alg, size] of Object.entries(outputSizes)) {
      if (algorithm.includes(alg)) return size;
    }
    return 256;
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

export const cbomService = new CbomService();
