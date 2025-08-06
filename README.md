# AI Diagram Generator

An AI-powered web application that automatically generates Draw.io format diagrams from natural language descriptions.

## Project Overview

This system allows users to generate editable .drawio files and PNG images simply by describing diagram content in natural language. Leveraging large language models (Claude), it interprets user intentions and generates appropriate visual representations, significantly reducing the time and effort required to create business and technical diagrams.

### Key Features

- **Natural Language Input**: Generate diagrams by describing content in natural language
- **Instant Preview**: View generated PNG images immediately in the browser
- **Editable Files**: Download .drawio files that can be opened and edited in Draw.io
- **No Login Required**: Anyone can use it immediately without authentication
- **Responsive Design**: Works on PC, tablet, and smartphone

## Project Structure

TypeScript monorepo structure with integrated frontend and backend management:

```
draw-aio/
├── packages/
│   ├── backend/                    # Express.js API server
│   │   ├── src/
│   │   │   ├── controllers/        # API endpoints
│   │   │   ├── services/           # Business logic
│   │   │   │   ├── llmService.ts   # Claude LLM integration
│   │   │   │   ├── fileService.ts  # File management
│   │   │   │   └── imageService.ts # PNG image generation
│   │   │   ├── middleware/         # Performance & security
│   │   │   ├── types/              # TypeScript type definitions
│   │   │   └── utils/              # Utility functions
│   │   └── package.json
│   └── frontend/                   # Next.js React app
│       ├── src/
│       │   ├── app/                # Next.js App Router
│       │   ├── components/         # React components
│       │   │   ├── MainPage.tsx    # Main screen
│       │   │   ├── InputForm.tsx   # Input form
│       │   │   ├── ResultDisplay.tsx # Result display
│       │   │   └── ErrorMessage.tsx  # Error handling
│       │   ├── hooks/              # Custom hooks
│       │   ├── types/              # TypeScript type definitions
│       │   └── utils/              # Utility functions
│       └── package.json
├── scripts/                        # Deployment scripts
├── docker-compose.yml              # Development Docker settings
├── docker-compose.prod.yml         # Production Docker settings
├── Dockerfile                      # Multi-stage Docker build
└── nginx.conf                      # Reverse proxy settings
```

## Technology Stack

### Frontend
- **React 18** - UI library
- **Next.js 14** - React framework (using App Router)
- **TypeScript** - Type-safe development
- **CSS-in-JS** - Styling (using styled-jsx)

### Backend
- **Node.js 18+** - Server runtime
- **Express.js** - Web framework
- **TypeScript** - Type-safe development

### AI & Diagram Generation
- **Claude (Anthropic)** - Natural language processing & XML generation
- **Draw.io CLI** - PNG image conversion
- **Zod** - Data validation

### Infrastructure & Deployment
- **Docker & Docker Compose** - Containerization
- **Nginx** - Reverse proxy & load balancer
- **Jest** - Testing framework

## Development Environment Setup

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- Draw.io CLI (for PNG conversion)
- Docker & Docker Compose (for production environment)

### Installation Steps

1. **Clone the repository**:
```bash
git clone <repository-url>
cd draw-aio
```

2. **Install dependencies**:
```bash
npm install
npm install --workspaces
```

3. **Set up environment variables**:
```bash
# Backend environment variables
cp packages/backend/.env.example packages/backend/.env
# Edit packages/backend/.env to set ANTHROPIC_API_KEY

# Frontend environment variables
cp packages/frontend/.env.example packages/frontend/.env
```

4. **Install Draw.io CLI**:
```bash
npm install -g @drawio/drawio-desktop-cli
```

5. **Start development server**:
```bash
npm run dev
```

The application will be accessible at the following URLs:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### Individual Startup

```bash
# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend
```

## Build and Testing

### Development Build
```bash
npm run build
```

### Production Build
```bash
npm run build:production
```

### Running Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Production Deployment

### Docker Deployment

1. **Production environment setup**:
```bash
# Linux/Mac
./scripts/setup-production.sh

# Windows
.\scripts\setup-production.ps1
```

2. **Configure environment variables**:
```bash
# Edit .env file
ANTHROPIC_API_KEY=your_actual_api_key
FRONTEND_URL=https://your-domain.com
NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

3. **Execute deployment**:
```bash
# Linux/Mac
./scripts/deploy.sh

# Windows
.\scripts\deploy.ps1
```

### Available Scripts

#### Development
- `npm run dev` - Start development server
- `npm run build` - Development build
- `npm run test` - Run tests
- `npm run lint` - Run linting

#### Production
- `npm run build:production` - Production build
- `npm run start:production` - Start production server
- `npm run validate` - Run type checking, linting, and tests together
- `npm run typecheck` - TypeScript type checking

## Performance Optimization

This project includes the following optimization features:

### Frontend Optimization
- **Bundle Size Optimization**: Next.js optimization features, webpack bundle analyzer
- **Image Loading Optimization**: Lazy loading, progressive loading, optimized image components
- **Responsive Design**: Mobile-first design

### Backend Optimization
- **API Response Optimization**: LLM response caching, rate limiting, compression
- **Performance Monitoring**: Response time measurement, memory usage monitoring
- **Error Handling**: Comprehensive error handling and user-friendly messages

### Security
- **Security Headers**: Helmet, CORS, CSP configuration
- **Rate Limiting**: API call restrictions
- **Input Validation**: Data validation with Zod

### Monitoring & Logging
- **Health Checks**: Service status monitoring
- **Performance Logs**: Processing time and error rate recording
- **Memory Monitoring**: Memory usage tracking

## System Features

### Core Features

1. **Diagram Creation Input**
   - Natural language diagram content input
   - Real-time input validation
   - Processing status visualization

2. **AI Diagram Generation**
   - Natural language interpretation by Claude LLM
   - Draw.io compatible XML generation
   - Error handling and retry functionality

3. **Image Preview**
   - Instant PNG image generation and display
   - Optimized image loading
   - Responsive image display

4. **File Download**
   - Editable .drawio file provision
   - Secure download via temporary URL generation
   - File management and cleanup

### Supported Diagram Types

- Flowcharts
- Organization charts
- System architecture diagrams
- Network diagrams
- ER diagrams
- UML diagrams
- Mind maps
- Other business diagrams

## API Specification

### Diagram Generation API

**Endpoint**: `POST /api/generate-diagram`

**Request**:
```json
{
  "prompt": "Natural language description of the diagram to create"
}
```

**Success Response**:
```json
{
  "status": "success",
  "imageUrl": "URL of the generated PNG image",
  "downloadUrl": "Download URL of the generated .drawio file",
  "message": "Diagram generated successfully"
}
```

**Error Response**:
```json
{
  "status": "error",
  "message": "Detailed error description",
  "code": "ERROR_CODE"
}
```

## Troubleshooting

### Common Issues

1. **Draw.io CLI not found**
   ```bash
   npm install -g @drawio/drawio-desktop-cli
   ```

2. **ANTHROPIC_API_KEY not configured**
   - Set the API key in the `packages/backend/.env` file

3. **Port already in use**
   - Default ports (3000, 3001) can be changed via environment variables if in use

4. **Docker-related issues**
   - Ensure Docker Desktop is running
   - Stop existing containers with `docker-compose down`

## License

This project is released under the MIT License.

## Contributing

Pull requests and issue reports are welcome. Before participating in development, please run:

```bash
npm run validate  # Run type checking, linting, and tests
```

## Support

For technical questions and bug reports, please use the GitHub Issues page.

## Language Support

- **English**: This README
- **Japanese**: See [README_ja.md](./README_ja.md) for Japanese documentation