/**
 * Repository Routes
 * 
 * All repository-related endpoints with proper validation and error handling
 */
import { Router } from 'express';
import { validateRequest, validateParams } from '../middleware/validation';
import { asyncHandler } from '../middleware/error-handler';
import * as repositoryController from '../controllers/repositories';
import { insertRepositorySchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

// Validation schemas
const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required')
});

const importSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  provider: z.string().min(1, 'Provider is required'),
  organizationName: z.string().min(1, 'Organization name is required')
});

// Routes
router.get('/', 
  asyncHandler(repositoryController.getAllRepositories)
);

router.get('/:id', 
  validateParams(idParamSchema),
  asyncHandler(repositoryController.getRepository)
);

router.post('/', 
  validateRequest(insertRepositorySchema),
  asyncHandler(repositoryController.createRepository)
);

router.patch('/:id', 
  validateParams(idParamSchema),
  asyncHandler(repositoryController.updateRepository)
);

router.delete('/:id', 
  validateParams(idParamSchema),
  asyncHandler(repositoryController.deleteRepository)
);

router.post('/import', 
  validateRequest(importSchema),
  asyncHandler(repositoryController.importRepositories)
);

export { router as repositoryRoutes };