# Fitness Tracker - Production Deployment Guide

This document provides comprehensive deployment instructions for the Fitness Tracker application using various deployment methods including Docker Compose, Kubernetes, and AWS infrastructure.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Deployment Methods](#deployment-methods)
- [Monitoring & Logging](#monitoring--logging)
- [Security](#security)
- [Backup & Recovery](#backup--recovery)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Local Development with Docker Compose

```bash
# Clone the repository
git clone <repository-url>
cd fitness-tracker

# Copy environment template
cp .env.example .env

# Start services
docker-compose up -d

# Check health
curl http://localhost:3001/health
```

### Production Deployment

```bash
# Deploy to production with Helm
./src/deployment/scripts/deploy.sh -e production -t helm

# Or deploy with Kubernetes manifests
./src/deployment/scripts/deploy.sh -e production -t kubernetes
```

## Architecture Overview

### System Components

- **Frontend**: React application served by Nginx
- **Backend**: Node.js/Express API server
- **Database**: PostgreSQL with automatic backups
- **Cache**: Redis for session storage and caching
- **Reverse Proxy**: Nginx with SSL termination
- **Monitoring**: Prometheus, Grafana, and alerting
- **CI/CD**: GitHub Actions with automated testing and deployment

### Network Architecture

```
Internet → Load Balancer → Nginx Proxy → Backend Services
                                     ↓
                              PostgreSQL + Redis
```

## Prerequisites

### Development Environment

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 18+
- npm 9+

### Production Environment

- Kubernetes cluster 1.28+
- Helm 3.12+
- kubectl configured
- AWS CLI (for AWS deployment)
- Terraform 1.5+ (for infrastructure)

### Required Accounts

- Docker registry access (GitHub Container Registry)
- Cloud provider account (AWS recommended)
- Domain name for SSL certificates
- Notification services (Slack, email)

## Environment Configuration

### Environment Variables

Create `.env` files for each environment:

#### `.env` (Development)
```bash
NODE_ENV=development
PORT=3000

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=fitness_tracker
DB_USER=postgres
DB_PASSWORD=devpassword123

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=devredis123

# Security
JWT_SECRET=your-dev-jwt-secret
SESSION_SECRET=your-dev-session-secret

# CORS
CORS_ORIGIN=http://localhost:3001
```

#### `.env.production` (Production)
```bash
NODE_ENV=production
PORT=3000

# Database (use AWS RDS endpoint)
DB_HOST=your-rds-endpoint.amazonaws.com
DB_PORT=5432
DB_NAME=fitness_tracker
DB_USER=fitness_app
DB_PASSWORD=<strong-password>
DB_SSL=true

# Redis (use AWS ElastiCache endpoint)
REDIS_HOST=your-elasticache-endpoint.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=<strong-password>

# Security (use strong secrets)
JWT_SECRET=<strong-jwt-secret>
SESSION_SECRET=<strong-session-secret>
BCRYPT_ROUNDS=12

# Application
CORS_ORIGIN=https://fitness.example.com
FRONTEND_URL=https://fitness.example.com

# Rate limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Monitoring
LOG_LEVEL=info
```

## Deployment Methods

### 1. Docker Compose (Development/Testing)

Best for local development and testing environments.

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Scale services
docker-compose up -d --scale backend=3

# Production-like setup
docker-compose -f docker-compose.prod.yml up -d --profile monitoring

# Stop services
docker-compose down
```

**Services Started:**
- Frontend (port 3001)
- Backend API (port 3000)
- PostgreSQL (port 5432)
- Redis (port 6379)
- PgAdmin (port 5050) - dev only
- Redis Commander (port 8081) - dev only

### 2. Kubernetes (Production)

Best for scalable production deployments.

```bash
# Apply Kubernetes manifests
kubectl apply -k src/deployment/kubernetes/

# Check deployment status
kubectl get pods -n fitness-tracker

# Port forward for testing
kubectl port-forward service/frontend-service 8080:80 -n fitness-tracker

# Scale deployment
kubectl scale deployment backend --replicas=5 -n fitness-tracker
```

**Resources Created:**
- Namespace: `fitness-tracker`
- Deployments: backend, frontend
- StatefulSets: postgres, redis
- Services: backend-service, frontend-service, postgres-service, redis-service
- Ingress: fitness-tracker-ingress
- ConfigMaps: application config, nginx config
- Secrets: database credentials, JWT secrets

### 3. Helm (Recommended for Production)

Best for production with easy configuration management.

```bash
# Install with default values
helm install fitness-tracker src/deployment/helm/fitness-tracker/ \
  --namespace fitness-tracker --create-namespace

# Install with custom values
helm install fitness-tracker src/deployment/helm/fitness-tracker/ \
  --namespace fitness-tracker \
  --values src/deployment/helm/fitness-tracker/values-production.yaml

# Upgrade deployment
helm upgrade fitness-tracker src/deployment/helm/fitness-tracker/ \
  --namespace fitness-tracker \
  --set image.backend.tag=v1.2.0

# Check status
helm status fitness-tracker -n fitness-tracker

# Rollback
helm rollback fitness-tracker 1 -n fitness-tracker
```

### 4. AWS Infrastructure with Terraform

For complete infrastructure as code on AWS.

```bash
# Initialize Terraform
cd src/deployment/terraform
terraform init

# Plan infrastructure
terraform plan -var-file=environments/production.tfvars

# Apply infrastructure
terraform apply -var-file=environments/production.tfvars

# Get kubeconfig
aws eks update-kubeconfig --region us-west-2 --name fitness-tracker-production

# Deploy application
helm install fitness-tracker ../helm/fitness-tracker/ \
  --namespace fitness-tracker --create-namespace \
  --values ../helm/fitness-tracker/values-production.yaml
```

**Infrastructure Created:**
- VPC with public/private subnets
- EKS cluster with managed node groups
- RDS PostgreSQL instance
- ElastiCache Redis cluster
- Application Load Balancer
- S3 buckets for assets and backups
- CloudWatch for logging and monitoring
- IAM roles and security groups

## Monitoring & Logging

### Prometheus Metrics

Application exposes metrics at `/metrics`:

- HTTP request rate and duration
- Database connection pool status
- Redis operations
- Business metrics (user activity, workout completion)
- System resource usage

### Grafana Dashboards

Access Grafana at `http://localhost:3003` (Docker Compose) or via ingress.

**Available Dashboards:**
- Application Overview
- System Resources
- Database Performance
- API Performance
- Business Metrics

### Log Aggregation

Logs are collected using:

- **Docker Compose**: Local log files and stdout
- **Kubernetes**: Fluentd/Fluent Bit → Elasticsearch → Kibana
- **AWS**: CloudWatch Logs with log groups per service

### Alerting

Alerts are configured for:

- Application downtime
- High error rates
- Database connection issues
- High resource usage
- SSL certificate expiration
- Failed backups

## Security

### Security Features Implemented

- **Container Security**: Non-root users, minimal base images
- **Network Security**: Network policies, security groups
- **Data Encryption**: At-rest and in-transit encryption
- **Secret Management**: Kubernetes secrets, AWS SSM
- **Authentication**: JWT tokens, bcrypt password hashing
- **Rate Limiting**: API rate limiting and DDoS protection
- **SSL/TLS**: Automatic certificate management
- **Security Headers**: CSRF, XSS, and clickjacking protection

### Security Best Practices

1. **Keep images updated**: Regular base image updates
2. **Scan for vulnerabilities**: Trivy scanning in CI/CD
3. **Network segmentation**: Use network policies
4. **Least privilege access**: Minimal IAM permissions
5. **Regular security audits**: Automated and manual reviews
6. **Backup encryption**: Encrypted backup storage
7. **Secure secrets**: Never commit secrets to Git

### SSL Certificate Management

**Development:**
```bash
# Generate self-signed certificates
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

**Production:**
- Use Let's Encrypt with cert-manager
- AWS Certificate Manager for ALB
- Automatic certificate renewal

## Backup & Recovery

### Database Backups

**Automated Backups:**
```bash
# Run backup script
./src/deployment/scripts/backup.sh

# Backup with encryption
BACKUP_ENCRYPTION_KEY="your-key" ./src/deployment/scripts/backup.sh

# Upload to S3
S3_BUCKET="your-backup-bucket" ./src/deployment/scripts/backup.sh
```

**Backup Schedule:**
- Daily full backups at 2:00 AM UTC
- 7-day local retention
- 30-day S3 retention
- Point-in-time recovery for 7 days

### Database Restore

```bash
# List available backups
./src/deployment/scripts/restore.sh --list

# Restore from local backup
./src/deployment/scripts/restore.sh 20231215_143000

# Restore from S3
./src/deployment/scripts/restore.sh --from-s3 20231215_143000

# Dry run
./src/deployment/scripts/restore.sh --dry-run backup.sql
```

### Disaster Recovery

**RTO (Recovery Time Objective):** 4 hours
**RPO (Recovery Point Objective):** 1 hour

**Recovery Procedures:**
1. **Database failure**: Restore from latest backup
2. **Application failure**: Redeploy from CI/CD
3. **Infrastructure failure**: Terraform recreate
4. **Complete disaster**: Multi-region failover (if configured)

## Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check logs
docker-compose logs backend
kubectl logs deployment/backend -n fitness-tracker

# Check configuration
kubectl describe configmap fitness-tracker-config -n fitness-tracker

# Verify database connection
kubectl exec -it deployment/backend -n fitness-tracker -- npm run db:test
```

#### High Memory Usage
```bash
# Check resource usage
kubectl top pods -n fitness-tracker

# Scale down if needed
kubectl scale deployment backend --replicas=2 -n fitness-tracker

# Check for memory leaks in logs
kubectl logs deployment/backend -n fitness-tracker | grep -i memory
```

#### Database Connection Issues
```bash
# Test database connectivity
kubectl exec -it deployment/postgres -n fitness-tracker -- psql -U postgres -d fitness_tracker -c "SELECT version();"

# Check connection pool
curl http://backend-service:3000/health | jq '.checks.database'

# Reset connections
kubectl rollout restart deployment/backend -n fitness-tracker
```

#### SSL Certificate Issues
```bash
# Check certificate status
kubectl describe certificate fitness-tracker-tls -n fitness-tracker

# Check cert-manager logs
kubectl logs deployment/cert-manager -n cert-manager

# Manually renew certificate
kubectl delete certificate fitness-tracker-tls -n fitness-tracker
```

### Performance Optimization

#### Backend Optimization
- Enable connection pooling
- Implement caching strategies
- Use database indexing
- Optimize database queries
- Enable gzip compression

#### Frontend Optimization
- Enable browser caching
- Compress static assets
- Use CDN for static files
- Implement lazy loading
- Optimize images

#### Infrastructure Optimization
- Use appropriate instance types
- Configure auto-scaling
- Optimize network configuration
- Use spot instances for cost savings
- Implement proper monitoring

### Health Checks

```bash
# Application health
curl http://localhost:3000/health

# Detailed health check
node src/deployment/scripts/healthcheck.js --verbose

# Kubernetes health
kubectl get pods -n fitness-tracker
kubectl describe pod <pod-name> -n fitness-tracker
```

### Getting Help

1. **Check logs**: Always start with application and system logs
2. **Verify configuration**: Ensure environment variables are correct
3. **Test connectivity**: Verify network and service connectivity
4. **Check resources**: Monitor CPU, memory, and disk usage
5. **Review metrics**: Use Grafana dashboards for insights
6. **Consult documentation**: Review this guide and Kubernetes docs

### Support Contacts

- **Infrastructure Issues**: DevOps Team
- **Application Issues**: Development Team  
- **Security Issues**: Security Team
- **Emergency**: On-call rotation

---

## Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Helm Documentation](https://helm.sh/docs/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/)
- [Prometheus Monitoring](https://prometheus.io/docs/)
- [Grafana Dashboards](https://grafana.com/docs/)

---

**Last Updated**: 2024-01-15
**Version**: 1.0.0