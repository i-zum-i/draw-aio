import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { apiRouter } from '../routes/api';
import { errorHandler, notFoundHandler } from '../utils/errorHandler';

// Create a test app instance
function createTestApp() {
  const app = express();
  
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'ai-diagram-generator-backend'
    });
  });
  
  // API routes
  app.use('/api', apiRouter);
  
  // Error handling middleware
  app.use(notFoundHandler);
  app.use(errorHandler);
  
  return app;
}

describe('API Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('Input Validation Integration', () => {
    it('should reject empty prompt', async () => {
      const response = await request(app)
        .post('/api/generate-diagram')
        .send({ prompt: '' })
        .expect(400);

      expect(response.body).toMatchObject({
        status: 'error',
        message: expect.any(String)
      });
    });

    it('should reject missing prompt', async () => {
      const response = await request(app)
        .post('/api/generate-diagram')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        status: 'error'
      });
    });

    it('should reject oversized prompt', async () => {
      const longPrompt = 'a'.repeat(10001);
      
      const response = await request(app)
        .post('/api/generate-diagram')
        .send({ prompt: longPrompt })
        .expect(400);

      expect(response.body).toMatchObject({
        status: 'error',
        message: expect.stringContaining('10,000文字')
      });
    });

    it('should accept valid prompt format', async () => {
      // This will fail at the LLM service level since we don't have API keys in test
      // but it should pass validation
      const response = await request(app)
        .post('/api/generate-diagram')
        .send({ prompt: 'テストフローチャートを作成してください' });

      // Should not be a validation error (400), but likely a service error (500)
      expect(response.status).not.toBe(400);
    });
  });

  describe('File Serving Integration', () => {
    it('should return 404 for non-existent files', async () => {
      const response = await request(app)
        .get('/api/files/nonexistent-file-id')
        .expect(404);

      expect(response.body).toMatchObject({
        status: 'error',
        message: expect.any(String)
      });
    });
  });

  describe('Health Check Integration', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
        service: 'ai-diagram-generator-backend'
      });
    });
  });

  describe('CORS Integration', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .options('/api/generate-diagram')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Request Size Limits', () => {
    it('should handle large but valid requests', async () => {
      const largeButValidPrompt = 'テスト'.repeat(1000); // About 4000 characters
      
      const response = await request(app)
        .post('/api/generate-diagram')
        .send({ prompt: largeButValidPrompt });

      // Should not fail due to size limits
      expect(response.status).not.toBe(413); // Payload Too Large
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/generate-diagram')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toMatchObject({
        status: 'error'
      });
    });

    it('should handle unsupported content type', async () => {
      const response = await request(app)
        .post('/api/generate-diagram')
        .set('Content-Type', 'text/plain')
        .send('plain text prompt');

      // Should either reject or handle gracefully
      expect([400, 415]).toContain(response.status);
    });
  });
});