#!/bin/bash
# PostgreSQL Database Restore Script for Fitness Tracker
# This script restores encrypted backups from local storage or S3

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/backup}"

# Database configuration
DB_HOST="${DB_HOST:-postgres-service}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-fitness_tracker}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"

# S3 configuration
S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-backups/database}"
AWS_REGION="${AWS_REGION:-us-west-2}"

# Encryption
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    local level="$1"
    shift
    local message="$*"
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] [${level}] ${message}" >&2
}

log_info() {
    log "INFO" "$@"
}

log_warn() {
    log "WARN" "${YELLOW}$*${NC}"
}

log_error() {
    log "ERROR" "${RED}$*${NC}"
}

log_success() {
    log "SUCCESS" "${GREEN}$*${NC}"
}

# Usage information
usage() {
    cat << EOF
Usage: $0 [OPTIONS] BACKUP_FILE_OR_TIMESTAMP

Restore PostgreSQL database from backup.

OPTIONS:
    -h, --help                Show this help message
    -f, --from-s3             Download backup from S3
    -l, --list                List available backups
    -y, --yes                 Assume yes for all prompts
    --dry-run                 Show what would be restored without doing it
    --target-db DB_NAME       Target database name (default: $DB_NAME)
    --no-create-db            Don't create database, restore to existing one

EXAMPLES:
    $0 20231215_143000                    # Restore from local backup with timestamp
    $0 -f 20231215_143000                 # Download from S3 and restore
    $0 /path/to/backup.sql.gpg            # Restore from specific file
    $0 -l                                 # List available backups
    $0 --dry-run backup.sql               # Show what would be restored

ENVIRONMENT VARIABLES:
    DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
    S3_BUCKET, S3_PREFIX, AWS_REGION
    BACKUP_ENCRYPTION_KEY

EOF
}

# Parse command line arguments
ASSUME_YES=false
FROM_S3=false
LIST_BACKUPS=false
DRY_RUN=false
CREATE_DB=true
TARGET_DB="$DB_NAME"
BACKUP_INPUT=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        -f|--from-s3)
            FROM_S3=true
            shift
            ;;
        -l|--list)
            LIST_BACKUPS=true
            shift
            ;;
        -y|--yes)
            ASSUME_YES=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --target-db)
            TARGET_DB="$2"
            shift 2
            ;;
        --no-create-db)
            CREATE_DB=false
            shift
            ;;
        -*)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
        *)
            BACKUP_INPUT="$1"
            shift
            ;;
    esac
done

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check required commands
    for cmd in pg_restore psql aws gpg; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "$cmd is required but not installed"
            exit 1
        fi
    done
    
    # Check database connection
    if ! PGPASSWORD="$DB_PASSWORD" pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" &> /dev/null; then
        log_error "Cannot connect to PostgreSQL server $DB_HOST:$DB_PORT"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# List available backups
list_backups() {
    log_info "Available backups:"
    
    echo -e "\n${BLUE}Local backups:${NC}"
    if [[ -d "$BACKUP_DIR" ]]; then
        find "$BACKUP_DIR" -name "fitness_tracker_backup_*.sql*" -type f -printf "%T@ %Tc %s %p\n" | \
        sort -nr | \
        while read -r timestamp date time timezone size file; do
            local size_human
            size_human=$(numfmt --to=iec-i --suffix=B "$size")
            echo "  $(basename "$file") - $date $time ($size_human)"
        done
    else
        echo "  No local backup directory found"
    fi
    
    if [[ -n "$S3_BUCKET" ]]; then
        echo -e "\n${BLUE}S3 backups:${NC}"
        aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" --recursive --human-readable | \
        grep "fitness_tracker_backup_" | \
        tail -20 | \
        while read -r date time size file; do
            echo "  $(basename "$file") - $date $time ($size)"
        done
    fi
    
    echo ""
}

# Download backup from S3
download_from_s3() {
    local backup_identifier="$1"
    local local_file
    
    # If it's a timestamp, construct filename
    if [[ "$backup_identifier" =~ ^[0-9]{8}_[0-9]{6}$ ]]; then
        local_file="$BACKUP_DIR/fitness_tracker_backup_${backup_identifier}.sql.gpg"
        local s3_key="${S3_PREFIX}/fitness_tracker_backup_${backup_identifier}.sql.gpg"
    else
        local_file="$BACKUP_DIR/$(basename "$backup_identifier")"
        local s3_key="${S3_PREFIX}/$(basename "$backup_identifier")"
    fi
    
    log_info "Downloading backup from S3: s3://${S3_BUCKET}/${s3_key}"
    
    mkdir -p "$BACKUP_DIR"
    
    if aws s3 cp "s3://${S3_BUCKET}/${s3_key}" "$local_file" --region "$AWS_REGION"; then
        log_success "Backup downloaded: $local_file"
        echo "$local_file"
    else
        log_error "Failed to download backup from S3"
        exit 1
    fi
}

# Decrypt backup
decrypt_backup() {
    local encrypted_file="$1"
    local decrypted_file="${encrypted_file%.gpg}"
    
    if [[ "$encrypted_file" == *.gpg ]]; then
        log_info "Decrypting backup: $encrypted_file"
        
        if [[ -n "$BACKUP_ENCRYPTION_KEY" ]]; then
            gpg --quiet --batch --yes --decrypt --passphrase "$BACKUP_ENCRYPTION_KEY" \
                --output "$decrypted_file" "$encrypted_file"
        else
            gpg --quiet --decrypt --output "$decrypted_file" "$encrypted_file"
        fi
        
        if [[ -f "$decrypted_file" ]]; then
            log_success "Backup decrypted: $decrypted_file"
            echo "$decrypted_file"
        else
            log_error "Failed to decrypt backup"
            exit 1
        fi
    else
        # Not encrypted
        echo "$encrypted_file"
    fi
}

