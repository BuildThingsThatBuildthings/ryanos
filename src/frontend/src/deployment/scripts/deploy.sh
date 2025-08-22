#!/bin/bash
# Deployment Script for Fitness Tracker Application
# Supports Docker Compose, Kubernetes, and Helm deployments

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Default values
ENVIRONMENT="${ENVIRONMENT:-development}"
DEPLOYMENT_TYPE="${DEPLOYMENT_TYPE:-docker-compose}"
NAMESPACE="${NAMESPACE:-fitness-tracker}"
HELM_RELEASE="${HELM_RELEASE:-fitness-tracker}"
KUBECONFIG_PATH="${KUBECONFIG_PATH:-}"
DRY_RUN=false
SKIP_BUILD=false
SKIP_TESTS=false
FORCE_RECREATE=false

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log() {
    local level="$1"
    shift
    local message="$*"
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] [${level}] ${message}" >&2
}

log_info() {
    log "INFO" "${BLUE}$*${NC}"
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

log_step() {
    log "STEP" "${PURPLE}$*${NC}"
}

# Usage information
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy Fitness Tracker application using various deployment methods.

OPTIONS:
    -h, --help                Show this help message
    -e, --environment ENV     Environment (development|staging|production) [default: development]
    -t, --type TYPE          Deployment type (docker-compose|kubernetes|helm) [default: docker-compose]
    -n, --namespace NS       Kubernetes namespace [default: fitness-tracker]
    -r, --release NAME       Helm release name [default: fitness-tracker]
    -k, --kubeconfig PATH    Path to kubeconfig file
    --dry-run                Show what would be deployed without doing it
    --skip-build             Skip building Docker images
    --skip-tests             Skip running tests
    --force-recreate         Force recreation of resources

EXAMPLES:
    $0                                              # Deploy with Docker Compose (development)
    $0 -e staging -t kubernetes                    # Deploy to staging with Kubernetes
    $0 -e production -t helm -r fitness-prod      # Deploy to production with Helm
    $0 --dry-run -e production                     # Dry run for production deployment

ENVIRONMENT VARIABLES:
    Various environment-specific variables can be set. See .env files for details.

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -t|--type)
            DEPLOYMENT_TYPE="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -r|--release)
            HELM_RELEASE="$2"
            shift 2
            ;;
        -k|--kubeconfig)
            KUBECONFIG_PATH="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --force-recreate)
            FORCE_RECREATE=true
            shift
            ;;
        -*)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
        *)
            log_error "Unknown argument: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate inputs
validate_inputs() {
    log_step "Validating inputs..."
    
    # Validate environment
    if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
        log_error "Invalid environment: $ENVIRONMENT"
        exit 1
    fi
    
    # Validate deployment type
    if [[ ! "$DEPLOYMENT_TYPE" =~ ^(docker-compose|kubernetes|helm)$ ]]; then
        log_error "Invalid deployment type: $DEPLOYMENT_TYPE"
        exit 1
    fi
    
    # Set kubeconfig if provided
    if [[ -n "$KUBECONFIG_PATH" ]]; then
        export KUBECONFIG="$KUBECONFIG_PATH"
    fi
    
    log_success "Input validation passed"
}

# Check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."
    
    local required_commands=()
    
    case $DEPLOYMENT_TYPE in
        docker-compose)
            required_commands+=(docker docker-compose)
            ;;
        kubernetes)
            required_commands+=(kubectl)
            ;;
        helm)
            required_commands+=(kubectl helm)
            ;;
    esac
    
    # Always need these
    required_commands+=(git)
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "$cmd is required but not installed"
            exit 1
        fi
    done
    
    # Check Docker daemon
    if [[ "$DEPLOYMENT_TYPE" == "docker-compose" ]] || [[ "$SKIP_BUILD" != true ]]; then
        if ! docker info &> /dev/null; then
            log_error "Docker daemon is not running"
            exit 1
        fi
    fi
    
    # Check Kubernetes connection
    if [[ "$DEPLOYMENT_TYPE" =~ ^(kubernetes|helm)$ ]]; then
        if ! kubectl cluster-info &> /dev/null; then
            log_error "Cannot connect to Kubernetes cluster"
            exit 1
        fi
    fi
    
    log_success "Prerequisites check passed"
}

