export interface DiagramRequest {
  prompt: string;
}

export interface DiagramResponse {
  status: 'success' | 'error';
  imageUrl?: string;
  downloadUrl?: string;
  message?: string;
}

export interface ComponentProps {
  className?: string;
  children?: React.ReactNode;
}