# Verify backup
verify_backup() {
    local backup_file="$1"
    
    log_info "Verifying backup file: $backup_file"
    
    # Check if file exists and is not empty
    if [[ ! -f "$backup_file" ]] || [[ ! -s "$backup_file" ]]; then
        log_error "Backup file does not exist or is empty: $backup_file"
        exit 1
    fi
    
    # Check if it's a valid PostgreSQL custom format dump
    if ! pg_restore --list "$backup_file" &> /dev/null; then
        log_error "Invalid PostgreSQL backup format: $backup_file"
        exit 1
    fi
    
    local backup_size
    backup_size=$(du -h "$backup_file" | cut -f1)
    log_success "Backup file is valid ($backup_size)"
}

# Create database if needed
create_database() {
    local db_name="$1"
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Check if database exists
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$db_name"; then
        log_warn "Database '$db_name' already exists"
        
        if [[ "$ASSUME_YES" != true ]]; then
            read -p "Do you want to drop and recreate the database? [y/N] " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_info "Skipping database recreation"
                return
            fi
        fi
        
        log_info "Dropping existing database: $db_name"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $db_name;"
    fi
    
    log_info "Creating database: $db_name"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $db_name;"
}

# Restore database
restore_database() {
    local backup_file="$1"
    local target_db="$2"
    
    export PGPASSWORD="$DB_PASSWORD"
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "DRY RUN: Would restore $backup_file to database $target_db"
        
        echo -e "\n${BLUE}Backup contents:${NC}"
        pg_restore --list "$backup_file" | head -20
        
        echo -e "\n${BLUE}Database objects that would be restored:${NC}"
        pg_restore --list "$backup_file" | grep -E "^[0-9]+" | wc -l
        echo " objects total"
        
        return
    fi
    
    log_info "Restoring database from: $backup_file"
    log_info "Target database: $target_db"
    
    # Perform the restore
    pg_restore \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$target_db" \
        --no-password \
        --verbose \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges \
        --jobs=4 \
        "$backup_file"
    
    log_success "Database restore completed"
}

# Validate restored data
validate_restore() {
    local target_db="$1"
    
    export PGPASSWORD="$DB_PASSWORD"
    
    log_info "Validating restored data..."
    
    # Check if main tables exist and have data
    local tables=("users" "exercises" "workouts" "sets")
    
    for table in "${tables[@]}"; do
        local count
        count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$target_db" -tAc "SELECT COUNT(*) FROM app.$table;" 2>/dev/null || echo "0")
        
        if [[ "$count" -gt 0 ]]; then
            log_success "Table app.$table: $count records"
        else
            log_warn "Table app.$table: no data or table doesn't exist"
        fi
    done
    
    # Check database size
    local db_size
    db_size=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$target_db" -tAc "SELECT pg_size_pretty(pg_database_size('$target_db'));" 2>/dev/null || echo "unknown")
    log_info "Database size: $db_size"
}

# Find backup file
find_backup_file() {
    local input="$1"
    
    # If it's a full path, use as-is
    if [[ -f "$input" ]]; then
        echo "$input"
        return
    fi
    
    # If it's a timestamp, construct filename
    if [[ "$input" =~ ^[0-9]{8}_[0-9]{6}$ ]]; then
        local file="$BACKUP_DIR/fitness_tracker_backup_${input}.sql"
        local encrypted_file="${file}.gpg"
        
        if [[ -f "$encrypted_file" ]]; then
            echo "$encrypted_file"
            return
        elif [[ -f "$file" ]]; then
            echo "$file"
            return
        fi
    fi
    
    # Try to find in backup directory
    local file="$BACKUP_DIR/$input"
    if [[ -f "$file" ]]; then
        echo "$file"
        return
    fi
    
    log_error "Backup file not found: $input"
    exit 1
}

# Main execution
main() {
    if [[ "$LIST_BACKUPS" == true ]]; then
        list_backups
        exit 0
    fi
    
    if [[ -z "$BACKUP_INPUT" ]]; then
        log_error "No backup file or timestamp specified"
        usage
        exit 1
    fi
    
    log_info "Starting database restore process..."
    
    check_prerequisites
    
    local backup_file
    if [[ "$FROM_S3" == true ]]; then
        backup_file=$(download_from_s3 "$BACKUP_INPUT")
    else
        backup_file=$(find_backup_file "$BACKUP_INPUT")
    fi
    
    local decrypted_file
    decrypted_file=$(decrypt_backup "$backup_file")
    
    verify_backup "$decrypted_file"
    
    if [[ "$CREATE_DB" == true ]]; then
        create_database "$TARGET_DB"
    fi
    
    restore_database "$decrypted_file" "$TARGET_DB"
    
    if [[ "$DRY_RUN" != true ]]; then
        validate_restore "$TARGET_DB"
        log_success "Database restore completed successfully!"
    fi
    
    # Cleanup temporary decrypted file
    if [[ "$decrypted_file" != "$backup_file" ]]; then
        rm -f "$decrypted_file"
    fi
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi