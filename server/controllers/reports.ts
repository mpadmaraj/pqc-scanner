/**
 * Report Controllers
 * 
 * Handles CBOM and VDR report generation and downloads
 * Provides both JSON and PDF formats for reports
 */
import { Request, Response } from 'express';
import { storage } from '../storage';
import { cbomService } from '../services/cbom';
import { vdrService } from '../services/vdr';
import { pdfGenerator } from '../services/pdf-generator';
import { createAppError } from '../middleware/error-handler';
import path from 'path';
import { promises as fs } from 'fs';

/**
 * Get all CBOM reports
 * GET /api/cbom-reports
 */
export async function getCBOMReports(req: Request, res: Response) {
  const reports = await storage.getCBOMReports();
  res.json(reports);
}

/**
 * Get CBOM report by scan ID
 * GET /api/cbom-reports/:scanId
 */
export async function getCBOMReport(req: Request, res: Response) {
  const { scanId } = req.params;
  
  const report = await storage.getCBOMReportByScanId(scanId);
  if (!report) {
    throw createAppError('CBOM report not found', 404);
  }
  
  res.json(report);
}

/**
 * Download CBOM report as JSON
 * GET /api/cbom-reports/:scanId/json
 */
export async function downloadCBOMReportJSON(req: Request, res: Response) {
  const { scanId } = req.params;
  
  const report = await storage.getCBOMReportByScanId(scanId);
  if (!report) {
    throw createAppError('CBOM report not found', 404);
  }
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="cbom-report-${scanId}.json"`);
  res.json(report.content);
}

/**
 * Download CBOM report as PDF
 * GET /api/cbom-reports/:scanId/pdf
 */
export async function downloadCBOMReportPDF(req: Request, res: Response) {
  const { scanId } = req.params;
  
  const report = await storage.getCBOMReportByScanId(scanId);
  if (!report) {
    throw createAppError('CBOM report not found', 404);
  }
  
  try {
    // Check if PDF already exists
    if (report.pdfPath && await fs.access(report.pdfPath).then(() => true).catch(() => false)) {
      const pdfBuffer = await fs.readFile(report.pdfPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="cbom-report-${scanId}.pdf"`);
      return res.send(pdfBuffer);
    }
    
    // Generate new PDF
    const repository = await storage.getRepository(report.repositoryId);
    const scan = await storage.getScanByScanId(scanId);
    
    const pdfBuffer = await pdfGenerator.generateCBOMReportPDF({
      repository: repository || { name: 'Unknown Repository' },
      scan: scan || { id: scanId },
      reportData: report.content,
      timestamp: report.createdAt
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="cbom-report-${scanId}.pdf"`);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw createAppError('Failed to generate PDF report', 500);
  }
}

/**
 * Generate CBOM report for a scan
 * POST /api/cbom-reports
 */
export async function generateCBOMReport(req: Request, res: Response) {
  const { scanId } = req.body;
  
  if (!scanId) {
    throw createAppError('Scan ID is required', 400);
  }
  
  const scan = await storage.getScan(scanId);
  if (!scan) {
    throw createAppError('Scan not found', 404);
  }
  
  // Generate the CBOM report
  const report = await cbomService.generateCBOMReport(scanId);
  
  res.status(201).json(report);
}

/**
 * Get all VDR reports
 * GET /api/vdr-reports
 */
export async function getVDRReports(req: Request, res: Response) {
  const reports = await storage.getVDRReports();
  res.json(reports);
}

/**
 * Download VDR report as JSON
 * GET /api/vdr-reports/:vulnerabilityId/json
 */
export async function downloadVDRReportJSON(req: Request, res: Response) {
  const { vulnerabilityId } = req.params;
  
  const report = await storage.getVDRReportByVulnerabilityId(vulnerabilityId);
  if (!report) {
    throw createAppError('VDR report not found', 404);
  }
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="vdr-report-${vulnerabilityId}.json"`);
  res.json(report.content);
}

/**
 * Generate VDR report for a vulnerability
 * POST /api/vdr-reports
 */
export async function generateVDRReport(req: Request, res: Response) {
  const { vulnerabilityId } = req.body;
  
  if (!vulnerabilityId) {
    throw createAppError('Vulnerability ID is required', 400);
  }
  
  const vulnerability = await storage.getVulnerability(vulnerabilityId);
  if (!vulnerability) {
    throw createAppError('Vulnerability not found', 404);
  }
  
  // Generate the VDR report
  const report = await vdrService.generateVDRReport(vulnerabilityId);
  
  res.status(201).json(report);
}