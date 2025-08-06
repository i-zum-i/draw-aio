# Production Environment Setup Script for Windows

Write-Host "🔧 Setting up production environment..." -ForegroundColor Green

try {
    # Create necessary directories
    Write-Host "📁 Creating directories..." -ForegroundColor Yellow
    $directories = @("logs", "ssl", "temp", "backups")
    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Host "Created directory: $dir" -ForegroundColor Gray
        }
    }

    # Copy environment files if they don't exist
    if (-not (Test-Path ".env")) {
        Write-Host "📝 Creating .env file from template..." -ForegroundColor Yellow
        Copy-Item ".env.example" ".env"
        Write-Host "⚠️  Please edit .env file with your production values" -ForegroundColor Yellow
    }

    if (-not (Test-Path "packages/backend/.env")) {
        Write-Host "📝 Creating backend .env file from template..." -ForegroundColor Yellow
        Copy-Item "packages/backend/.env.example" "packages/backend/.env"
        Write-Host "⚠️  Please edit packages/backend/.env file with your production values" -ForegroundColor Yellow
    }

    if (-not (Test-Path "packages/frontend/.env")) {
        Write-Host "📝 Creating frontend .env file from template..." -ForegroundColor Yellow
        Copy-Item "packages/frontend/.env.example" "packages/frontend/.env"
        Write-Host "⚠️  Please edit packages/frontend/.env file with your production values" -ForegroundColor Yellow
    }

    # Install dependencies
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm run install:all
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to install dependencies"
    }

    # Build applications
    Write-Host "🔨 Building applications..." -ForegroundColor Yellow
    npm run build:production
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to build applications"
    }

    # Run tests
    Write-Host "🧪 Running tests..." -ForegroundColor Yellow
    npm run test
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️ Some tests failed, but continuing..." -ForegroundColor Yellow
    }

    # Run linting
    Write-Host "🔍 Running linting..." -ForegroundColor Yellow
    npm run lint
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️ Linting issues found, but continuing..." -ForegroundColor Yellow
    }

    Write-Host "✅ Production environment setup completed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Edit .env files with your production values" -ForegroundColor White
    Write-Host "2. Configure SSL certificates in ./ssl/ directory" -ForegroundColor White
    Write-Host "3. Review nginx.conf for your domain settings" -ForegroundColor White
    Write-Host "4. Run deployment script: .\scripts\deploy.ps1" -ForegroundColor White

} catch {
    Write-Host "❌ Setup failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}