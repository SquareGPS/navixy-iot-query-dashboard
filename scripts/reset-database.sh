#!/bin/bash

# Reset Database Script
# Drops and recreates the reports_app_db database using init-db.sql

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
if [ ! -f "init-db.sql" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_status "Resetting database..."

# Check if Docker PostgreSQL container is running
if docker ps --format "{{.Names}}" | grep -q "^sql-report-postgres$"; then
    print_status "Detected Docker PostgreSQL container"
    USE_DOCKER=true
    DB_USER="${POSTGRES_USER:-danilnezhdanov}"
    DB_NAME="${POSTGRES_DB:-reports_app_db}"
    CONTAINER_NAME="sql-report-postgres"
else
    print_status "Using local PostgreSQL"
    USE_DOCKER=false
    DB_USER="${POSTGRES_USER:-danilnezhdanov}"
    DB_NAME="${POSTGRES_DB:-reports_app_db}"
fi

# Confirm before proceeding
print_warning "This will DELETE all data in the database!"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    print_status "Operation cancelled"
    exit 0
fi

if [ "$USE_DOCKER" = true ]; then
    print_status "Dropping database in Docker container..."
    docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" || {
        print_error "Failed to drop database"
        exit 1
    }
    
    print_status "Creating new database..."
    docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;" || {
        print_error "Failed to create database"
        exit 1
    }
    
    print_status "Running init-db.sql..."
    docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" < init-db.sql || {
        print_error "Failed to run init-db.sql"
        exit 1
    }
    
    print_success "Database reset complete!"
    print_status "Running migrations..."
    
    # Run migrations if they exist
    if [ -d "migrations" ]; then
        for migration in migrations/*.sql; do
            if [ -f "$migration" ] && [ "$(basename "$migration")" != "README_GLOBAL_VARIABLES.md" ]; then
                print_status "Running migration: $(basename "$migration")"
                docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" < "$migration" || {
                    print_warning "Migration $(basename "$migration") failed or already applied"
                }
            fi
        done
    fi
else
    # Check if PostgreSQL is running locally
    if ! pg_isready -h localhost -p 5432 &> /dev/null; then
        print_error "PostgreSQL is not running. Please start PostgreSQL first."
        exit 1
    fi
    
    print_status "Dropping database..."
    dropdb -U "$DB_USER" "$DB_NAME" 2>/dev/null || {
        print_warning "Database may not exist, continuing..."
    }
    
    print_status "Creating new database..."
    createdb -U "$DB_USER" "$DB_NAME" || {
        print_error "Failed to create database"
        exit 1
    }
    
    print_status "Running init-db.sql..."
    psql -U "$DB_USER" -d "$DB_NAME" -f init-db.sql || {
        print_error "Failed to run init-db.sql"
        exit 1
    }
    
    print_success "Database reset complete!"
    print_status "Running migrations..."
    
    # Run migrations if they exist
    if [ -d "migrations" ]; then
        for migration in migrations/*.sql; do
            if [ -f "$migration" ] && [ "$(basename "$migration")" != "README_GLOBAL_VARIABLES.md" ]; then
                print_status "Running migration: $(basename "$migration")"
                psql -U "$DB_USER" -d "$DB_NAME" -f "$migration" || {
                    print_warning "Migration $(basename "$migration") failed or already applied"
                }
            fi
        done
    fi
fi

print_success "Database reset and initialized successfully! 🎉"
print_status "Default admin credentials:"
print_status "  Email: admin@example.com"
print_status "  Password: admin123"

