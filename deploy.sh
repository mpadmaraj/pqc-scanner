#!/bin/bash

# PQC Scanner Deployment Script
# Universal deployment script for Docker, AWS, or local development

set -e

# Configuration
APP_NAME="pqc-scanner"
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-"secure_pqc_password_2024"}
SESSION_SECRET=${SESSION_SECRET:-"your_super_secure_session_secret_2024"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to deploy with Docker Compose
deploy_docker() {
    log "Starting Docker Compose deployment..."
    
    if ! command_exists docker; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    if ! command_exists docker-compose; then
        error "Docker Compose is not installed. Please install Docker Compose first."
    fi
    
    # Create .env file
    cat > .env << EOF
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
SESSION_SECRET=${SESSION_SECRET}
NODE_ENV=production
EOF
    
    log "Building and starting services..."
    docker-compose up -d --build
    
    log "Waiting for services to be ready..."
    sleep 30
    
    # Run database migrations
    log "Running database migrations..."
    docker-compose exec pqc-scanner npm run db:push
    
    log "Deployment completed! Application is available at http://localhost:5000"
}

# Function to deploy to AWS using Terraform
deploy_aws() {
    log "Starting AWS deployment with Terraform..."
    
    if ! command_exists terraform; then
        error "Terraform is not installed. Please install Terraform first."
    fi
    
    if ! command_exists aws; then
        error "AWS CLI is not installed. Please install AWS CLI first."
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity > /dev/null 2>&1; then
        error "AWS credentials not configured. Please run 'aws configure' first."
    fi
    
    cd terraform
    
    log "Initializing Terraform..."
    terraform init
    
    log "Planning deployment..."
    terraform plan
    
    read -p "Do you want to proceed with the deployment? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "Applying Terraform configuration..."
        terraform apply -auto-approve
        
        log "AWS deployment completed!"
        terraform output
    else
        log "Deployment cancelled."
    fi
    
    cd ..
}

# Function to deploy to Vercel
deploy_vercel() {
    log "Starting Vercel deployment..."
    
    if ! command_exists vercel; then
        error "Vercel CLI is not installed. Please install it with: npm install -g vercel"
    fi
    
    # Build the application
    log "Building application..."
    npm run build
    
    # Deploy to Vercel
    log "Deploying to Vercel..."
    vercel --prod
    
    log "Vercel deployment completed!"
    warn "Don't forget to:"
    warn "1. Set up a PostgreSQL database (Neon, Supabase, or AWS RDS)"
    warn "2. Configure environment variables in Vercel dashboard:"
    warn "   - DATABASE_URL"
    warn "   - SESSION_SECRET"
    warn "3. Run database migrations: npm run db:push"
}

# Function to set up local development
setup_local() {
    log "Setting up local development environment..."
    
    if ! command_exists node; then
        error "Node.js is not installed. Please install Node.js first."
    fi
    
    if ! command_exists npm; then
        error "npm is not installed. Please install npm first."
    fi
    
    # Install dependencies
    log "Installing dependencies..."
    npm install
    
    # Check if PostgreSQL is running
    if ! command_exists psql; then
        warn "PostgreSQL is not installed. You can either:"
        warn "1. Install PostgreSQL locally"
        warn "2. Use Docker: docker run --name pqc-postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:15"
        warn "3. Use a cloud database (Neon, Supabase, etc.)"
    fi
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        cat > .env << EOF
DATABASE_URL=postgresql://postgres:password@localhost:5432/pqc_scanner
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=password
PGDATABASE=pqc_scanner
SESSION_SECRET=${SESSION_SECRET}
NODE_ENV=development
EOF
        log "Created .env file with default values. Please update DATABASE_URL if needed."
    fi
    
    log "Local setup completed! Run 'npm run dev' to start the application."
}

# Function to show help
show_help() {
    echo "PQC Scanner Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  docker    Deploy using Docker Compose (recommended for local/server)"
    echo "  aws       Deploy to AWS using Terraform"
    echo "  vercel    Deploy to Vercel"
    echo "  local     Set up local development environment"
    echo "  help      Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  POSTGRES_PASSWORD  Password for PostgreSQL database"
    echo "  SESSION_SECRET     Secret for session management"
    echo ""
    echo "Examples:"
    echo "  $0 docker"
    echo "  POSTGRES_PASSWORD=mypass $0 docker"
    echo "  $0 aws"
    echo "  $0 vercel"
}

# Main script logic
case "${1:-help}" in
    docker)
        deploy_docker
        ;;
    aws)
        deploy_aws
        ;;
    vercel)
        deploy_vercel
        ;;
    local)
        setup_local
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        error "Unknown command: $1. Use '$0 help' for usage information."
        ;;
esac