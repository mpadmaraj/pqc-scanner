import type { VercelRequest, VercelResponse } from '@vercel/node';
import { registerRoutes } from '../server/routes.js';
import express from 'express';

let app: any = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!app) {
      app = express();
      app.use(express.json({ limit: '10mb' }));
      app.use(express.urlencoded({ extended: true, limit: '10mb' }));
      
      // Register routes
      registerRoutes(app);
    }

    // Set the correct URL for the request
    req.url = req.url || '';
    
    // Handle the request with Express app
    app(req, res);
  } catch (error) {
    console.error('API Handler Error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}