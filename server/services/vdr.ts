import { storage } from "../storage";
import type { InsertVdrReport } from "@shared/schema";

class VdrService {
  async generateVdr(vulnerabilityId: string): Promise<any> {
    const vulnerability = await storage.getVulnerability(vulnerabilityId);
    if (!vulnerability) {
      throw new Error("Vulnerability not found");
    }

    const repository = await storage.getRepository(vulnerability.repositoryId);
    if (!repository) {
      throw new Error("Repository not found");
    }

    const vdrContent = this.generateCycloneDXVDR(vulnerability, repository);
    const vexStatus = this.determineVexStatus(vulnerability);

    const vdrReport: InsertVdrReport = {
      vulnerabilityId,
      bomFormat: "CycloneDX",
      specVersion: "1.6",
      content: vdrContent,
      vexStatus,
    };

    return await storage.createVdrReport(vdrReport);
  }

  private generateCycloneDXVDR(vulnerability: any, repository: any) {
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
          description: repository.description || `Vulnerability report for ${repository.name}`,
          scope: "required"
        }
      },
      vulnerabilities: [
        {
          id: vulnerability.cveId || `PQC-${vulnerability.id}`,
          source: {
            name: vulnerability.detectedBy,
            url: this.getSourceUrl(vulnerability.detectedBy)
          },
          detail: vulnerability.description,
          recommendation: vulnerability.recommendation,
          workaround: vulnerability.workaround,
          ratings: [
            {
              source: {
                name: "PQC Scanner"
              },
              score: this.getCvssScore(vulnerability.severity),
              severity: vulnerability.severity,
              method: "CVSSv3.1",
              vector: this.generateCvssVector(vulnerability)
            }
          ],
          affects: [
            {
              ref: `${repository.name}-component`,
              versions: [
                {
                  version: "current",
                  status: this.getAffectedStatus(vulnerability.status)
                }
              ]
            }
          ],
          published: vulnerability.createdAt,
          updated: vulnerability.updatedAt,
          analysis: {
            state: this.mapVulnerabilityStateToAnalysis(vulnerability.status),
            justification: this.getJustification(vulnerability),
            response: this.getResponse(vulnerability),
            detail: this.getAnalysisDetail(vulnerability)
          },
          proofOfConcept: {
            reproductionSteps: this.generateReproductionSteps(vulnerability),
            environment: this.getEnvironmentInfo(vulnerability)
          },
          advisories: this.generateAdvisories(vulnerability)
        }
      ],
      components: [
        {
          type: "application",
          name: repository.name,
          version: "current",
          scope: "required",
          bom_ref: `${repository.name}-component`,
          evidence: {
            occurrences: [
              {
                location: vulnerability.filePath,
                line: vulnerability.startLine,
                offset: vulnerability.endLine - vulnerability.startLine
              }
            ]
          }
        }
      ]
    };
  }

  private determineVexStatus(vulnerability: any): string {
    const statusMap: Record<string, string> = {
      "new": "under_investigation",
      "reviewing": "under_investigation", 
      "fixed": "fixed",
      "false_positive": "not_affected",
      "ignored": "not_affected"
    };
    return statusMap[vulnerability.status] || "affected";
  }

  private getCvssScore(severity: string): number {
    const scoreMap: Record<string, number> = {
      "critical": 9.0,
      "high": 7.5,
      "medium": 5.0,
      "low": 3.0,
      "info": 1.0
    };
    return scoreMap[severity] || 5.0;
  }

  private generateCvssVector(vulnerability: any): string {
    // Generate a basic CVSS v3.1 vector based on vulnerability characteristics
    let vector = "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U";
    
    const impactMap: Record<string, string> = {
      "critical": "C:H/I:H/A:H",
      "high": "C:H/I:L/A:L",
      "medium": "C:L/I:L/A:N",
      "low": "C:L/I:N/A:N",
      "info": "C:N/I:N/A:N"
    };
    
    return `${vector}/${impactMap[vulnerability.severity] || impactMap.medium}`;
  }

  private getAffectedStatus(status: string): string {
    const statusMap: Record<string, string> = {
      "new": "affected",
      "reviewing": "affected",
      "fixed": "unaffected",
      "false_positive": "unaffected",
      "ignored": "unaffected"
    };
    return statusMap[status] || "affected";
  }

  private mapVulnerabilityStateToAnalysis(status: string): string {
    const stateMap: Record<string, string> = {
      "new": "in_triage",
      "reviewing": "in_triage",
      "fixed": "resolved",
      "false_positive": "false_positive",
      "ignored": "not_applicable"
    };
    return stateMap[status] || "in_triage";
  }

  private getJustification(vulnerability: any): string {
    if (vulnerability.status === "false_positive") {
      return "code_not_reachable";
    }
    if (vulnerability.status === "ignored") {
      return "requires_configuration";
    }
    return "exploitable";
  }

  private getResponse(vulnerability: any): string[] {
    const responses = [];
    if (vulnerability.recommendation) {
      responses.push("can_not_fix");
    }
    if (vulnerability.workaround) {
      responses.push("will_not_fix");
    }
    return responses.length > 0 ? responses : ["update"];
  }

  private getAnalysisDetail(vulnerability: any): string {
    let detail = `Post-Quantum Cryptography vulnerability detected in ${vulnerability.filePath}`;
    if (vulnerability.pqcCategory) {
      detail += ` (Category: ${vulnerability.pqcCategory})`;
    }
    if (vulnerability.metadata?.algorithm) {
      detail += `. Uses ${vulnerability.metadata.algorithm} algorithm`;
      if (vulnerability.metadata.keySize) {
        detail += ` with ${vulnerability.metadata.keySize}-bit keys`;
      }
    }
    return detail;
  }

  private generateReproductionSteps(vulnerability: any): string {
    const steps = [
      `1. Navigate to file: ${vulnerability.filePath}`,
      `2. Examine lines ${vulnerability.startLine}-${vulnerability.endLine}`,
      `3. Review the cryptographic implementation:`
    ];
    
    if (vulnerability.codeSnippet) {
      steps.push(`   ${vulnerability.codeSnippet}`);
    }
    
    steps.push("4. Verify the algorithm is quantum-vulnerable");
    
    if (vulnerability.metadata?.algorithm) {
      steps.push(`5. Confirm usage of ${vulnerability.metadata.algorithm}`);
    }

    return steps.join('\n');
  }

  private getEnvironmentInfo(vulnerability: any): any {
    return {
      language: this.detectLanguage(vulnerability.filePath),
      detectionTool: vulnerability.detectedBy,
      scanTimestamp: vulnerability.createdAt,
      algorithms: vulnerability.metadata?.algorithm ? [vulnerability.metadata.algorithm] : []
    };
  }

  private generateAdvisories(vulnerability: any): any[] {
    const advisories = [];
    
    if (vulnerability.cveId) {
      advisories.push({
        title: `${vulnerability.cveId}: ${vulnerability.title}`,
        url: `https://nvd.nist.gov/vuln/detail/${vulnerability.cveId}`
      });
    }

    // Add NIST PQC guidance
    if (vulnerability.pqcCategory === "quantum_vulnerable") {
      advisories.push({
        title: "NIST Post-Quantum Cryptography Standardization",
        url: "https://csrc.nist.gov/projects/post-quantum-cryptography"
      });
    }

    // Add algorithm-specific advisories
    if (vulnerability.metadata?.algorithm?.includes("RSA")) {
      advisories.push({
        title: "NIST SP 800-208: Recommendation for Stateful Hash-Based Signature Schemes",
        url: "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-208.pdf"
      });
    }

    return advisories;
  }

  private detectLanguage(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'py': 'Python',
      'java': 'Java',
      'js': 'JavaScript',
      'ts': 'TypeScript',
      'c': 'C',
      'cpp': 'C++',
      'cs': 'C#',
      'go': 'Go',
      'rb': 'Ruby',
      'php': 'PHP'
    };
    return languageMap[extension || ''] || 'Unknown';
  }

  private getSourceUrl(detectedBy: string): string {
    const sourceUrls: Record<string, string> = {
      "semgrep": "https://semgrep.dev/",
      "bandit": "https://bandit.readthedocs.io/",
      "pmd": "https://pmd.github.io/",
      "pqc-analyzer": "https://github.com/pqc-scanner"
    };
    return sourceUrls[detectedBy] || "https://github.com/pqc-scanner";
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

export const vdrService = new VdrService();
