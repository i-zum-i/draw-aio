# AI Diagram Generator Deployment Script for Windows

param(
    [switch]$SkipBuild = $false,
    [switch]$SkipHealthCheck = $false
)

Write-Host "🚀 Starting deployment process..." -ForegroundColor Green

# Check if required environment variables are set
if (-not $env:ANTHROPIC_API_KEY) {
    Write-Host "❌ Error: ANTHROPIC_API_KEY environment variable is required" -ForegroundColor Red
    exit 1
}

try {
    if (-not $SkipBuild) {
        # Build production images
        Write-Host "🔨 Building production Docker images..." -ForegroundColor Yellow
        docker-compose -f docker-compose.prod.yml build --no-cache
        if ($LASTEXITCODE -ne 0) {
            throw "Docker build failed"
        }
    }

    # Stop existing containers
    Write-Host "🛑 Stopping existing containers..." -ForegroundColor Yellow
    docker-compose -f docker-compose.prod.yml down

    # Start new containers
    Write-Host "▶️ Starting new containers..." -ForegroundColor Yellow
    docker-compose -f docker-compose.prod.yml up -d
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to start containers"
    }

    if (-not $SkipHealthCheck) {
        # Wait for services to be healthy
        Write-Host "🏥 Waiting for services to be healthy..." -ForegroundColor Yellow
        $timeout = 120
        $elapsed = 0
        
        do {
            Start-Sleep -Seconds 5
            $elapsed += 5
            $status = docker-compose -f docker-compose.prod.yml ps --format json | ConvertFrom-Json
            $healthy = $status | Where-Object { $_.Health -eq "healthy" }
        } while ($healthy.Count -lt 2 -and $elapsed -lt $timeout)

        if ($elapsed -ge $timeout) {
            Write-Host "⚠️ Timeout waiting for services to be healthy" -ForegroundColor Yellow
        }

        # Run health checks
        Write-Host "🔍 Running health checks..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10

        # Check backend health
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8001/health" -UseBasicParsing -TimeoutSec 10
            if ($response.StatusCode -eq 200) {
                Write-Host "✅ Backend is healthy" -ForegroundColor Green
            } else {
                throw "Backend returned status code $($response.StatusCode)"
            }
        } catch {
            Write-Host "❌ Backend health check failed: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "Backend logs:" -ForegroundColor Yellow
            docker-compose -f docker-compose.prod.yml logs backend
            exit 1
        }

        # Check frontend health
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8000" -UseBasicParsing -TimeoutSec 10
            if ($response.StatusCode -eq 200) {
                Write-Host "✅ Frontend is healthy" -ForegroundColor Green
            } else {
                throw "Frontend returned status code $($response.StatusCode)"
            }
        } catch {
            Write-Host "❌ Frontend health check failed: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "Frontend logs:" -ForegroundColor Yellow
            docker-compose -f docker-compose.prod.yml logs frontend
            exit 1
        }
    }

    Write-Host "🎉 Deployment completed successfully!" -ForegroundColor Green
    Write-Host "📊 Frontend: http://localhost:8000" -ForegroundColor Cyan
    Write-Host "🔧 Backend API: http://localhost:8001" -ForegroundColor Cyan
    Write-Host "💊 Health check: http://localhost:8001/health" -ForegroundColor Cyan

} catch {
    Write-Host "❌ Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Showing container logs..." -ForegroundColor Yellow
    docker-compose -f docker-compose.prod.yml logs
    exit 1
}