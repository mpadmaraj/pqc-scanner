import { 
  repositories, scans, vulnerabilities, cbomReports, vdrReports, integrations,
  type Repository, type InsertRepository,
  type Scan, type InsertScan,
  type Vulnerability, type InsertVulnerability,
  type CbomReport, type InsertCbomReport,
  type VdrReport, type InsertVdrReport,
  type Integration, type InsertIntegration,
  type User, type InsertUser
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

  // VDR operations
  getVdrReport(vulnerabilityId: string): Promise<VdrReport | undefined>;
  createVdrReport(vdr: InsertVdrReport): Promise<VdrReport>;

  // Integration operations
  getIntegrations(): Promise<Integration[]>;
  getIntegration(id: string): Promise<Integration | undefined>;
  createIntegration(integration: InsertIntegration): Promise<Integration>;
  updateIntegration(id: string, updates: Partial<Integration>): Promise<Integration>;

  // Dashboard stats
  getDashboardStats(): Promise<{
    criticalVulnerabilities: number;
    quantumVulnerable: number;
    pqcCompliant: number;
    activeScans: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(repositories).where(eq(repositories.id, id));
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
    const [created] = await db
      .insert(repositories)
      .values(repository)
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

  // Scan operations
  async getScans(repositoryId?: string): Promise<Scan[]> {
    let query = db.select().from(scans);
    
    if (repositoryId) {
      query = query.where(eq(scans.repositoryId, repositoryId));
    }
    
    return await query.orderBy(desc(scans.createdAt));
  }

  async getScan(id: string): Promise<Scan | undefined> {
    const [scan] = await db.select().from(scans).where(eq(scans.id, id));
    return scan || undefined;
  }

  async createScan(scan: InsertScan): Promise<Scan> {
    const [created] = await db
      .insert(scans)
      .values({
        ...scan,
        startedAt: new Date(),
      })
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
    let query = db.select().from(vulnerabilities);
    
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
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    query = query.orderBy(desc(vulnerabilities.createdAt));
    
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    
    if (filters.offset) {
      query = query.offset(filters.offset);
    }
    
    return await query;
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
    const [created] = await db
      .insert(vulnerabilities)
      .values(vulnerability)
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
    const [created] = await db
      .insert(cbomReports)
      .values(cbom)
      .returning();
    return created;
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
      .values(vdr)
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

  async createIntegration(integration: InsertIntegration): Promise<Integration> {
    const [created] = await db
      .insert(integrations)
      .values(integration)
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
}

export const storage = new DatabaseStorage();
