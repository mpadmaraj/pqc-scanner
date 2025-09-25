/**
 * Main Routes Index
 * 
 * Centralized route registration following Express best practices
 * Each domain has its own router module for better organization
 */
import { Express } from 'express';
import { createServer, Server } from 'http';

// Import middleware
import { errorHandler, notFoundHandler } from '../middleware/error-handler';

// Import route modules
import { repositoryRoutes } from './repositories';
import { scanRoutes } from './scans'; 
import { dashboardRoutes } from './dashboard';
import { vulnerabilityRoutes } from './vulnerabilities';
import { settingsRoutes } from './settings';

/**
 * Register all application routes
 * @param app - Express application instance
 * @returns HTTP server instance
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint (simple, no authentication needed)
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime() 
    });
  });

  // Register domain-specific routes
  app.use('/api/repositories', repositoryRoutes);
  app.use('/api/scans', scanRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/vulnerabilities', vulnerabilityRoutes);
  app.use('/api/settings', settingsRoutes);

  // Register error handling middleware (must be last)
  app.use(notFoundHandler);  // 404 handler
  app.use(errorHandler);     // Global error handler

  // Create and return HTTP server
  const server = createServer(app);
  return server;
}