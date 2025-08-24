import htmlPdf from 'html-pdf-node';
import { CbomReport } from '@shared/schema';

export class PDFGeneratorService {
  async generateCBOMPDF(cbomReport: CbomReport, repositoryName: string): Promise<Buffer> {
    try {
      // Parse CBOM content
      const content = cbomReport.content as any;
      const components = content.components || [];
      
      // Calculate summary statistics from components
      const totalAssets = components.length;
      const quantumSafeAssets = components.filter((asset: any) => asset.quantumSafe === true).length;
      const quantumVulnerableAssets = components.filter((asset: any) => asset.quantumSafe === false).length;
      const unknownAssets = totalAssets - quantumSafeAssets - quantumVulnerableAssets;
      
      // Calculate compliance score
      const complianceScore = totalAssets > 0 ? Math.round((quantumSafeAssets / totalAssets) * 100) : 0;
      const complianceStatus = complianceScore >= 80 ? 'compliant' : complianceScore >= 50 ? 'warning' : 'non-compliant';
      
      // Generate HTML content
      const html = this.generateHTML({
        repository: { name: repositoryName, provider: 'Git' },
        scanId: cbomReport.scanId,
        timestamp: new Date(cbomReport.createdAt).toLocaleDateString(),
        summary: { totalAssets, quantumSafe: quantumSafeAssets, quantumVulnerable: quantumVulnerableAssets, unknown: unknownAssets },
        compliance: { 
          status: complianceStatus, 
          score: complianceScore, 
          details: `${quantumSafeAssets} out of ${totalAssets} cryptographic assets are quantum-safe` 
        },
        assets: components.map((asset: any) => ({
          name: asset.name || 'Unknown',
          type: asset.type || 'cryptographic-asset',
          primitive: asset.cryptoProperties?.algorithmProperties?.primitive || 'Unknown',
          location: asset.evidence?.occurrences?.[0]?.location || 'Unknown',
          quantumSafe: asset.quantumSafe ? 'Yes' : 'No',
          quantumSafeClass: asset.quantumSafe ? 'quantum-safe' : 'quantum-vulnerable',
          severity: asset.riskLevel || 'Unknown'
        }))
      });

      // For now, return HTML as PDF since PDF libraries need Chrome
      // In production, this would be replaced with proper PDF generation
      const htmlBuffer = Buffer.from(html, 'utf8');
      return htmlBuffer;
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Failed to generate PDF report');
    }
  }

