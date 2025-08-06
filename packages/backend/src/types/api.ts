// API Request and Response type definitions

export interface DiagramRequest {
  prompt: string;
}

export interface DiagramResponse {
  status: 'success' | 'error';
  imageUrl?: string;
  downloadUrl?: string;
  message?: string;
}

export interface ErrorResponse {
  status: 'error';
  message: string;
  code?: string;
}

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
  service: string;
}