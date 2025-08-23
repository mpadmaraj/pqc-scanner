import puppeteer from 'puppeteer';
import handlebars from 'handlebars';
import { promises as fs } from 'fs';
import path from 'path';
import { CbomReport } from '@shared/schema';

export class PDFGeneratorService {
  private templatePath: string;

  constructor() {
    this.templatePath = path.join(process.cwd(), 'server', 'templates', 'cbom-report.hbs');
  }

  async generateCBOMPDF(cbomReport: CbomReport, repositoryName: string): Promise<string> {
    try {
      // Register handlebars helpers
      handlebars.registerHelper('eq', function(a: any, b: any) {
        return a === b;
      });

      // Create PDF directory if it doesn't exist
      const pdfDir = path.join(process.cwd(), 'reports', 'pdfs');
      await fs.mkdir(pdfDir, { recursive: true });

      const pdfPath = path.join(pdfDir, `cbom-report-${cbomReport.scanId}-${Date.now()}.pdf`);

      // Parse CBOM content
      const content = cbomReport.content as any;
      const components = content.components || [];
      const cryptoAssets = cbomReport.cryptoAssets || [];
      
      // Calculate summary statistics from components
      const totalAssets = components.length;
      const quantumSafeAssets = components.filter((asset: any) => asset.quantumSafe === true).length;
      const quantumVulnerableAssets = components.filter((asset: any) => asset.quantumSafe === false).length;
      const unknownAssets = totalAssets - quantumSafeAssets - quantumVulnerableAssets;
      
      // Calculate compliance score
      const complianceScore = totalAssets > 0 ? Math.round((quantumSafeAssets / totalAssets) * 100) : 0;
      const complianceStatus = complianceScore >= 80 ? 'compliant' : complianceScore >= 50 ? 'warning' : 'non-compliant';
      
      // Prepare template data
      const templateData = {
        repository: {
          name: repositoryName,
          url: content.metadata?.properties?.find((p: any) => p.name === 'gitUrl')?.value || '',
          provider: 'Git'
        },
        scanId: cbomReport.scanId,
        timestamp: new Date(cbomReport.createdAt).toLocaleDateString(),
        summary: {
          totalAssets,
          quantumSafe: quantumSafeAssets,
          quantumVulnerable: quantumVulnerableAssets,
          unknown: unknownAssets,
          complianceScore,
          complianceStatus
        },
        compliance: {
          status: complianceStatus,
          score: complianceScore,
          details: `${quantumSafeAssets} out of ${totalAssets} cryptographic assets are quantum-safe`,
          recommendations: [
            'Replace quantum-vulnerable algorithms with post-quantum alternatives',
            'Update cryptographic libraries to quantum-resistant versions',
            'Implement key rotation policies for quantum-safe algorithms'
          ]
        },
        assets: components.map((asset: any) => {
          const isQuantumSafe = asset.quantumSafe === true;
          return {
            name: asset.name || 'Unknown',
            type: asset.type || 'cryptographic-asset',
            primitive: asset.cryptoProperties?.algorithmProperties?.primitive || 'Unknown',
            location: asset.evidence?.occurrences?.[0]?.location || 'Unknown',
            quantumSafe: isQuantumSafe ? 'Yes' : 'No',
            quantumSafeClass: isQuantumSafe ? 'quantum-safe' : 'quantum-vulnerable',
            severity: asset.riskLevel || 'Unknown',
            recommendation: asset.properties?.find((p: any) => p.name === 'quantum.safe.alternative')?.value || 'Review algorithm usage'
          };
        }),
        chartData: this.generateChartData(components, { totalAssets, quantumSafe: quantumSafeAssets, quantumVulnerable: quantumVulnerableAssets, unknown: unknownAssets })
      };

      // Load and compile template
      const template = await this.loadTemplate();
      const compiledTemplate = handlebars.compile(template);
      const html = compiledTemplate(templateData);

      // Generate PDF using Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      });

      await browser.close();

      return pdfPath;
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Failed to generate PDF report');
    }
  }

  private async loadTemplate(): Promise<string> {
    try {
      return await fs.readFile(this.templatePath, 'utf8');
    } catch (error) {
      // Fallback to default template if file doesn't exist
      return this.getDefaultTemplate();
    }
  }

  private generateChartData(assets: any[], summary: any) {
    const primitiveStats = assets.reduce((acc: any, asset: any) => {
      const primitive = asset.primitive || 'Unknown';
      acc[primitive] = (acc[primitive] || 0) + 1;
      return acc;
    }, {});

    const severityStats = assets.reduce((acc: any, asset: any) => {
      const severity = asset.severity || 'Unknown';
      acc[severity] = (acc[severity] || 0) + 1;
      return acc;
    }, {});

    return {
      quantumSafety: {
        safe: summary.quantumSafe || 0,
        vulnerable: summary.quantumVulnerable || 0,
        unknown: summary.unknown || 0
      },
      primitives: primitiveStats,
      severities: severityStats
    };
  }