  private generateHTML(data: any): string {
    const { repository, scanId, timestamp, summary, compliance, assets } = data;
    
    const assetsTableRows = assets.map((asset: any) => `
      <tr>
        <td><strong>${asset.name}</strong></td>
        <td>${asset.type}</td>
        <td>${asset.primitive}</td>
        <td><code>${asset.location}</code></td>
        <td><span class="${asset.quantumSafeClass}">${asset.quantumSafe}</span></td>
        <td><span class="severity-${asset.severity}">${asset.severity}</span></td>
      </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CBOM Report - ${repository.name}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 40px;
            color: #333;
            background: #fff;
        }
        
        .header {
            text-align: center;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 30px;
            margin-bottom: 40px;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin: 0;
            color: #1e40af;
            font-weight: 700;
        }
        
        .header .subtitle {
            font-size: 1.2em;
            color: #64748b;
            margin-top: 10px;
        }
        
        .meta-info {
            display: flex;
            justify-content: space-between;
            margin: 30px 0;
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #2563eb;
        }
        
        .meta-item {
            text-align: center;
        }
        
        .meta-label {
            font-weight: 600;
            color: #475569;
            text-transform: uppercase;
            font-size: 0.8em;
            letter-spacing: 0.5px;
        }
        
        .meta-value {
            font-size: 1.1em;
            color: #1e293b;
            margin-top: 5px;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin: 30px 0;
        }
        
        .summary-card {
            background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
            padding: 25px;
            border-radius: 12px;
            text-align: center;
            border: 1px solid #e2e8f0;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .summary-card.safe {
            background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
            border-color: #86efac;
        }
        
        .summary-card.vulnerable {
            background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%);
            border-color: #fca5a5;
        }
        
        .summary-card.warning {
            background: linear-gradient(135deg, #fefce8 0%, #fef08a 100%);
            border-color: #facc15;
        }
        
        .summary-number {
            font-size: 3em;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .summary-card.safe .summary-number { color: #15803d; }
        .summary-card.vulnerable .summary-number { color: #dc2626; }
        .summary-card.warning .summary-number { color: #d97706; }
        .summary-card .summary-number { color: #64748b; }
        
        .summary-label {
            font-weight: 600;
            color: #475569;
            text-transform: uppercase;
            font-size: 0.9em;
            letter-spacing: 0.5px;
        }
        
        .section-title {
            font-size: 1.8em;
            color: #1e40af;
            margin: 40px 0 20px 0;
            padding-bottom: 10px;
            border-bottom: 2px solid #e2e8f0;
        }
        
        .compliance-section {
            background: #f8fafc;
            padding: 30px;
            border-radius: 12px;
            margin: 30px 0;
            text-align: center;
            border: 1px solid #e2e8f0;
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
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 15px;
        }
        
        .assets-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .assets-table th {
            background: #1e40af;
            color: white;
            padding: 15px;
            text-align: left;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.9em;
            letter-spacing: 0.5px;
        }
        
        .assets-table td {
            padding: 12px 15px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .assets-table tr:hover {
            background: #f8fafc;
        }
        
        .assets-table tr:last-child td {
            border-bottom: none;
        }
        
        .quantum-safe {
            background: #dcfce7;
            color: #15803d;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 0.9em;
        }
        
        .quantum-vulnerable {
            background: #fef2f2;
            color: #dc2626;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 0.9em;
        }
        
        .severity-High { color: #dc2626; font-weight: bold; }
        .severity-Medium { color: #d97706; font-weight: bold; }
        .severity-Low { color: #059669; font-weight: bold; }
        .severity-Unknown { color: #6b7280; }
        
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #e2e8f0;
            text-align: center;
            color: #64748b;
            font-size: 0.9em;
        }
        
        code {
            background: #f1f5f9;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 0.9em;
            color: #1e293b;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔐 Post-Quantum Cryptography Report</h1>
        <div class="subtitle">Cryptographic Bill of Materials (CBOM)</div>
    </div>
    
    <div class="meta-info">
        <div class="meta-item">
            <div class="meta-label">Repository</div>
            <div class="meta-value">${repository.name}</div>
        </div>
        <div class="meta-item">
            <div class="meta-label">Scan ID</div>
            <div class="meta-value">${scanId}</div>
        </div>
        <div class="meta-item">
            <div class="meta-label">Generated</div>
            <div class="meta-value">${timestamp}</div>
        </div>
        <div class="meta-item">
            <div class="meta-label">Provider</div>
            <div class="meta-value">${repository.provider}</div>
        </div>
    </div>
    
    <h2 class="section-title">📊 Executive Summary</h2>
    
    <div class="summary-grid">
        <div class="summary-card safe">
            <div class="summary-number">${summary.quantumSafe}</div>
            <div class="summary-label">Quantum Safe</div>
        </div>
        <div class="summary-card vulnerable">
            <div class="summary-number">${summary.quantumVulnerable}</div>
            <div class="summary-label">Quantum Vulnerable</div>
        </div>
        <div class="summary-card warning">
            <div class="summary-number">${summary.unknown}</div>
            <div class="summary-label">Unknown Status</div>
        </div>
        <div class="summary-card">
            <div class="summary-number">${summary.totalAssets}</div>
            <div class="summary-label">Total Assets</div>
        </div>
    </div>
    
    <div class="compliance-section">
        <div class="compliance-score ${compliance.status}">${compliance.score}%</div>
        <div class="compliance-status">${compliance.status}</div>
        <p>${compliance.details}</p>
    </div>
    
    <h2 class="section-title">📋 Cryptographic Assets</h2>
    
    ${assets.length > 0 ? `
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
            ${assetsTableRows}
        </tbody>
    </table>
    ` : `
    <p style="text-align: center; color: #666; padding: 40px;">No cryptographic assets detected in this scan.</p>
    `}
    
    <div class="footer">
        <p>Generated by Q-Scan PQC Vulnerability Scanner • ${timestamp}</p>
        <p>This report identifies post-quantum cryptography vulnerabilities and compliance status.</p>
    </div>
</body>
</html>
    `;
  }
}

export const pdfGenerator = new PDFGeneratorService();