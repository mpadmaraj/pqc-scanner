import { 
  repositories, scans, vulnerabilities, cbomReports, vdrReports, integrations, users, providerTokens,
  type Repository, type InsertRepository,
  type Scan, type InsertScan,
  type Vulnerability, type InsertVulnerability,
  type CbomReport, type InsertCbomReport,
  type VdrReport, type InsertVdrReport,
  type Integration, type InsertIntegration,
  type User, type InsertUser,
  type ProviderToken, type InsertProviderToken
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Repository operations
  getRepositories(): Promise<Repository[]>;
  getRepository(id: string): Promise<Repository | undefined>;
  createRepository(repository: InsertRepository): Promise<Repository>;
  updateRepository(id: string, updates: Partial<Repository>): Promise<Repository>;
  deleteRepository(id: string): Promise<void>;

  // Scan operations
  getScans(repositoryId?: string): Promise<Scan[]>;
  getScan(id: string): Promise<Scan | undefined>;
  createScan(scan: InsertScan): Promise<Scan>;
  updateScanStatus(id: string, status: string, progress: number, errorMessage?: string): Promise<Scan>;

  // Vulnerability operations
  getVulnerabilities(filters?: {
    repositoryId?: string;
    scanId?: string;
    severity?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Vulnerability[]>;
  getVulnerabilitiesByScan(scanId: string): Promise<Vulnerability[]>;
  getVulnerability(id: string): Promise<Vulnerability | undefined>;
  createVulnerability(vulnerability: InsertVulnerability): Promise<Vulnerability>;
  updateVulnerabilityStatus(id: string, status: string, workaround?: string): Promise<Vulnerability>;

  // CBOM operations
  getCbomReport(repositoryId: string): Promise<CbomReport | undefined>;
  createCbomReport(cbom: InsertCbomReport): Promise<CbomReport>;
  getCbomReportByScanId(scanId: string): Promise<CbomReport | undefined>;
  getCBOMReports(filters?: { repositoryId?: string }): Promise<CbomReport[]>;
  createCBOMReport(cbomReport: InsertCbomReport): Promise<CbomReport>;
  updateCbomReport(id: string, updates: Partial<CbomReport>): Promise<CbomReport>;

  // VDR operations
  getVdrReport(vulnerabilityId: string): Promise<VdrReport | undefined>;
  createVdrReport(vdr: InsertVdrReport): Promise<VdrReport>;

  // Integration operations
  getIntegrations(): Promise<Integration[]>;
  getIntegration(id: string): Promise<Integration | undefined>;
  createIntegration(integration: InsertIntegration & { apiKey: string }): Promise<Integration>;
  updateIntegration(id: string, updates: Partial<Integration>): Promise<Integration>;

  // Provider token operations
  getProviderTokens(userId: string): Promise<ProviderToken[]>;
  getProviderToken(id: string): Promise<ProviderToken | undefined>;
  getProviderTokenByProvider(userId: string, provider: string): Promise<ProviderToken | undefined>;
  createProviderToken(token: InsertProviderToken): Promise<ProviderToken>;
  updateProviderToken(id: string, updates: Partial<ProviderToken>): Promise<ProviderToken>;
  deleteProviderToken(id: string): Promise<void>;

  // Dashboard stats
  getDashboardStats(): Promise<{
    criticalVulnerabilities: number;
    quantumVulnerable: number;
    pqcCompliant: number;
    activeScans: number;
  }>;

  // Enhanced dashboard analytics
  getRepositoryLanguageStats(): Promise<Array<{language: string; count: number}>>;
  getCryptoAssetStats(): Promise<Array<{assetType: string; count: number}>>;
  getCryptoLibrariesStats(): Promise<Array<{library: string; count: number}>>;
  getVulnerabilityTrends(): Promise<Array<{date: string; count: number; severity: string}>>;
  getDetailedStats(): Promise<{
    totalRepositories: number;
    totalScanned: number;
    totalVulnerabilities: number;
    lastScanDate: string | null;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Note: This is a placeholder - user functionality not fully implemented in schema
    return undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Note: This is a placeholder - user functionality not fully implemented in schema  
    throw new Error("User creation not implemented");
  }

  // Repository operations
  async getRepositories(): Promise<Repository[]> {
    return await db.select().from(repositories).orderBy(desc(repositories.createdAt));
  }

  async getRepository(id: string): Promise<Repository | undefined> {
    const [repository] = await db.select().from(repositories).where(eq(repositories.id, id));
    return repository || undefined;
  }

  async createRepository(repository: InsertRepository): Promise<Repository> {
    const safeRepository: any = {
      ...repository,
      languages: Array.isArray(repository.languages) ? repository.languages : [],
      branches: Array.isArray(repository.branches) ? repository.branches : ["main"]
    };
    
    const [created] = await db
      .insert(repositories)
      .values([safeRepository])
      .returning();
    return created;
  }

  async updateRepository(id: string, updates: Partial<Repository>): Promise<Repository> {
    const [updated] = await db
      .update(repositories)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(repositories.id, id))
      .returning();
    return updated;
  }

  async deleteRepository(id: string): Promise<void> {
    // Delete related records first to avoid foreign key constraint errors
    
    // First, get all vulnerabilities for this repository
    const repositoryVulns = await db
      .select({ id: vulnerabilities.id })
      .from(vulnerabilities)
      .where(eq(vulnerabilities.repositoryId, id));
    
    // Delete VDR reports for these vulnerabilities
    if (repositoryVulns.length > 0) {
      const vulnIds = repositoryVulns.map(v => v.id);
      for (const vulnId of vulnIds) {
        await db.delete(vdrReports).where(eq(vdrReports.vulnerabilityId, vulnId));
      }
    }
    
    // Delete CBOM reports
    await db.delete(cbomReports).where(eq(cbomReports.repositoryId, id));
    
    // Delete vulnerabilities
    await db.delete(vulnerabilities).where(eq(vulnerabilities.repositoryId, id));
    
    // Delete scans
    await db.delete(scans).where(eq(scans.repositoryId, id));
    
    // Finally delete the repository
    await db.delete(repositories).where(eq(repositories.id, id));
  }

  // Scan operations
  async getScans(repositoryId?: string): Promise<Scan[]> {
    if (repositoryId) {
      return await db
        .select()
        .from(scans)
        .where(eq(scans.repositoryId, repositoryId))
        .orderBy(desc(scans.createdAt));
    }
    
    return await db
      .select()
      .from(scans)
      .orderBy(desc(scans.createdAt));
  }

  async getScan(id: string): Promise<Scan | undefined> {
    const [scan] = await db.select().from(scans).where(eq(scans.id, id));
    return scan || undefined;
  }

  async createScan(scan: InsertScan): Promise<Scan> {
    const safeScan: any = {
      ...scan,
      scanConfig: scan.scanConfig ? {
        tools: Array.isArray(scan.scanConfig.tools) ? scan.scanConfig.tools : [],
        languages: Array.isArray(scan.scanConfig.languages) ? scan.scanConfig.languages : [],
        customRules: Array.isArray(scan.scanConfig.customRules) ? scan.scanConfig.customRules : undefined
      } : undefined
    };
    
    const [created] = await db
      .insert(scans)
      .values([safeScan])
      .returning();
    return created;
  }

  async updateScanStatus(id: string, status: string, progress: number, errorMessage?: string): Promise<Scan> {
    const updateData: any = {
      status: status as any,
      progress,
      errorMessage,
    };

    if (status === "completed") {
      updateData.completedAt = new Date();
    }

    const [updated] = await db
      .update(scans)
      .set(updateData)
      .where(eq(scans.id, id))
      .returning();
    return updated;
  }

  // Vulnerability operations
  async getVulnerabilities(filters: {
    repositoryId?: string;
    scanId?: string;
    severity?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<Vulnerability[]> {
    const conditions = [];
    
    if (filters.repositoryId) {
      conditions.push(eq(vulnerabilities.repositoryId, filters.repositoryId));
    }
    
    if (filters.scanId) {
      conditions.push(eq(vulnerabilities.scanId, filters.scanId));
    }
    
    if (filters.severity) {
      conditions.push(eq(vulnerabilities.severity, filters.severity as any));
    }
    
    if (filters.status) {
      conditions.push(eq(vulnerabilities.status, filters.status as any));
    }
    
    // Build query step by step to avoid type issues
    let baseQuery = db.select().from(vulnerabilities);
    
    if (conditions.length > 0) {
      baseQuery = baseQuery.where(and(...conditions)) as any;
    }
    
    baseQuery = baseQuery.orderBy(desc(vulnerabilities.createdAt)) as any;
    
    if (filters.limit) {
      baseQuery = baseQuery.limit(filters.limit) as any;
    }
    
    if (filters.offset) {
      baseQuery = baseQuery.offset(filters.offset) as any;
    }
    
    return await baseQuery;
  }

  async getVulnerabilitiesByScan(scanId: string): Promise<Vulnerability[]> {
    return await db
      .select()
      .from(vulnerabilities)
      .where(eq(vulnerabilities.scanId, scanId))
      .orderBy(desc(vulnerabilities.severity), desc(vulnerabilities.createdAt));
  }

  async getVulnerability(id: string): Promise<Vulnerability | undefined> {
    const [vulnerability] = await db
      .select()
      .from(vulnerabilities)
      .where(eq(vulnerabilities.id, id));
    return vulnerability || undefined;
  }

  async createVulnerability(vulnerability: InsertVulnerability): Promise<Vulnerability> {
    const safeVulnerability: any = {
      ...vulnerability,
      metadata: vulnerability.metadata ? {
        library: typeof vulnerability.metadata.library === 'string' ? vulnerability.metadata.library : undefined,
        algorithm: typeof vulnerability.metadata.algorithm === 'string' ? vulnerability.metadata.algorithm : undefined,
        keySize: typeof vulnerability.metadata.keySize === 'number' ? vulnerability.metadata.keySize : undefined,
        nistStandard: typeof vulnerability.metadata.nistStandard === 'string' ? vulnerability.metadata.nistStandard : undefined
      } : undefined
    };
    
    const [created] = await db
      .insert(vulnerabilities)
      .values([safeVulnerability])
      .returning();
    return created;
  }

  async updateVulnerabilityStatus(id: string, status: string, workaround?: string): Promise<Vulnerability> {
    const updateData: any = {
      status: status as any,
      updatedAt: new Date(),
    };

    if (workaround) {
      updateData.workaround = workaround;
    }

    const [updated] = await db
      .update(vulnerabilities)
      .set(updateData)
      .where(eq(vulnerabilities.id, id))
      .returning();
    return updated;
  }

  // CBOM operations
  async getCbomReport(repositoryId: string): Promise<CbomReport | undefined> {
    const [cbom] = await db
      .select()
      .from(cbomReports)
      .where(eq(cbomReports.repositoryId, repositoryId))
      .orderBy(desc(cbomReports.createdAt))
      .limit(1);
    return cbom || undefined;
  }

  async createCbomReport(cbom: InsertCbomReport): Promise<CbomReport> {
    const safeCbom: any = {
      ...cbom,
      cryptoAssets: Array.isArray(cbom.cryptoAssets) ? cbom.cryptoAssets.map((asset: any) => ({
        name: String(asset.name || ''),
        algorithm: String(asset.algorithm || ''),
        keySize: typeof asset.keySize === 'number' ? asset.keySize : undefined,
        location: String(asset.location || ''),
        nistCompliance: typeof asset.nistCompliance === 'boolean' ? asset.nistCompliance : undefined
      })) : []
    };
    
    const [created] = await db
      .insert(cbomReports)
      .values([safeCbom])
      .returning();
    return created;
  }

  async getCbomReportByScanId(scanId: string): Promise<CbomReport | undefined> {
    const [cbom] = await db
      .select()
      .from(cbomReports)
      .where(eq(cbomReports.scanId, scanId))
      .orderBy(desc(cbomReports.createdAt))
      .limit(1);
    return cbom || undefined;
  }

  async getCBOMReportByScan(scanId: string): Promise<CbomReport | undefined> {
    return this.getCbomReportByScanId(scanId);
  }

  async getCBOMReports(filters?: { repositoryId?: string }): Promise<CbomReport[]> {
    let query = db.select().from(cbomReports);
    
    if (filters?.repositoryId) {
      query = query.where(eq(cbomReports.repositoryId, filters.repositoryId));
    }
    
    return await query.orderBy(desc(cbomReports.createdAt));
  }

  async createCBOMReport(cbomReport: InsertCbomReport): Promise<CbomReport> {
    return await this.createCbomReport(cbomReport);
  }

  async updateCbomReport(id: string, updates: Partial<CbomReport>): Promise<CbomReport> {
    const [updated] = await db
      .update(cbomReports)
      .set(updates)
      .where(eq(cbomReports.id, id))
      .returning();
    return updated;
  }

  // VDR operations
  async getVdrReport(vulnerabilityId: string): Promise<VdrReport | undefined> {
    const [vdr] = await db
      .select()
      .from(vdrReports)
      .where(eq(vdrReports.vulnerabilityId, vulnerabilityId))
      .orderBy(desc(vdrReports.createdAt))
      .limit(1);
    return vdr || undefined;
  }

  async createVdrReport(vdr: InsertVdrReport): Promise<VdrReport> {
    const [created] = await db
      .insert(vdrReports)
      .values([vdr])
      .returning();
    return created;
  }

  // Integration operations
  async getIntegrations(): Promise<Integration[]> {
    return await db
      .select()
      .from(integrations)
      .orderBy(asc(integrations.name));
  }

  async getIntegration(id: string): Promise<Integration | undefined> {
    const [integration] = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, id));
    return integration || undefined;
  }

  async createIntegration(integration: InsertIntegration & { apiKey: string }): Promise<Integration> {
    const safeIntegration: any = {
      ...integration,
      config: {
        enabled: Boolean(integration.config.enabled),
        repositoryUrl: typeof integration.config.repositoryUrl === 'string' ? integration.config.repositoryUrl : undefined,
        jenkinsUrl: typeof integration.config.jenkinsUrl === 'string' ? integration.config.jenkinsUrl : undefined,
        username: typeof integration.config.username === 'string' ? integration.config.username : undefined,
        sonarUrl: typeof integration.config.sonarUrl === 'string' ? integration.config.sonarUrl : undefined,
        projectKey: typeof integration.config.projectKey === 'string' ? integration.config.projectKey : undefined,
        webhookUrl: typeof integration.config.webhookUrl === 'string' ? integration.config.webhookUrl : undefined,
        permissions: Array.isArray(integration.config.permissions) ? integration.config.permissions : undefined
      }
    };
    
    const [created] = await db
      .insert(integrations)
      .values([safeIntegration])
      .returning();
    return created;
  }

  async updateIntegration(id: string, updates: Partial<Integration>): Promise<Integration> {
    const updateData: any = { ...updates };
    if (updates.isActive !== undefined) {
      updateData.lastUsed = new Date();
    }

    const [updated] = await db
      .update(integrations)
      .set(updateData)
      .where(eq(integrations.id, id))
      .returning();
    return updated;
  }

  // Dashboard stats
  async getDashboardStats(): Promise<{
    criticalVulnerabilities: number;
    quantumVulnerable: number;
    pqcCompliant: number;
    activeScans: number;
  }> {
    const [criticalCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(vulnerabilities)
      .where(eq(vulnerabilities.severity, 'critical'));

    const [quantumVulnerableCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(vulnerabilities)
      .where(eq(vulnerabilities.pqcCategory, 'quantum_vulnerable'));

    const [pqcCompliantCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(vulnerabilities)
      .where(eq(vulnerabilities.pqcCategory, 'pqc_compliant'));

    const [activeScansCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(scans)
      .where(sql`status IN ('pending', 'scanning')`);

    return {
      criticalVulnerabilities: criticalCount?.count || 0,
      quantumVulnerable: quantumVulnerableCount?.count || 0,
      pqcCompliant: pqcCompliantCount?.count || 0,
      activeScans: activeScansCount?.count || 0,
    };
  }

  async getRepositoryLanguageStats(): Promise<Array<{language: string; count: number}>> {
    const repos = await db.select().from(repositories);
    const languageCount: {[key: string]: number} = {};
    
    repos.forEach(repo => {
      const languages = Array.isArray(repo.languages) ? repo.languages : [];
      languages.forEach(lang => {
        languageCount[lang] = (languageCount[lang] || 0) + 1;
      });
    });
    
    return Object.entries(languageCount).map(([language, count]) => ({
      language: language.charAt(0).toUpperCase() + language.slice(1),
      count
    }));
  }

  async getCryptoAssetStats(): Promise<Array<{assetType: string; count: number}>> {
    const vulnRecords = await db.select().from(vulnerabilities);
    const assetTypes: {[key: string]: number} = {};
    
    vulnRecords.forEach(vuln => {
      if (vuln.metadata && typeof vuln.metadata === 'object') {
        const metadata = vuln.metadata as any;
        const algorithm = metadata.algorithm;
        if (algorithm) {
          let assetType = 'Other';
          if (algorithm.toLowerCase().includes('rsa') || algorithm.toLowerCase().includes('private')) {
            assetType = 'Private Key';
          } else if (algorithm.toLowerCase().includes('sha256') || algorithm.toLowerCase().includes('sha-256')) {
            assetType = 'SHA256';
          } else if (algorithm.toLowerCase().includes('x25519')) {
            assetType = 'X25519';
          } else if (algorithm.toLowerCase().includes('ed25519') || algorithm.toLowerCase().includes('eddsa')) {
            assetType = 'ED25519';
          } else if (algorithm.toLowerCase().includes('aes')) {
            assetType = 'AES';
          } else if (algorithm.toLowerCase().includes('ecdsa')) {
            assetType = 'ECDSA';
          }
          assetTypes[assetType] = (assetTypes[assetType] || 0) + 1;
        }
      }
    });
    
    return Object.entries(assetTypes).map(([assetType, count]) => ({
      assetType,
      count
    }));
  }

  async getCryptoLibrariesStats(): Promise<Array<{library: string; count: number}>> {
    const vulnRecords = await db.select().from(vulnerabilities);
    const libraries: {[key: string]: number} = {};
    
    vulnRecords.forEach(vuln => {
      if (vuln.metadata && typeof vuln.metadata === 'object') {
        const metadata = vuln.metadata as any;
        const library = metadata.library;
        if (library) {
          const libName = library.toLowerCase();
          let displayName = library;
          
          if (libName.includes('bouncy')) displayName = 'Bouncy Castle';
          else if (libName.includes('openssl')) displayName = 'OpenSSL';
          else if (libName.includes('crypto')) displayName = 'Node Crypto';
          else if (libName.includes('pycrypto')) displayName = 'PyCrypto';
          else if (libName.includes('javax.crypto')) displayName = 'Java Crypto';
          else if (libName.includes('cryptojs')) displayName = 'CryptoJS';
          
          libraries[displayName] = (libraries[displayName] || 0) + 1;
        }
      }
    });
    
    return Object.entries(libraries).map(([library, count]) => ({
      library,
      count
    }));
  }

  async getVulnerabilityTrends(): Promise<Array<{date: string; count: number; severity: string}>> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const vulnRecords = await db
      .select({
        createdAt: vulnerabilities.createdAt,
        severity: vulnerabilities.severity
      })
      .from(vulnerabilities)
      .where(sql`${vulnerabilities.createdAt} >= ${thirtyDaysAgo.toISOString()}`);
    
    const dateMap: {[key: string]: {[severity: string]: number}} = {};
    
    // Initialize with zeros for the last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dateMap[dateStr] = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    }
    
    // Count vulnerabilities by date and severity
    vulnRecords.forEach(vuln => {
      const dateStr = vuln.createdAt.toISOString().split('T')[0];
      if (dateMap[dateStr]) {
        dateMap[dateStr][vuln.severity] = (dateMap[dateStr][vuln.severity] || 0) + 1;
      }
    });
    
    // Convert to array format for charts
    const result: Array<{date: string; count: number; severity: string}> = [];
    Object.entries(dateMap).forEach(([date, severities]) => {
      Object.entries(severities).forEach(([severity, count]) => {
        result.push({ date, severity, count });
      });
    });
    
    return result;
  }

  async getDetailedStats(): Promise<{
    totalRepositories: number;
    totalScanned: number;
    totalVulnerabilities: number;
    lastScanDate: string | null;
  }> {
    const [repoCount] = await db.select({ count: sql<number>`count(*)` }).from(repositories);
    
    const [scannedCount] = await db
      .select({ count: sql<number>`count(distinct repository_id)` })
      .from(scans)
      .where(eq(scans.status, 'completed'));
    
    const [vulnCount] = await db.select({ count: sql<number>`count(*)` }).from(vulnerabilities);
    
    const [lastScan] = await db
      .select({ completedAt: scans.completedAt })
      .from(scans)
      .where(eq(scans.status, 'completed'))
      .orderBy(desc(scans.completedAt))
      .limit(1);
    
    return {
      totalRepositories: repoCount?.count || 0,
      totalScanned: scannedCount?.count || 0,
      totalVulnerabilities: vulnCount?.count || 0,
      lastScanDate: lastScan?.completedAt?.toISOString() || null,
    };
  }

  // Provider token operations
  async getProviderTokens(userId: string): Promise<ProviderToken[]> {
    return await db
      .select()
      .from(providerTokens)
      .where(eq(providerTokens.userId, userId))
      .orderBy(desc(providerTokens.createdAt));
  }

  async getProviderToken(id: string): Promise<ProviderToken | undefined> {
    const [token] = await db
      .select()
      .from(providerTokens)
      .where(eq(providerTokens.id, id));
    return token || undefined;
  }

  async getProviderTokenByProvider(userId: string, provider: string): Promise<ProviderToken | undefined> {
    const [token] = await db
      .select()
      .from(providerTokens)
      .where(and(
        eq(providerTokens.userId, userId),
        eq(providerTokens.provider, provider),
        eq(providerTokens.isActive, true)
      ));
    return token || undefined;
  }

  async createProviderToken(token: InsertProviderToken): Promise<ProviderToken> {
    const tokenData: any = {
      ...token,
      organizationAccess: Array.isArray(token.organizationAccess) ? token.organizationAccess : []
    };
    
    const [created] = await db
      .insert(providerTokens)
      .values([tokenData])
      .returning();
    return created;
  }

  async updateProviderToken(id: string, updates: Partial<ProviderToken>): Promise<ProviderToken> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db
      .update(providerTokens)
      .set(updateData)
      .where(eq(providerTokens.id, id))
      .returning();
    return updated;
  }

  async deleteProviderToken(id: string): Promise<void> {
    await db
      .delete(providerTokens)
      .where(eq(providerTokens.id, id));
  }

  // Scanner configuration operations
  async getScannerConfig(userId: string): Promise<any> {
    // For now, return a default scanner config
    return {
      defaultTool: "semgrep",
      maxConcurrentScans: 3,
      timeout: 300000, // 5 minutes
      maxFileSize: 10485760, // 10MB
      enabledRules: ["all"],
      externalScanners: []
    };
  }

  async updateScannerConfig(userId: string, config: any): Promise<any> {
    // For now, just return the config (would store in database in real implementation)
    return config;
  }

  // Enhanced scan operations
  async updateScan(id: string, updates: Partial<{ status: string; progress: number; completedAt: Date; error: string }>): Promise<void> {
    const updateData: any = {};
    
    if (updates.status) updateData.status = updates.status;
    if (updates.progress !== undefined) updateData.progress = updates.progress;
    if (updates.completedAt) updateData.completedAt = updates.completedAt;
    if (updates.error) updateData.errorMessage = updates.error;
    
    await db
      .update(scans)
      .set(updateData)
      .where(eq(scans.id, id));
  }

  // Enhanced vulnerability operations
  async deleteVulnerabilitiesByScan(scanId: string): Promise<void> {
    await db.delete(vulnerabilities).where(eq(vulnerabilities.scanId, scanId));
  }
}

export const storage = new DatabaseStorage();