# Load environment configuration
load_environment() {
    log_step "Loading environment configuration..."
    
    cd "$PROJECT_ROOT"
    
    # Load base environment file
    local env_file=".env"
    if [[ -f "$env_file" ]]; then
        log_info "Loading base environment from $env_file"
        set -a
        # shellcheck source=/dev/null
        source "$env_file"
        set +a
    fi
    
    # Load environment-specific file
    local env_specific_file=".env.${ENVIRONMENT}"
    if [[ -f "$env_specific_file" ]]; then
        log_info "Loading environment-specific config from $env_specific_file"
        set -a
        # shellcheck source=/dev/null
        source "$env_specific_file"
        set +a
    fi
    
    # Export essential variables
    export NODE_ENV="$ENVIRONMENT"
    export ENVIRONMENT
    
    log_success "Environment configuration loaded"
}

# Run tests
run_tests() {
    if [[ "$SKIP_TESTS" == true ]]; then
        log_warn "Skipping tests"
        return
    fi
    
    log_step "Running tests..."
    
    cd "$PROJECT_ROOT"
    
    # Backend tests
    if [[ -d "backend" ]] && [[ -f "backend/package.json" ]]; then
        log_info "Running backend tests..."
        cd backend
        npm test
        cd ..
    fi
    
    # Frontend tests
    if [[ -f "package.json" ]]; then
        log_info "Running frontend tests..."
        npm test
    fi
    
    log_success "Tests completed"
}

# Build Docker images
build_images() {
    if [[ "$SKIP_BUILD" == true ]]; then
        log_warn "Skipping image build"
        return
    fi
    
    log_step "Building Docker images..."
    
    cd "$PROJECT_ROOT"
    
    local backend_tag="fitness-tracker/backend:${ENVIRONMENT}"
    local frontend_tag="fitness-tracker/frontend:${ENVIRONMENT}"
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "DRY RUN: Would build backend image: $backend_tag"
        log_info "DRY RUN: Would build frontend image: $frontend_tag"
        return
    fi
    
    # Build backend image
    log_info "Building backend image: $backend_tag"
    docker build -f Dockerfile.backend -t "$backend_tag" .
    
    # Build frontend image
    log_info "Building frontend image: $frontend_tag"
    docker build -f Dockerfile.frontend -t "$frontend_tag" .
    
    log_success "Docker images built successfully"
}

# Deploy with Docker Compose
deploy_docker_compose() {
    log_step "Deploying with Docker Compose..."
    
    cd "$PROJECT_ROOT"
    
    local compose_file="docker-compose.yml"
    local compose_args=()
    
    # Use production compose file if environment is production
    if [[ "$ENVIRONMENT" == "production" ]]; then
        compose_file="docker-compose.prod.yml"
        compose_args+=("--profile" "monitoring" "--profile" "backup")
    fi
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "DRY RUN: Would run docker-compose with file: $compose_file"
        docker-compose -f "$compose_file" config
        return
    fi
    
    # Stop existing services if force recreate
    if [[ "$FORCE_RECREATE" == true ]]; then
        log_info "Force recreating services..."
        docker-compose -f "$compose_file" down --volumes
    fi
    
    # Deploy services
    log_info "Starting services with $compose_file..."
    docker-compose -f "$compose_file" "${compose_args[@]}" up -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    local max_wait=300
    local wait_time=0
    
    while [[ $wait_time -lt $max_wait ]]; do
        if docker-compose -f "$compose_file" ps | grep -q "Up (healthy)"; then
            break
        fi
        sleep 10
        wait_time=$((wait_time + 10))
        log_info "Waiting... ($wait_time/${max_wait}s)"
    done
    
    # Show service status
    docker-compose -f "$compose_file" ps
    
    log_success "Docker Compose deployment completed"
}

# Deploy to Kubernetes
deploy_kubernetes() {
    log_step "Deploying to Kubernetes..."
    
    local manifests_dir="$PROJECT_ROOT/src/deployment/kubernetes"
    
    if [[ ! -d "$manifests_dir" ]]; then
        log_error "Kubernetes manifests directory not found: $manifests_dir"
        exit 1
    fi
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "DRY RUN: Would deploy Kubernetes manifests to namespace: $NAMESPACE"
        kubectl apply --dry-run=client -k "$manifests_dir"
        return
    fi
    
    # Create namespace if it doesn't exist
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply manifests
    log_info "Applying Kubernetes manifests..."
    kubectl apply -k "$manifests_dir" -n "$NAMESPACE"
    
    # Wait for deployment to be ready
    log_info "Waiting for deployments to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment --all -n "$NAMESPACE"
    
    # Show deployment status
    kubectl get all -n "$NAMESPACE"
    
    log_success "Kubernetes deployment completed"
}

