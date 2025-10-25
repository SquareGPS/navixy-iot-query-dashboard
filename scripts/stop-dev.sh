#!/bin/bash

# SQL Report Dashboard - Stop Development Services
# This script stops all development services

echo "🛑 Stopping SQL Report Dashboard Development Services"
echo "=================================================="

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

# Stop backend and frontend processes
print_status "Stopping Node.js processes..."

# Kill processes by PID if they exist
if [ -f "scripts/backend.pid" ]; then
    BACKEND_PID=$(cat scripts/backend.pid)
    if kill -0 $BACKEND_PID 2>/dev/null; then
        kill $BACKEND_PID
        print_success "Stopped backend server (PID: $BACKEND_PID)"
    else
        print_warning "Backend process not running"
    fi
    rm -f scripts/backend.pid
fi

if [ -f "scripts/frontend.pid" ]; then
    FRONTEND_PID=$(cat scripts/frontend.pid)
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        kill $FRONTEND_PID
        print_success "Stopped frontend server (PID: $FRONTEND_PID)"
    else
        print_warning "Frontend process not running"
    fi
    rm -f scripts/frontend.pid
fi

# Kill any remaining processes
pkill -f "tsx watch" 2>/dev/null && print_success "Stopped remaining tsx processes" || true
pkill -f "vite" 2>/dev/null && print_success "Stopped remaining vite processes" || true

# Stop Redis container
print_status "Stopping Redis container..."
if docker ps -q -f name=redis-dev | grep -q .; then
    docker stop redis-dev
    docker rm redis-dev
    print_success "Stopped and removed Redis container"
else
    print_warning "Redis container not running"
fi

# Clean up any orphaned containers
docker container prune -f &>/dev/null || true

print_success "All development services stopped! 🛑"
