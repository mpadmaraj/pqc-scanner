import { storage } from "../storage";
import { nanoid } from "nanoid";
import crypto from "crypto";

class IntegrationsService {
  generateApiKey(): string {
    return `pqc_${nanoid(32)}`;
  }

  generateIntegrationInstructions(integration: any): { instructions: string; code: string } {
    switch (integration.type) {
      case "github_actions":
        return this.getGitHubActionsInstructions(integration);
      case "jenkins":
        return this.getJenkinsInstructions(integration);
      case "sonarqube":
        return this.getSonarQubeInstructions(integration);
      case "api_key":
        return this.getApiKeyInstructions(integration);
      default:
        return { instructions: "No instructions available", code: "" };
    }
  }

  private getGitHubActionsInstructions(integration: any): { instructions: string; code: string } {
    const instructions = `
## GitHub Actions Integration Setup

1. Add your API key as a repository secret:
   - Go to your repository settings
   - Navigate to "Secrets and variables" → "Actions"
   - Add a new secret named \`PQC_SCANNER_API_KEY\` with value: \`${integration.apiKey}\`

2. Create the workflow file:
   - Create \`.github/workflows/pqc-scan.yml\` in your repository
   - Copy the workflow code below

3. Push to trigger:
   - The scan will run automatically on push to main/master branches
   - Results will be available in the Actions tab and your PQC Scanner dashboard
    `;
    
    const code = this.createGitHubAction(integration.config?.repositoryUrl || "your-repo-url", {
      apiKey: integration.apiKey,
      baseUrl: process.env.BASE_URL || "http://localhost:5000"
    });
    
    return { instructions, code };
  }

  private getJenkinsInstructions(integration: any): { instructions: string; code: string } {
    const instructions = `
## Jenkins Integration Setup

1. Install required plugins:
   - HTTP Request Plugin
   - Pipeline Utility Steps

2. Add credentials:
   - Go to "Manage Jenkins" → "Manage Credentials"
   - Add a "Secret text" credential with ID \`pqc-api-key\`
   - Set the secret value to: \`${integration.apiKey}\`

3. Create a new Pipeline job:
   - Copy the pipeline script below
   - Configure your repository URL
   - Run the pipeline
    `;
    
    const code = this.createJenkinsPlugin({
      apiKey: integration.apiKey,
      scannerUrl: process.env.BASE_URL || "http://localhost:5000",
      repositoryId: "REPOSITORY_ID_HERE"
    });
    
    return { instructions, code };
  }

  private getSonarQubeInstructions(integration: any): { instructions: string; code: string } {
    const instructions = `
## SonarQube Integration Setup

1. Configure Quality Gate:
   - Add PQC Scanner webhook in SonarQube project settings
   - Set webhook URL to receive scan notifications

2. Add scanner properties:
   - Include the scanner configuration in your \`sonar-project.properties\`
   - Configure the PQC Scanner plugin

3. API Integration:
   - Use the API key: \`${integration.apiKey}\`
   - Configure webhook notifications
    `;
    
    const code = this.createSonarQubePlugin({
      apiKey: integration.apiKey,
      projectKey: integration.config?.projectKey || "your-project-key",
      sonarUrl: integration.config?.sonarUrl || "your-sonar-url"
    });
    
    return { instructions, code };
  }

  private getApiKeyInstructions(integration: any): { instructions: string; code: string } {
    const instructions = `
## API Key Integration

1. Use your API key for authentication:
   \`${integration.apiKey}\`

2. Include in all API requests:
   \`Authorization: Bearer ${integration.apiKey}\`

3. Available endpoints:
   - POST /api/scans - Start a new scan
   - GET /api/scans/:id - Get scan status
   - GET /api/vulnerabilities - List vulnerabilities
   - POST /api/repositories - Add repository
    `;
    
    const code = `
# Example API Usage

## Start a scan
curl -X POST "${process.env.BASE_URL || "http://localhost:5000"}/api/scans" \\
  -H "Authorization: Bearer ${integration.apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "repositoryId": "your-repo-id",
    "scanConfig": {
      "tools": ["semgrep", "bandit"],
      "languages": ["python", "javascript"]
    }
  }'

## Get scan status
curl -X GET "${process.env.BASE_URL || "http://localhost:5000"}/api/scans/SCAN_ID" \\
  -H "Authorization: Bearer ${integration.apiKey}"

## Add repository via API
curl -X POST "${process.env.BASE_URL || "http://localhost:5000"}/api/repositories" \\
  -H "Authorization: Bearer ${integration.apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Repository",
    "url": "https://github.com/user/repo",
    "provider": "github",
    "description": "Added via API"
  }'
    `;
    
    return { instructions, code };
  }

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

  createGitHubAction(repositoryUrl: string, config: any): string {
    const yamlContent = `name: PQC Security Scan
on:
  push:
    branches: [main, master, develop]
  pull_request:
    branches: [main, master]

jobs:
  pqc-scan:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Add repository to PQC Scanner
      run: |
        REPO_RESPONSE=$(curl -X POST "${config.baseUrl}/api/repositories" \\
          -H "Authorization: Bearer \${{ secrets.PQC_SCANNER_API_KEY }}" \\
          -H "Content-Type: application/json" \\
          -d '{
            "name": "\${{ github.repository }}",
            "url": "https://github.com/\${{ github.repository }}",
            "provider": "github",
            "description": "Auto-added via GitHub Actions"
          }')
        echo "REPO_ID=$(echo $REPO_RESPONSE | jq -r '.id')" >> $GITHUB_ENV
    
    - name: Start PQC Vulnerability Scan
      run: |
        SCAN_RESPONSE=$(curl -X POST "${config.baseUrl}/api/scans" \\
          -H "Authorization: Bearer \${{ secrets.PQC_SCANNER_API_KEY }}" \\
          -H "Content-Type: application/json" \\
          -d '{
            "repositoryId": "'$REPO_ID'",
            "scanConfig": {
              "tools": ["semgrep", "bandit", "pmd"],
              "languages": ["python", "java", "javascript"],
              "customRules": ["pqc-crypto-patterns"]
            }
          }')
        echo "SCAN_ID=$(echo $SCAN_RESPONSE | jq -r '.id')" >> $GITHUB_ENV
        echo "Started scan with ID: $SCAN_ID"
    
    - name: Wait for scan completion
      run: |
        echo "Waiting for scan $SCAN_ID to complete..."
        while true; do
          STATUS=$(curl -s "${config.baseUrl}/api/scans/$SCAN_ID" \\
            -H "Authorization: Bearer \${{ secrets.PQC_SCANNER_API_KEY }}" | jq -r '.status')
          echo "Scan status: $STATUS"
          if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
            break
          fi
          sleep 30
        done
    
    - name: Get scan results
      run: |
        curl -s "${config.baseUrl}/api/vulnerabilities?scanId=$SCAN_ID" \\
          -H "Authorization: Bearer \${{ secrets.PQC_SCANNER_API_KEY }}" \\
          > pqc-results.json
        echo "Scan results saved to pqc-results.json"
    
    - name: Upload Results
      uses: actions/upload-artifact@v4
      with:
        name: pqc-scan-results
        path: pqc-results.json`;
    return yamlContent;
  }

  createJenkinsPlugin(config: any): string {
    const groovyScript = `pipeline {
    agent any
    
    environment {
        PQC_API_KEY = credentials('pqc-api-key')
        PQC_BASE_URL = '${config.scannerUrl}'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Add Repository') {
            steps {
                script {
                    def repoData = [
                        name: "\${env.JOB_NAME}",
                        url: "\${env.GIT_URL}",
                        provider: "git",
                        description: "Auto-added via Jenkins"
                    ]
                    
                    def repoResponse = httpRequest(
                        httpMode: 'POST',
                        url: "\${PQC_BASE_URL}/api/repositories",
                        customHeaders: [[name: 'Authorization', value: "Bearer \${PQC_API_KEY}"]],
                        contentType: 'APPLICATION_JSON',
                        requestBody: groovy.json.JsonOutput.toJson(repoData)
                    )
                    
                    def repoResult = readJSON text: repoResponse.content
                    env.REPO_ID = repoResult.id
                    echo "Repository ID: \${env.REPO_ID}"
                }
            }
        }
        
        stage('PQC Scan') {
            steps {
                script {
                    def scanData = [
                        repositoryId: "\${env.REPO_ID}",
                        scanConfig: [
                            tools: ["semgrep", "bandit", "pmd"],
                            languages: ["python", "java", "javascript"]
                        ]
                    ]
                    
                    def scanResponse = httpRequest(
                        httpMode: 'POST',
                        url: "\${PQC_BASE_URL}/api/scans",
                        customHeaders: [[name: 'Authorization', value: "Bearer \${PQC_API_KEY}"]],
                        contentType: 'APPLICATION_JSON',
                        requestBody: groovy.json.JsonOutput.toJson(scanData)
                    )
                    
                    def scanResult = readJSON text: scanResponse.content
                    env.SCAN_ID = scanResult.id
                    echo "Started scan with ID: \${env.SCAN_ID}"
                    
                    // Wait for scan completion
                    timeout(time: 30, unit: 'MINUTES') {
                        waitUntil {
                            script {
                                def statusResponse = httpRequest(
                                    url: "\${PQC_BASE_URL}/api/scans/\${env.SCAN_ID}",
                                    customHeaders: [[name: 'Authorization', value: "Bearer \${PQC_API_KEY}"]]
                                )
                                def statusResult = readJSON text: statusResponse.content
                                def status = statusResult.status
                                echo "Scan status: \${status}"
                                return status == 'completed' || status == 'failed'
                            }
                        }
                    }
                }
            }
        }
        
        stage('Get Results') {
            steps {
                script {
                    def resultsResponse = httpRequest(
                        url: "\${PQC_BASE_URL}/api/vulnerabilities?scanId=\${env.SCAN_ID}",
                        customHeaders: [[name: 'Authorization', value: "Bearer \${PQC_API_KEY}"]]
                    )
                    
                    writeFile file: 'pqc-results.json', text: resultsResponse.content
                    archiveArtifacts artifacts: 'pqc-results.json', fingerprint: true
                    echo "PQC scan results archived"
                }
            }
        }
    }
    
    post {
        always {
            echo "PQC scan pipeline completed"
        }
        success {
            echo "PQC scan completed successfully"
        }
        failure {
            echo "PQC scan failed"
        }
    }
}`;
    return groovyScript;
  }

  createSonarQubePlugin(config: any): string {
    const properties = `# SonarQube PQC Integration Properties

# Project identification
sonar.projectKey=${config.projectKey}
sonar.projectName=PQC Security Scan
sonar.projectVersion=1.0

# Source code
sonar.sources=.
sonar.exclusions=**/*test**,**/*Test**,**/node_modules/**,**/vendor/**

# PQC Scanner Integration
pqc.scanner.enabled=true
pqc.scanner.apiKey=${config.apiKey}
pqc.scanner.baseUrl=${process.env.BASE_URL || "http://localhost:5000"}
pqc.scanner.webhook=${config.sonarUrl}/api/webhooks/pqc

# Quality Gate Integration
sonar.qualitygate.wait=true
sonar.qualitygate.timeout=300

# External Issues (PQC vulnerabilities)
sonar.externalIssuesReportPaths=pqc-issues.json`;
    
    return properties;
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

  async authenticateApiKey(apiKey: string): Promise<any> {
    try {
      const integrations = await storage.getIntegrations();
      const integration = integrations.find(i => i.apiKey === apiKey && i.isActive);
      return integration || null;
    } catch (error) {
      console.error('API key authentication failed:', error);
      return null;
    }
  }
}

export const integrationsService = new IntegrationsService();