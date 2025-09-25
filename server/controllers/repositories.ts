/**
 * Repository Controllers
 * 
 * Handles all repository-related HTTP requests
 * Provides CRUD operations for repository management
 */
import { Request, Response } from 'express';
import { storage } from '../storage';
import { integrationsService } from '../services/integrations';
import { repositoryImportService } from '../services/repository-import';
import { insertRepositorySchema } from '@shared/schema';
import { createAppError } from '../middleware/error-handler';

/**
 * Get all repositories
 * GET /api/repositories
 */
export async function getAllRepositories(req: Request, res: Response) {
  const repositories = await storage.getRepositories();
  res.json(repositories);
}

/**
 * Get a single repository by ID
 * GET /api/repositories/:id
 */
export async function getRepository(req: Request, res: Response) {
  const { id } = req.params;
  
  const repository = await storage.getRepository(id);
  if (!repository) {
    throw createAppError('Repository not found', 404);
  }
  
  res.json(repository);
}

/**
 * Create a new repository
 * POST /api/repositories
 */
export async function createRepository(req: Request, res: Response) {
  // Check for API key authentication
  const authHeader = req.headers.authorization;
  let integrationId = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const apiKey = authHeader.substring(7);
    const integration = await integrationsService.authenticateApiKey(apiKey);
    if (integration) {
      integrationId = integration.id;
      // Update last used timestamp
      await storage.updateIntegration(integration.id, { lastUsed: new Date() });
    }
  }
  
  // Request body is already validated by middleware
  const data = req.body;
  const repositoryData = {
    ...data,
    integrationId
  };
  
  const repository = await storage.createRepository(repositoryData);
  res.status(201).json(repository);
}

/**
 * Update an existing repository
 * PATCH /api/repositories/:id
 */
export async function updateRepository(req: Request, res: Response) {
  const { id } = req.params;
  
  // Check if repository exists
  const existingRepository = await storage.getRepository(id);
  if (!existingRepository) {
    throw createAppError('Repository not found', 404);
  }
  
  const updateData = {
    name: req.body.name,
    url: req.body.url,
    provider: req.body.provider,
    description: req.body.description,
    languages: Array.isArray(req.body.languages) ? req.body.languages : [],
  };
  
  const repository = await storage.updateRepository(id, updateData);
  res.json(repository);
}

/**
 * Delete a repository
 * DELETE /api/repositories/:id
 */
export async function deleteRepository(req: Request, res: Response) {
  const { id } = req.params;
  
  // Check if repository exists
  const existingRepository = await storage.getRepository(id);
  if (!existingRepository) {
    throw createAppError('Repository not found', 404);
  }
  
  await storage.deleteRepository(id);
  res.status(204).send();
}

/**
 * Import repositories from provider
 * POST /api/repositories/import
 */
export async function importRepositories(req: Request, res: Response) {
  const { userId, provider, organizationName } = req.body;
  
  if (!userId || !provider || !organizationName) {
    throw createAppError('userId, provider, and organizationName are required', 400);
  }
  
  // Scan organization for repositories and import them
  const result = await repositoryImportService.scanOrganization(userId, provider, organizationName);
  
  res.json(result);
}