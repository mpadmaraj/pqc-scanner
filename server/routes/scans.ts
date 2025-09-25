/**
 * Scan Routes
 * 
 * All scanning-related endpoints with proper validation and error handling
 */
import { Router } from 'express';
import { validateRequest, validateParams } from '../middleware/validation';
import { asyncHandler } from '../middleware/error-handler';
import * as scanController from '../controllers/scans';
import { insertScanSchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

// Validation schemas
const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required')
});

// Routes
router.get('/', 
  asyncHandler(scanController.getAllScans)
);

router.get('/:id', 
  validateParams(idParamSchema),
  asyncHandler(scanController.getScan)
);

router.post('/', 
  validateRequest(insertScanSchema),
  asyncHandler(scanController.createScan)
);

router.patch('/:id', 
  validateParams(idParamSchema),
  asyncHandler(scanController.updateScan)
);

router.post('/:id/cancel', 
  validateParams(idParamSchema),
  asyncHandler(scanController.cancelScan)
);

router.get('/:id/results', 
  validateParams(idParamSchema),
  asyncHandler(scanController.getScanResults)
);

export { router as scanRoutes };