#!/bin/bash
# PostgreSQL Database Backup Script for Fitness Tracker
# This script creates encrypted backups and uploads them to S3

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/backup}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS="${RETENTION_DAYS:-7}"

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
GPG_RECIPIENT="${GPG_RECIPIENT:-}"
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

# Logging
LOG_LEVEL="${LOG_LEVEL:-INFO}"

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check required commands
    for cmd in pg_dump aws gpg; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "$cmd is required but not installed"
            exit 1
        fi
    done
    
    # Check database connection
    if ! PGPASSWORD="$DB_PASSWORD" pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" &> /dev/null; then
        log_error "Cannot connect to database $DB_HOST:$DB_PORT"
        exit 1
    fi
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    log_success "Prerequisites check passed"
}

# Create database backup
create_database_backup() {
    local backup_file="$1"
    
    log_info "Creating database backup: $backup_file"
    
    # Set PostgreSQL password
    export PGPASSWORD="$DB_PASSWORD"
    
    # Create backup with compression
    pg_dump \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --no-password \
        --verbose \
        --clean \
        --if-exists \
        --create \
        --format=custom \
        --compress=9 \
        --file="$backup_file" \
        --exclude-table-data=audit.activity_log
    
    # Verify backup file was created
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file was not created: $backup_file"
        exit 1
    fi
    
    local backup_size
    backup_size=$(du -h "$backup_file" | cut -f1)
    log_success "Database backup created: $backup_file ($backup_size)"
}

# Encrypt backup
encrypt_backup() {
    local backup_file="$1"
    local encrypted_file="${backup_file}.gpg"
    
    if [[ -n "$GPG_RECIPIENT" ]]; then
        log_info "Encrypting backup with GPG..."
        gpg --trust-model always --encrypt --recipient "$GPG_RECIPIENT" --output "$encrypted_file" "$backup_file"
        
        # Remove unencrypted file
        rm "$backup_file"
        echo "$encrypted_file"
    elif [[ -n "$BACKUP_ENCRYPTION_KEY" ]]; then
        log_info "Encrypting backup with symmetric key..."
        gpg --symmetric --cipher-algo AES256 --compress-algo 1 --s2k-mode 3 \
            --s2k-digest-algo SHA512 --s2k-count 65011712 \
            --passphrase "$BACKUP_ENCRYPTION_KEY" --batch --yes \
            --output "$encrypted_file" "$backup_file"
        
        # Remove unencrypted file
        rm "$backup_file"
        echo "$encrypted_file"
    else
        log_warn "No encryption configured, backup will be stored unencrypted"
        echo "$backup_file"
    fi
}

# Upload to S3
upload_to_s3() {
    local backup_file="$1"
    local s3_key="${S3_PREFIX}/$(basename "$backup_file")"
    
    if [[ -n "$S3_BUCKET" ]]; then
        log_info "Uploading backup to S3: s3://${S3_BUCKET}/${s3_key}"
        
        aws s3 cp "$backup_file" "s3://${S3_BUCKET}/${s3_key}" \
            --region "$AWS_REGION" \
            --storage-class STANDARD_IA \
            --server-side-encryption AES256
        
        log_success "Backup uploaded to S3"
    else
        log_warn "S3_BUCKET not configured, skipping upload"
    fi
}

# Clean old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than $RETENTION_DAYS days..."
    
    # Local cleanup
    find "$BACKUP_DIR" -name "fitness_tracker_backup_*.sql*" -type f -mtime "+$RETENTION_DAYS" -delete
    
    # S3 cleanup
    if [[ -n "$S3_BUCKET" ]]; then
        local cutoff_date
        cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d)
        
        aws s3api list-objects-v2 \
            --bucket "$S3_BUCKET" \
            --prefix "$S3_PREFIX/" \
            --query "Contents[?LastModified<='$cutoff_date'].Key" \
            --output text | \
        while read -r key; do
            if [[ -n "$key" && "$key" != "None" ]]; then
                log_info "Deleting old backup: s3://${S3_BUCKET}/${key}"
                aws s3 rm "s3://${S3_BUCKET}/${key}"
            fi
        done
    fi
    
    log_success "Old backups cleaned up"
}

# Send notification
send_notification() {
    local status="$1"
    local message="$2"
    
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color="good"
        local icon=":white_check_mark:"
        
        if [[ "$status" != "success" ]]; then
            color="danger"
            icon=":x:"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"${icon} Database Backup - $status\",
                    \"text\": \"$message\",
                    \"footer\": \"$(hostname)\",
                    \"ts\": $(date +%s)
                }]
            }" \
            "$SLACK_WEBHOOK_URL" &> /dev/null || log_warn "Failed to send Slack notification"
    fi
    
    if [[ -n "${DISCORD_WEBHOOK_URL:-}" ]]; then
        local embed_color=3066993  # Green
        if [[ "$status" != "success" ]]; then
            embed_color=15158332  # Red
        fi
        
        curl -X POST -H "Content-Type: application/json" \
            --data "{
                \"embeds\": [{
                    \"title\": \"Database Backup - $status\",
                    \"description\": \"$message\",
                    \"color\": $embed_color,
                    \"footer\": {\"text\": \"$(hostname)\"},
                    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"
                }]
            }" \
            "$DISCORD_WEBHOOK_URL" &> /dev/null || log_warn "Failed to send Discord notification"
    fi
}

# Create backup metadata
create_metadata() {
    local backup_file="$1"
    local metadata_file="${backup_file}.metadata.json"
    
    cat > "$metadata_file" << EOF
{
    "timestamp": "$TIMESTAMP",
    "database": {
        "host": "$DB_HOST",
        "port": "$DB_PORT",
        "name": "$DB_NAME",
        "user": "$DB_USER"
    },
    "backup": {
        "file": "$(basename "$backup_file")",
        "size": $(stat -c%s "$backup_file"),
        "checksum": "$(sha256sum "$backup_file" | cut -d' ' -f1)"
    },
    "environment": {
        "hostname": "$(hostname)",
        "kubernetes_namespace": "${KUBERNETES_NAMESPACE:-unknown}",
        "kubernetes_pod": "${HOSTNAME:-unknown}"
    }
}
EOF
    
    log_info "Metadata created: $metadata_file"
}

# Main execution
main() {
    log_info "Starting database backup process..."
    
    local backup_file="$BACKUP_DIR/fitness_tracker_backup_$TIMESTAMP.sql"
    local final_backup_file
    
    trap 'log_error "Backup process failed"; send_notification "failed" "Database backup process failed at $(date)"; exit 1' ERR
    
    # Execute backup steps
    check_prerequisites
    create_database_backup "$backup_file"
    create_metadata "$backup_file"
    final_backup_file=$(encrypt_backup "$backup_file")
    upload_to_s3 "$final_backup_file"
    cleanup_old_backups
    
    local backup_size
    backup_size=$(du -h "$final_backup_file" | cut -f1)
    
    log_success "Backup process completed successfully!"
    log_info "Final backup file: $final_backup_file ($backup_size)"
    
    send_notification "success" "Database backup completed successfully at $(date). File: $(basename "$final_backup_file") ($backup_size)"
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi