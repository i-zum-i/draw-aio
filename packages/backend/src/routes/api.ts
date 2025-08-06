import { Router } from 'express';
import { DiagramController } from '../controllers/diagramController';
import { validateRequest, validateRequestSize, basicRateLimit } from '../middleware/validation';
import { diagramRequestSchema } from '../utils/validation';
import { FileController } from '../controllers/fileController';

const router = Router();

// Apply global middleware to all API routes (except file serving)
router.use('/generate-diagram', validateRequestSize);
router.use('/generate-diagram', basicRateLimit(50, 15 * 60 * 1000)); // 50 requests per 15 minutes

// Diagram generation endpoint with validation
router.post(
  '/generate-diagram',
  validateRequest(diagramRequestSchema),
  DiagramController.generateDiagram.bind(DiagramController)
);

// File serving endpoint for temporary files (with more relaxed rate limiting)
router.get('/files/:fileId', 
  basicRateLimit(200, 60 * 1000), // 200 requests per minute for file access
  FileController.serveFile
);

export { router as apiRouter };