# Deploy with Helm
deploy_helm() {
    log_step "Deploying with Helm..."
    
    local chart_dir="$PROJECT_ROOT/src/deployment/helm/fitness-tracker"
    local values_file="$chart_dir/values-${ENVIRONMENT}.yaml"
    
    if [[ ! -d "$chart_dir" ]]; then
        log_error "Helm chart directory not found: $chart_dir"
        exit 1
    fi
    
    # Use default values file if environment-specific doesn't exist
    if [[ ! -f "$values_file" ]]; then
        values_file="$chart_dir/values.yaml"
    fi
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "DRY RUN: Would deploy Helm chart: $HELM_RELEASE"
        helm template "$HELM_RELEASE" "$chart_dir" \
            --namespace "$NAMESPACE" \
            --values "$values_file"
        return
    fi
    
    # Create namespace if it doesn't exist
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy with Helm
    log_info "Deploying Helm chart: $HELM_RELEASE"
    helm upgrade --install "$HELM_RELEASE" "$chart_dir" \
        --namespace "$NAMESPACE" \
        --values "$values_file" \
        --set image.backend.tag="${ENVIRONMENT}" \
        --set image.frontend.tag="${ENVIRONMENT}" \
        --set env.NODE_ENV="$ENVIRONMENT" \
        --wait --timeout=10m
    
    # Show release status
    helm status "$HELM_RELEASE" -n "$NAMESPACE"
    
    log_success "Helm deployment completed"
}

# Health check
health_check() {
    log_step "Performing health checks..."
    
    case $DEPLOYMENT_TYPE in
        docker-compose)
            # Check Docker Compose services
            local compose_file="docker-compose.yml"
            if [[ "$ENVIRONMENT" == "production" ]]; then
                compose_file="docker-compose.prod.yml"
            fi
            
            local unhealthy
            unhealthy=$(docker-compose -f "$compose_file" ps --services --filter "health=unhealthy")
            
            if [[ -n "$unhealthy" ]]; then
                log_error "Unhealthy services: $unhealthy"
                return 1
            fi
            ;;
        kubernetes|helm)
            # Check Kubernetes pods
            local not_ready
            not_ready=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase!=Running --no-headers 2>/dev/null | wc -l)
            
            if [[ "$not_ready" -gt 0 ]]; then
                log_error "$not_ready pods are not running in namespace $NAMESPACE"
                kubectl get pods -n "$NAMESPACE"
                return 1
            fi
            ;;
    esac
    
    log_success "Health checks passed"
}

# Show deployment info
show_deployment_info() {
    log_step "Deployment Information:"
    
    echo -e "${CYAN}Environment:${NC} $ENVIRONMENT"
    echo -e "${CYAN}Deployment Type:${NC} $DEPLOYMENT_TYPE"
    echo -e "${CYAN}Namespace:${NC} $NAMESPACE"
    
    case $DEPLOYMENT_TYPE in
        docker-compose)
            echo -e "${CYAN}Services:${NC}"
            local compose_file="docker-compose.yml"
            if [[ "$ENVIRONMENT" == "production" ]]; then
                compose_file="docker-compose.prod.yml"
            fi
            docker-compose -f "$compose_file" ps --services
            
            echo -e "${CYAN}URLs:${NC}"
            echo "  Frontend: http://localhost:3001"
            echo "  Backend API: http://localhost:3000"
            if [[ "$ENVIRONMENT" == "development" ]]; then
                echo "  PgAdmin: http://localhost:5050"
                echo "  Redis Commander: http://localhost:8081"
            fi
            ;;
        kubernetes|helm)
            echo -e "${CYAN}Kubectl Commands:${NC}"
            echo "  Get pods: kubectl get pods -n $NAMESPACE"
            echo "  Get services: kubectl get services -n $NAMESPACE"
            echo "  Get ingress: kubectl get ingress -n $NAMESPACE"
            echo "  Logs: kubectl logs -f deployment/backend -n $NAMESPACE"
            ;;
    esac
    
    echo ""
}

# Main execution
main() {
    log_info "Starting deployment process..."
    log_info "Environment: $ENVIRONMENT | Type: $DEPLOYMENT_TYPE"
    
    validate_inputs
    check_prerequisites
    load_environment
    
    if [[ "$DRY_RUN" != true ]]; then
        run_tests
        build_images
    fi
    
    case $DEPLOYMENT_TYPE in
        docker-compose)
            deploy_docker_compose
            ;;
        kubernetes)
            deploy_kubernetes
            ;;
        helm)
            deploy_helm
            ;;
    esac
    
    if [[ "$DRY_RUN" != true ]]; then
        health_check
    fi
    
    show_deployment_info
    
    log_success "Deployment completed successfully!"
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi