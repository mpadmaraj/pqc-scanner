/**
 * Settings Controllers
 * 
 * Handles application settings, provider tokens, and integrations
 * Manages authentication tokens for external services
 */
import { Request, Response } from 'express';
import { storage } from '../storage';
import { integrationsService } from '../services/integrations';
import { createAppError } from '../middleware/error-handler';

/**
 * Get all provider tokens for the current user
 * GET /api/settings/provider-tokens
 */
export async function getProviderTokens(req: Request, res: Response) {
  // Using hardcoded user ID for demo purposes - in production use req.user.id
  const userId = 'demo-user';
  
  const tokens = await storage.getProviderTokens(userId);
  // Don't expose actual token values in response
  const sanitizedTokens = tokens.map(token => ({
    ...token,
    accessToken: '***REDACTED***',
    refreshToken: token.refreshToken ? '***REDACTED***' : null
  }));
  
  res.json(sanitizedTokens);
}

/**
 * Create a new provider token
 * POST /api/settings/provider-tokens
 */
export async function createProviderToken(req: Request, res: Response) {
  const { name, provider, accessToken, organizationAccess } = req.body;
  
  if (!name || !provider || !accessToken) {
    throw createAppError('Name, provider, and access token are required', 400);
  }
  
  // Using hardcoded user ID for demo purposes
  const userId = 'demo-user';
  
  // Check if a token with this name already exists
  const existingTokens = await storage.getProviderTokens(userId);
  const existingToken = existingTokens.find(t => t.name === name);
  
  if (existingToken) {
    throw createAppError('A provider with this name already exists. Please choose a different name.', 400);
  }
  
  const tokenData = {
    userId,
    name,
    provider,
    accessToken,
    organizationAccess: organizationAccess || [],
    tokenType: 'personal_access_token',
    isActive: true,
    scopes: null,
    refreshToken: null,
    expiresAt: null
  };
  
  const createdToken = await storage.createProviderToken(tokenData);
  
  // Don't return the actual token in response
  const sanitizedToken = {
    ...createdToken,
    accessToken: '***REDACTED***'
  };
  
  res.status(201).json(sanitizedToken);
}

/**
 * Update a provider token
 * PATCH /api/settings/provider-tokens/:id
 */
export async function updateProviderToken(req: Request, res: Response) {
  const { id } = req.params;
  const { name, organizationAccess, isActive } = req.body;
  
  const existingToken = await storage.getProviderToken(id);
  if (!existingToken) {
    throw createAppError('Provider token not found', 404);
  }
  
  const updateData = {
    name: name || existingToken.name,
    organizationAccess: organizationAccess !== undefined ? organizationAccess : existingToken.organizationAccess,
    isActive: isActive !== undefined ? isActive : existingToken.isActive,
    updatedAt: new Date()
  };
  
  const updatedToken = await storage.updateProviderToken(id, updateData);
  
  // Don't return the actual token in response
  const sanitizedToken = {
    ...updatedToken,
    accessToken: '***REDACTED***',
    refreshToken: updatedToken.refreshToken ? '***REDACTED***' : null
  };
  
  res.json(sanitizedToken);
}

/**
 * Delete a provider token
 * DELETE /api/settings/provider-tokens/:id
 */
export async function deleteProviderToken(req: Request, res: Response) {
  const { id } = req.params;
  
  const existingToken = await storage.getProviderToken(id);
  if (!existingToken) {
    throw createAppError('Provider token not found', 404);
  }
  
  await storage.deleteProviderToken(id);
  res.status(204).send();
}

/**
 * Get all integrations
 * GET /api/integrations
 */
export async function getIntegrations(req: Request, res: Response) {
  const integrations = await storage.getIntegrations();
  res.json(integrations);
}

/**
 * Create a new integration
 * POST /api/integrations
 */
export async function createIntegration(req: Request, res: Response) {
  const integrationData = req.body;
  const integration = await storage.createIntegration(integrationData);
  res.status(201).json(integration);
}

/**
 * Update an integration
 * PATCH /api/integrations/:id
 */
export async function updateIntegration(req: Request, res: Response) {
  const { id } = req.params;
  
  const existingIntegration = await storage.getIntegration(id);
  if (!existingIntegration) {
    throw createAppError('Integration not found', 404);
  }
  
  const integration = await storage.updateIntegration(id, req.body);
  res.json(integration);
}

/**
 * Delete an integration
 * DELETE /api/integrations/:id
 */
export async function deleteIntegration(req: Request, res: Response) {
  const { id } = req.params;
  
  const existingIntegration = await storage.getIntegration(id);
  if (!existingIntegration) {
    throw createAppError('Integration not found', 404);
  }
  
  await storage.deleteIntegration(id);
  res.status(204).send();
}