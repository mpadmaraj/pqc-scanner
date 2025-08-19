import { storage } from "../storage";

class IntegrationsService {
  async testGitHubConnection(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch("https://api.github.com/user", {
        headers: {
          "Authorization": `token ${apiKey}`,
          "User-Agent": "PQC-Scanner"
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async testJenkinsConnection(config: any): Promise<boolean> {
    try {
      const { url, username, apiToken } = config;
      const response = await fetch(`${url}/api/json`, {
        headers: {
          "Authorization": `Basic ${Buffer.from(`${username}:${apiToken}`).toString('base64')}`
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async testSonarQubeConnection(config: any): Promise<boolean> {
    try {
      const { url, token } = config;
      const response = await fetch(`${url}/api/authentication/validate`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async createGitHubAction(repositoryUrl: string, config: any): Promise<string> {
    const yamlContent = `
name: PQC Security Scan
on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  pqc-scan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: PQC Vulnerability Scan
      uses: pqc-scanner/action@v1
      with:
        api-key: \${{ secrets.PQC_SCANNER_API_KEY }}
        repository-url: ${repositoryUrl}
        scan-config: |
          tools:
            - semgrep
            - bandit
            - pmd
          languages:
            - python
            - java
            - javascript
          custom-rules:
            - pqc-crypto-patterns
    
    - name: Upload Results
      uses: actions/upload-artifact@v3
      with:
        name: pqc-scan-results
        path: pqc-results.json
`;
    return yamlContent;
  }

  async createJenkinsPlugin(config: any): Promise<string> {
    const groovyScript = `
pipeline {
    agent any
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('PQC Scan') {
            steps {
                script {
                    def scanResult = sh(
                        script: """
                            curl -X POST "${config.scannerUrl}/api/scans" \\
                            -H "Authorization: Bearer ${config.apiKey}" \\
                            -H "Content-Type: application/json" \\
                            -d '{
                                "repositoryId": "${config.repositoryId}",
                                "scanConfig": {
                                    "tools": ["semgrep", "bandit", "pmd"],
                                    "languages": ["python", "java", "javascript"]
                                }
                            }'
                        """,
                        returnStdout: true
                    ).trim()
                    
                    def scanId = readJSON(text: scanResult).id
                    
                    // Wait for scan completion
                    timeout(time: 30, unit: 'MINUTES') {
                        waitUntil {
                            script {
                                def status = sh(
                                    script: "curl -s '${config.scannerUrl}/api/scans/${scanId}/progress'",
                                    returnStdout: true
                                ).trim()
                                def statusJson = readJSON(text: status)
                                return statusJson.status == 'completed'
                            }
                        }
                    }
                    
                    // Download results
                    sh "curl -o pqc-results.json '${config.scannerUrl}/api/scans/${scanId}'"
                }
            }
        }
        
        stage('Publish Results') {
            steps {
                publishHTML([
                    allowMissing: false,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: '.',
                    reportFiles: 'pqc-results.json',
                    reportName: 'PQC Scan Report'
                ])
            }
        }
    }
    
    post {
        always {
            archiveArtifacts artifacts: 'pqc-results.json', fingerprint: true
        }
    }
}
`;
    return groovyScript;
  }

  async createSonarQubePlugin(config: any): Promise<string> {
    const pluginConfig = `
# SonarQube PQC Scanner Plugin Configuration
sonar.projectKey=${config.projectKey}
sonar.projectName=${config.projectName}
sonar.projectVersion=1.0

# PQC Scanner Integration
sonar.pqc.enabled=true
sonar.pqc.scanner.url=${config.scannerUrl}
sonar.pqc.api.key=${config.apiKey}

# Quality Gate Configuration
sonar.pqc.qualityGate.criticalVulnerabilities=0
sonar.pqc.qualityGate.quantumVulnerable=5
sonar.pqc.qualityGate.nistCompliance=80

# Report Configuration
sonar.pqc.reports.cbom=true
sonar.pqc.reports.vdr=true
sonar.pqc.reports.format=json,html,pdf
`;
    return pluginConfig;
  }

  async notifyWebhook(webhookUrl: string, scanResult: any): Promise<void> {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'scan_completed',
          repository: scanResult.repository,
          scanId: scanResult.scanId,
          vulnerabilities: scanResult.vulnerabilityCount,
          severity: scanResult.highestSeverity,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Webhook notification failed:', error);
    }
  }
}

export const integrationsService = new IntegrationsService();
