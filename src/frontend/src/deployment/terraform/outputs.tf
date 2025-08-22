# Terraform outputs for Fitness Tracker Infrastructure

# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "private_subnets" {
  description = "List of IDs of private subnets"
  value       = module.vpc.private_subnets
}

output "public_subnets" {
  description = "List of IDs of public subnets"
  value       = module.vpc.public_subnets
}

# EKS Cluster Outputs
output "cluster_id" {
  description = "EKS cluster ID"
  value       = module.eks.cluster_id
}

output "cluster_arn" {
  description = "EKS cluster ARN"
  value       = module.eks.cluster_arn
}

output "cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = module.eks.cluster_endpoint
}

output "cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = module.eks.cluster_security_group_id
}

output "cluster_iam_role_name" {
  description = "IAM role name associated with EKS cluster"
  value       = module.eks.cluster_iam_role_name
}

output "cluster_iam_role_arn" {
  description = "IAM role ARN associated with EKS cluster"
  value       = module.eks.cluster_iam_role_arn
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required to communicate with the cluster"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "cluster_primary_security_group_id" {
  description = "The cluster primary security group ID created by the EKS service"
  value       = module.eks.cluster_primary_security_group_id
}

output "oidc_provider_arn" {
  description = "The ARN of the OIDC Provider if enabled"
  value       = module.eks.oidc_provider_arn
}

# Node Group Outputs
output "node_groups" {
  description = "Outputs from EKS node groups"
  value       = module.eks.node_groups
  sensitive   = true
}

# RDS Outputs
output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = var.create_rds ? module.rds[0].db_instance_endpoint : null
}

output "rds_port" {
  description = "RDS instance port"
  value       = var.create_rds ? module.rds[0].db_instance_port : null
}

output "rds_instance_id" {
  description = "RDS instance ID"
  value       = var.create_rds ? module.rds[0].db_instance_id : null
}

output "rds_instance_arn" {
  description = "RDS instance ARN"
  value       = var.create_rds ? module.rds[0].db_instance_arn : null
}

output "rds_security_group_id" {
  description = "ID of the RDS security group"
  value       = var.create_rds ? module.rds[0].security_group_id : null
}

# Redis Outputs
output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = var.create_redis ? module.redis[0].cache_cluster_endpoint : null
}

output "redis_port" {
  description = "Redis cluster port"
  value       = var.create_redis ? module.redis[0].cache_cluster_port : null
}

output "redis_cluster_id" {
  description = "Redis cluster ID"
  value       = var.create_redis ? module.redis[0].cache_cluster_id : null
}

output "redis_security_group_id" {
  description = "ID of the Redis security group"
  value       = var.create_redis ? module.redis[0].security_group_id : null
}

# Application Load Balancer Outputs
output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.main.arn
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  value       = aws_lb.main.zone_id
}

output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = aws_security_group.alb.id
}

# SSL Certificate Outputs
output "certificate_arn" {
  description = "ARN of the SSL certificate"
  value       = var.create_ssl_certificate ? aws_acm_certificate.main[0].arn : null
}

output "certificate_domain_validation_options" {
  description = "Set of domain validation objects which contain the domain, validation domain and resource record"
  value       = var.create_ssl_certificate ? aws_acm_certificate.main[0].domain_validation_options : null
  sensitive   = true
}

# Route53 Outputs
output "route53_zone_id" {
  description = "Zone ID of Route53 hosted zone"
  value       = var.create_hosted_zone ? aws_route53_zone.main[0].zone_id : null
}

output "route53_name_servers" {
  description = "Name servers of the hosted zone"
  value       = var.create_hosted_zone ? aws_route53_zone.main[0].name_servers : null
}

# S3 Outputs
output "s3_bucket_id" {
  description = "ID of the S3 bucket for application assets"
  value       = aws_s3_bucket.app_assets.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket for application assets"
  value       = aws_s3_bucket.app_assets.arn
}

output "s3_bucket_domain_name" {
  description = "Domain name of the S3 bucket"
  value       = aws_s3_bucket.app_assets.bucket_domain_name
}

# IAM Outputs
output "irsa_iam_role_arn" {
  description = "ARN of IAM role for service account"
  value       = module.irsa.iam_role_arn
}

output "irsa_iam_role_name" {
  description = "Name of IAM role for service account"
  value       = module.irsa.iam_role_name
}

# Monitoring Outputs
output "monitoring_outputs" {
  description = "Monitoring stack outputs"
  value       = var.enable_monitoring ? module.monitoring[0] : null
  sensitive   = true
}

# Environment Information
output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "region" {
  description = "AWS region"
  value       = var.aws_region
}

output "cluster_name" {
  description = "Kubernetes cluster name"
  value       = local.cluster_name
}

# Kubeconfig Information
output "kubeconfig_filename" {
  description = "kubectl config filename"
  value       = "kubeconfig_${local.cluster_name}"
}

output "kubectl_config" {
  description = "kubectl config as yaml file"
  value = templatefile("${path.module}/templates/kubeconfig.tpl", {
    cluster_name                      = local.cluster_name
    endpoint                         = module.eks.cluster_endpoint
    cluster_ca                       = module.eks.cluster_certificate_authority_data
    region                          = var.aws_region
  })
  sensitive = true
}

# Connection Information for Applications
output "database_url" {
  description = "Database URL for application configuration"
  value       = var.create_rds ? "postgresql://${var.database_username}:PASSWORD@${module.rds[0].db_instance_endpoint}:${module.rds[0].db_instance_port}/${var.database_name}" : null
  sensitive   = true
}

output "redis_url" {
  description = "Redis URL for application configuration"
  value       = var.create_redis ? "redis://PASSWORD@${module.redis[0].cache_cluster_endpoint}:${module.redis[0].cache_cluster_port}" : null
  sensitive   = true
}

# Security Information
output "vpc_security_group_ids" {
  description = "Security group IDs for VPC"
  value = {
    alb   = aws_security_group.alb.id
    rds   = var.create_rds ? module.rds[0].security_group_id : null
    redis = var.create_redis ? module.redis[0].security_group_id : null
  }
}

# Cost Information
output "estimated_monthly_cost" {
  description = "Estimated monthly cost breakdown (USD)"
  value = {
    eks_cluster = "72.00"  # $0.10/hour * 24 * 30
    node_groups = "Variable based on instance types and count"
    rds = var.create_rds ? "Variable based on ${var.rds_instance_class}" : "0.00"
    redis = var.create_redis ? "Variable based on ${var.redis_node_type}" : "0.00"
    alb = "22.50"  # $0.0225/hour * 24 * 30
    nat_gateway = var.environment == "staging" ? "32.40" : "97.20"  # Single vs 3 NAT gateways
  }
}

# Deployment Information
output "deployment_info" {
  description = "Information needed for application deployment"
  value = {
    cluster_name    = local.cluster_name
    region         = var.aws_region
    environment    = var.environment
    vpc_id         = module.vpc.vpc_id
    private_subnets = module.vpc.private_subnets
    public_subnets  = module.vpc.public_subnets
  }
  sensitive = true
}