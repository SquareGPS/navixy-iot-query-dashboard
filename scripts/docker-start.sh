#!/bin/bash

# Docker Compose Startup Script
# Ensures .env file exists with required variables before starting Docker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_status "Checking Docker environment setup..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating from .env.example..."
    
    if [ ! -f ".env.example" ]; then
        print_error ".env.example file not found. Cannot create .env file."
        exit 1
    fi
    
    cp .env.example .env
    
    # Generate JWT_SECRET if not set
    if ! grep -q "^JWT_SECRET=.*[^=]$" .env || grep -q "^JWT_SECRET=$" .env; then
        print_status "Generating secure JWT_SECRET..."
        JWT_SECRET=$(openssl rand -hex 32)
        
        # Update .env file with generated JWT_SECRET
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
        else
            # Linux
            sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
        fi
        
        print_success "Generated JWT_SECRET"
    fi
    
    print_success "Created .env file"
else
    print_status ".env file exists"
    
    # Check if JWT_SECRET is set
    if ! grep -q "^JWT_SECRET=.*[^=]$" .env || grep -q "^JWT_SECRET=$" .env; then
        print_warning "JWT_SECRET is not set in .env file. Generating..."
        JWT_SECRET=$(openssl rand -hex 32)
        
        # Update .env file with generated JWT_SECRET
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
        else
            # Linux
            sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
        fi
        
        print_success "Generated JWT_SECRET"
    else
        print_success "JWT_SECRET is set"
    fi
fi

# Validate that JWT_SECRET is now set
if ! grep -q "^JWT_SECRET=.*[^=]$" .env; then
    print_error "JWT_SECRET is still not set. Please check .env file."
    exit 1
fi

print_success "Environment setup complete!"
echo ""

# Check if Docker is running
if ! docker info &> /dev/null; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Now run docker-compose with the provided arguments
print_status "Starting Docker Compose..."
docker compose "$@"

