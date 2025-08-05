import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { apiRouter } from './routes/api';
import { errorHandler, notFoundHandler } from './utils/errorHandler';
import { HealthResponse } from './types/api';
import { DiagramController } from './controllers/diagramController';
import { 
  requestTimeout, 
  rateLimit, 
  compressResponse, 
  performanceLogger, 
  memoryMonitor 
} from './middleware/performance';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Performance middleware
app.use((req, res, next) => {
  // Add response time header
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    res.set('X-Response-Time', `${duration}ms`);
  });
  next();
});

// Compression middleware for better response times
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Middleware setup
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
    },
  },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200, // For legacy browser support
}));

// Request size limits and parsing optimizations
app.use(express.json({ 
  limit: '10mb',
  type: ['application/json', 'text/plain']
}));
app.use(express.urlencoded({ 
  extended: true,
  limit: '10mb',
  parameterLimit: 1000
}));

// Performance middleware
app.use(performanceLogger);
app.use(memoryMonitor);
app.use(compressResponse);
app.use(requestTimeout(30000)); // 30 second timeout
app.use(rateLimit(20, 60000)); // 20 requests per minute

// Health check endpoint
app.get('/health', (req, res) => {
  const response: HealthResponse = {
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'ai-diagram-generator-backend'
  };
  res.json(response);
});

// API routes
app.use('/api', apiRouter);

// Error handling middleware (must be after routes)
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize services
async function initializeServices() {
  try {
    console.log('🔧 Initializing services...');
    DiagramController.initialize();
    console.log('✅ All services initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    process.exit(1);
  }
}

// Start server
const server = app.listen(PORT, async () => {
  console.log(`🚀 AI Diagram Generator Backend running on port ${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
  console.log(`🎨 API endpoints available at http://localhost:${PORT}/api`);
  
  // Initialize services after server starts
  await initializeServices();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

export { app };