# AI Diagram Generator

AI-powered diagram generator that creates Draw.io diagrams from natural language descriptions.

## Project Structure

This is a TypeScript monorepo with the following structure:

```
ai-diagram-generator/
├── packages/
│   ├── backend/          # mastra-based API server
│   │   ├── src/
│   │   │   ├── controllers/  # API endpoints
│   │   │   ├── services/     # Business logic
│   │   │   ├── types/        # TypeScript interfaces
│   │   │   └── utils/        # Helper functions
│   │   └── package.json
│   └── frontend/         # Next.js React app
│       ├── src/
│       │   ├── app/          # Next.js app directory
│       │   ├── components/   # React components
│       │   ├── types/        # TypeScript interfaces
│       │   └── utils/        # Helper functions
│       └── package.json
├── package.json          # Root package.json with workspaces
└── tsconfig.json         # Shared TypeScript configuration
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm 9+
- Draw.io CLI (for PNG generation)
- Docker & Docker Compose (for production deployment)

### Development Setup

1. Install dependencies:
```bash
npm install
```

2. Install workspace dependencies:
```bash
npm install --workspaces
```

3. Set up environment variables:
```bash
# Backend environment
cp packages/backend/.env.example packages/backend/.env
# Edit packages/backend/.env and set ANTHROPIC_API_KEY

# Frontend environment
cp packages/frontend/.env.example packages/frontend/.env
```

4. Install Draw.io CLI:
```bash
npm install -g @drawio/drawio-desktop-cli
```

### Development

Run both frontend and backend in development mode:
```bash
npm run dev
```

Or run them separately:
```bash
# Backend only
npm run dev:backend

# Frontend only  
npm run dev:frontend
```

### Building

Build both packages:
```bash
npm run build
```

Build for production:
```bash
npm run build:production
```

### Testing

Run tests for all packages:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

## Production Deployment

### Using Docker

1. Set up production environment:
```bash
# Linux/Mac
./scripts/setup-production.sh

# Windows
.\scripts\setup-production.ps1
```

2. Configure environment variables:
```bash
# Edit .env file with production values
ANTHROPIC_API_KEY=your_actual_api_key
FRONTEND_URL=https://your-domain.com
NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

3. Deploy:
```bash
# Linux/Mac
./scripts/deploy.sh

# Windows
.\scripts\deploy.ps1
```

### Available Scripts

#### Development
- `npm run dev` - Start development servers
- `npm run build` - Build for development
- `npm run test` - Run tests
- `npm run lint` - Run linting

#### Production
- `npm run build:production` - Build for production
- `npm run start:production` - Start production servers
- `npm run validate` - Run type checking, linting, and tests
- `npm run typecheck` - Run TypeScript type checking

### Performance Optimizations

This project includes several performance optimizations:

- **Bundle Size**: Next.js optimizations, webpack bundle analyzer
- **Image Loading**: Lazy loading, progressive loading, optimized image component
- **API Response**: LLM response caching, rate limiting, compression
- **Security**: Helmet security headers, CORS configuration, CSP
- **Monitoring**: Health checks, performance logging, memory monitoring

## Features

- Natural language to Draw.io diagram generation
- PNG preview generation
- Downloadable .drawio files
- Japanese language support
- No authentication required

## Technology Stack

- **Frontend**: React, Next.js, TypeScript
- **Backend**: Node.js, mastra framework, TypeScript
- **AI**: Claude LLM for natural language processing
- **Diagram Generation**: Draw.io CLI for PNG conversion