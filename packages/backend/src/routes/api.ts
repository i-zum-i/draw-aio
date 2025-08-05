import { Router } from 'express';
import { DiagramController } from '../controllers/diagramController';
import { validateRequest, validateRequestSize, basicRateLimit } from '../middleware/validation';
import { diagramRequestSchema } from '../utils/validation';
import { FileController } from '../controllers/fileController';

const router = Router();

// Apply global middleware to all API routes
router.use(validateRequestSize);
router.use(basicRateLimit(50, 15 * 60 * 1000)); // 50 requests per 15 minutes

// Diagram generation endpoint with validation
router.post(
  '/generate-diagram',
  validateRequest(diagramRequestSchema),
  DiagramController.generateDiagram
);

// File serving endpoint for temporary files
router.get('/files/:fileId', FileController.serveFile);

export { router as apiRouter };