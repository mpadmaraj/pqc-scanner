import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const severityEnum = pgEnum("severity", ["critical", "high", "medium", "low", "info"]);
export const scanStatusEnum = pgEnum("scan_status", ["pending", "scanning", "completed", "failed"]);
export const vulnerabilityStatusEnum = pgEnum("vulnerability_status", ["new", "reviewing", "fixed", "false_positive", "ignored"]);
export const repositoryProviderEnum = pgEnum("repository_provider", ["github", "gitlab", "bitbucket", "local"]);

// Tables
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const repositories = pgTable("repositories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  url: text("url").notNull(),
  provider: repositoryProviderEnum("provider").notNull(),
  description: text("description"),
  languages: jsonb("languages").$type<string[]>().default([]),
  lastScanAt: timestamp("last_scan_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const scans = pgTable("scans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  repositoryId: varchar("repository_id").references(() => repositories.id).notNull(),
  status: scanStatusEnum("status").default("pending").notNull(),
  progress: integer("progress").default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  totalFiles: integer("total_files").default(0),
  scanConfig: jsonb("scan_config").$type<{
    tools: string[];
    languages: string[];
    customRules?: string[];
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const vulnerabilities = pgTable("vulnerabilities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scanId: varchar("scan_id").references(() => scans.id).notNull(),
  repositoryId: varchar("repository_id").references(() => repositories.id).notNull(),
  cveId: text("cve_id"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: severityEnum("severity").notNull(),
  status: vulnerabilityStatusEnum("status").default("new").notNull(),
  filePath: text("file_path").notNull(),
  startLine: integer("start_line"),
  endLine: integer("end_line"),
  codeSnippet: text("code_snippet"),
  recommendation: text("recommendation"),
  workaround: text("workaround"),
  cvssScore: text("cvss_score"),
  pqcCategory: text("pqc_category"), // e.g., "quantum_vulnerable", "migration_required"
  detectedBy: text("detected_by").notNull(), // tool that found it
  metadata: jsonb("metadata").$type<{
    library?: string;
    algorithm?: string;
    keySize?: number;
    nistStandard?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cbomReports = pgTable("cbom_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  repositoryId: varchar("repository_id").references(() => repositories.id).notNull(),
  scanId: varchar("scan_id").references(() => scans.id),
  bomFormat: text("bom_format").default("CycloneDX").notNull(),
  specVersion: text("spec_version").default("1.6").notNull(),
  content: jsonb("content").notNull(),
  cryptoAssets: jsonb("crypto_assets").$type<Array<{
    name: string;
    algorithm: string;
    keySize?: number;
    location: string;
    nistCompliance?: boolean;
  }>>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const vdrReports = pgTable("vdr_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vulnerabilityId: varchar("vulnerability_id").references(() => vulnerabilities.id).notNull(),
  bomFormat: text("bom_format").default("CycloneDX").notNull(),
  specVersion: text("spec_version").default("1.6").notNull(),
  content: jsonb("content").notNull(),
  vexStatus: text("vex_status").default("not_affected"), // affected, not_affected, fixed, under_investigation
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const integrations = pgTable("integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // github_actions, jenkins, sonarqube
  config: jsonb("config").$type<{
    apiKey?: string;
    webhookUrl?: string;
    enabled: boolean;
  }>().notNull(),
  isActive: boolean("is_active").default(true),
  lastUsed: timestamp("last_used"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const repositoriesRelations = relations(repositories, ({ many }) => ({
  scans: many(scans),
  vulnerabilities: many(vulnerabilities),
  cbomReports: many(cbomReports),
}));

export const scansRelations = relations(scans, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [scans.repositoryId],
    references: [repositories.id],
  }),
  vulnerabilities: many(vulnerabilities),
  cbomReport: one(cbomReports),
}));

export const vulnerabilitiesRelations = relations(vulnerabilities, ({ one, many }) => ({
  scan: one(scans, {
    fields: [vulnerabilities.scanId],
    references: [scans.id],
  }),
  repository: one(repositories, {
    fields: [vulnerabilities.repositoryId],
    references: [repositories.id],
  }),
  vdrReports: many(vdrReports),
}));

export const cbomReportsRelations = relations(cbomReports, ({ one }) => ({
  repository: one(repositories, {
    fields: [cbomReports.repositoryId],
    references: [repositories.id],
  }),
  scan: one(scans, {
    fields: [cbomReports.scanId],
    references: [scans.id],
  }),
}));

export const vdrReportsRelations = relations(vdrReports, ({ one }) => ({
  vulnerability: one(vulnerabilities, {
    fields: [vdrReports.vulnerabilityId],
    references: [vulnerabilities.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertRepositorySchema = createInsertSchema(repositories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastScanAt: true,
});

export const insertScanSchema = createInsertSchema(scans).omit({
  id: true,
  createdAt: true,
});

export const insertVulnerabilitySchema = createInsertSchema(vulnerabilities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCbomReportSchema = createInsertSchema(cbomReports).omit({
  id: true,
  createdAt: true,
});

export const insertVdrReportSchema = createInsertSchema(vdrReports).omit({
  id: true,
  createdAt: true,
});

export const insertIntegrationSchema = createInsertSchema(integrations).omit({
  id: true,
  createdAt: true,
  lastUsed: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Repository = typeof repositories.$inferSelect;
export type InsertRepository = z.infer<typeof insertRepositorySchema>;

export type Scan = typeof scans.$inferSelect;
export type InsertScan = z.infer<typeof insertScanSchema>;

export type Vulnerability = typeof vulnerabilities.$inferSelect;
export type InsertVulnerability = z.infer<typeof insertVulnerabilitySchema>;

export type CbomReport = typeof cbomReports.$inferSelect;
export type InsertCbomReport = z.infer<typeof insertCbomReportSchema>;

export type VdrReport = typeof vdrReports.$inferSelect;
export type InsertVdrReport = z.infer<typeof insertVdrReportSchema>;

export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