  private getDefaultTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CBOM Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #ffffff;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            font-weight: 300;
        }
        
        .header h2 {
            font-size: 1.4em;
            opacity: 0.9;
            font-weight: 400;
        }
        
        .meta-info {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            border-left: 5px solid #667eea;
        }
        
        .meta-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        
        .meta-item {
            display: flex;
            flex-direction: column;
        }
        
        .meta-label {
            font-size: 0.9em;
            color: #666;
            margin-bottom: 5px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .meta-value {
            font-size: 1.1em;
            font-weight: 600;
            color: #333;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .summary-card {
            background: white;
            border: 2px solid #e9ecef;
            border-radius: 12px;
            padding: 25px;
            text-align: center;
            transition: all 0.3s ease;
        }
        
        .summary-card.safe {
            border-color: #28a745;
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
        }
        
        .summary-card.vulnerable {
            border-color: #dc3545;
            background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%);
            color: white;
        }
        
        .summary-card.warning {
            border-color: #ffc107;
            background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%);
            color: white;
        }
        
        .summary-number {
            font-size: 3em;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .summary-label {
            font-size: 1.1em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .compliance-section {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 30px;
        }
        
        .compliance-header {
            text-align: center;
            margin-bottom: 25px;
        }
        
        .compliance-score {
            font-size: 4em;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .compliance-score.compliant { color: #28a745; }
        .compliance-score.warning { color: #ffc107; }
        .compliance-score.non-compliant { color: #dc3545; }
        
        .compliance-status {
            font-size: 1.5em;
            color: #666;
            text-transform: capitalize;
            margin-bottom: 15px;
        }
        
        .section-title {
            font-size: 1.8em;
            color: #333;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 3px solid #667eea;
            display: flex;
            align-items: center;
        }
        
        .assets-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .assets-table th {
            background: #667eea;
            color: white;
            padding: 15px 10px;
            text-align: left;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.9em;
            letter-spacing: 0.5px;
        }
        
        .assets-table td {
            padding: 12px 10px;
            border-bottom: 1px solid #eee;
            vertical-align: top;
        }
        
        .assets-table tr:nth-child(even) {
            background: #f8f9fa;
        }
        
        .assets-table tr:hover {
            background: #e3f2fd;
        }
        
        .quantum-safe {
            color: #28a745;
            font-weight: bold;
        }
        
        .quantum-vulnerable {
            color: #dc3545;
            font-weight: bold;
        }
        
        .severity-critical { color: #dc3545; font-weight: bold; }
        .severity-high { color: #fd7e14; font-weight: bold; }
        .severity-medium { color: #ffc107; font-weight: bold; }
        .severity-low { color: #28a745; font-weight: bold; }
        
        .recommendations {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
        }
        
        .recommendations h3 {
            color: #856404;
            margin-bottom: 15px;
        }
        
        .recommendations ul {
            list-style-type: none;
            padding: 0;
        }
        
        .recommendations li {
            padding: 8px 0;
            padding-left: 20px;
            position: relative;
        }
        
        .recommendations li:before {
            content: "→";
            position: absolute;
            left: 0;
            color: #856404;
            font-weight: bold;
        }
        
        .footer {
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            color: #666;
            font-size: 0.9em;
        }
        
        @page {
            margin: 20mm 15mm;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔒 CBOM Security Report</h1>
        <h2>{{repository.name}}</h2>
    </div>
    
    <div class="meta-info">
        <div class="meta-grid">
            <div class="meta-item">
                <div class="meta-label">Repository</div>
                <div class="meta-value">{{repository.name}}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Provider</div>
                <div class="meta-value">{{repository.provider}}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Scan Date</div>
                <div class="meta-value">{{timestamp}}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Scan ID</div>
                <div class="meta-value">{{scanId}}</div>
            </div>
        </div>
    </div>
    
    <div class="summary-grid">
        <div class="summary-card safe">
            <div class="summary-number">{{summary.quantumSafe}}</div>
            <div class="summary-label">Quantum Safe</div>
        </div>
        <div class="summary-card vulnerable">
            <div class="summary-number">{{summary.quantumVulnerable}}</div>
            <div class="summary-label">Quantum Vulnerable</div>
        </div>
        <div class="summary-card warning">
            <div class="summary-number">{{summary.unknown}}</div>
            <div class="summary-label">Unknown Status</div>
        </div>
        <div class="summary-card">
            <div class="summary-number">{{summary.totalAssets}}</div>
            <div class="summary-label">Total Assets</div>
        </div>
    </div>
    
    <div class="compliance-section">
        <div class="compliance-header">
            <div class="compliance-score {{compliance.status}}">{{compliance.score}}%</div>
            <div class="compliance-status">{{compliance.status}}</div>
            <p>{{compliance.details}}</p>
        </div>
    </div>
    
    <h2 class="section-title">📋 Cryptographic Assets</h2>
    
    {{#if assets}}
    <table class="assets-table">
        <thead>
            <tr>
                <th>Asset Name</th>
                <th>Type</th>
                <th>Primitive</th>
                <th>Location</th>
                <th>Quantum Safe</th>
                <th>Severity</th>
            </tr>
        </thead>
        <tbody>
            {{#each assets}}
            <tr>
                <td><strong>{{this.name}}</strong></td>
                <td>{{this.type}}</td>
                <td>{{this.primitive}}</td>
                <td><code>{{this.location}}</code></td>
                <td><span class="{{#if this.quantumSafeClass}}{{this.quantumSafeClass}}{{/if}}">{{this.quantumSafe}}</span></td>
                <td><span class="severity-{{this.severity}}">{{this.severity}}</span></td>
            </tr>
            {{/each}}
        </tbody>
    </table>
    {{else}}
    <p style="text-align: center; color: #666; padding: 40px;">No cryptographic assets detected in this scan.</p>
    {{/if}}
    
    {{#if compliance.recommendations}}
    <div class="recommendations">
        <h3>📝 Security Recommendations</h3>
        <ul>
            {{#each compliance.recommendations}}
            <li>{{this}}</li>
            {{/each}}
        </ul>
    </div>
    {{/if}}
    
    <div class="footer">
        <p>Generated by Q-Scan PQC Vulnerability Scanner • {{timestamp}}</p>
        <p>This report identifies post-quantum cryptography vulnerabilities and compliance status.</p>
    </div>
</body>
</html>
    `;
  }
}

export const pdfGenerator = new PDFGeneratorService();