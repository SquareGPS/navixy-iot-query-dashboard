#!/bin/bash
# Run migration on client database
# This script runs a migration file on a specified client database
# Usage: ./scripts/run-migration.sh <database_url> <migration_file>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_usage() {
    echo -e "${YELLOW}Usage: $0 <database_url> <migration_file>${NC}"
    echo ""
    echo "Example:"
    echo "  $0 postgresql://user:password@localhost:5432/mydb migrations/add_global_variables.sql"
    echo ""
    echo "This script runs migrations on the client database where user settings are stored."
    echo "The same credentials used for CLIENT_SETTINGS_DB_USER should have sufficient"
    echo "privileges to run the migration."
}

if [ -z "$1" ] || [ -z "$2" ]; then
    print_usage
    exit 1
fi

DATABASE_URL="$1"
MIGRATION_FILE="$2"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}Error: Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}Running migration: $MIGRATION_FILE${NC}"

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
    echo -e "${YELLOW}Expected format: postgresql://user:password@host:port/database${NC}"
    exit 1
fi

echo -e "${YELLOW}Connecting to database: $DB_NAME on $DB_HOST:$DB_PORT as $DB_USER${NC}"

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
