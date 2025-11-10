#!/bin/bash
# Run user preferences migration
# This script runs the migration to create the user_preferences table

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Running user preferences migration...${NC}"

# Get database URL from environment or use default
DATABASE_URL="${DATABASE_URL:-postgresql://reports_user@localhost:5432/reports_app_db}"

# Extract connection details from DATABASE_URL
if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+)$ ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
elif [[ $DATABASE_URL =~ postgresql://([^@]+)@([^:]+):([^/]+)/(.+)$ ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_HOST="${BASH_REMATCH[2]}"
    DB_PORT="${BASH_REMATCH[3]}"
    DB_NAME="${BASH_REMATCH[4]}"
else
    echo -e "${RED}Error: Could not parse DATABASE_URL${NC}"
    exit 1
fi

MIGRATION_FILE="migrations/add_user_preferences.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}Error: Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}Connecting to database: $DB_NAME on $DB_HOST:$DB_PORT${NC}"

# Try to run migration using psql
if command -v psql &> /dev/null; then
    if [ -n "$DB_PASS" ]; then
        export PGPASSWORD="$DB_PASS"
    fi
    
    if psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE"; then
        echo -e "${GREEN}✓ Migration completed successfully!${NC}"
        exit 0
    else
        echo -e "${RED}✗ Migration failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}psql not found. Please run the migration manually:${NC}"
    echo -e "${YELLOW}psql -h $DB_HOST -p ${DB_PORT:-5432} -U $DB_USER -d $DB_NAME -f $MIGRATION_FILE${NC}"
    echo ""
    echo -e "${YELLOW}Or connect to your database and run the SQL from: $MIGRATION_FILE${NC}"
    exit 1
fi


