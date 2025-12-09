terraform {
  required_version = ">= 1.0"
  
  required_providers {
    vultr = {
      source  = "vultr/vultr"
      version = "~> 2.17"
    }
  }
}

provider "vultr" {
  api_key     = var.vultr_api_key
  rate_limit  = 100
  retry_limit = 3
}

# Cloud Compute Instance for Risk Worker
resource "vultr_instance" "risk_worker" {
  plan        = var.plan
  region      = var.region
  os_id       = 1743  # Ubuntu 22.04 LTS x64
  label       = "cloudsage-risk-worker"
  hostname    = "risk-worker"
  enable_ipv6 = false
  backups     = "disabled"
  
  ssh_key_ids = var.ssh_key_ids
  
  # Startup script to deploy the worker
  user_data = base64encode(templatefile("${path.module}/startup.sh", {
    github_repo = var.github_repo
    api_key     = var.worker_api_key != "" ? var.worker_api_key : random_password.api_key.result
  }))
  
  tags = ["cloudsage", "risk-worker", "production"]
}

# Generate random API key if not provided
resource "random_password" "api_key" {
  length  = 32
  special = false
}

# Firewall Group
resource "vultr_firewall_group" "risk_worker_fw" {
  description = "CloudSage Risk Worker Firewall"
}

# Attach firewall to instance
resource "vultr_instance_ipv4" "risk_worker_ipv4" {
  instance_id = vultr_instance.risk_worker.id
  reboot      = false
}

# Firewall Rules
resource "vultr_firewall_rule" "allow_worker_http" {
  firewall_group_id = vultr_firewall_group.risk_worker_fw.id
  protocol          = "tcp"
  ip_type           = "v4"
  subnet            = "0.0.0.0"
  subnet_size       = 0
  port              = "8080"
  notes             = "Allow HTTP traffic to risk worker API"
}

resource "vultr_firewall_rule" "allow_ssh" {
  firewall_group_id = vultr_firewall_group.risk_worker_fw.id
  protocol          = "tcp"
  ip_type           = "v4"
  subnet            = "0.0.0.0"
  subnet_size       = 0
  port              = "22"
  notes             = "Allow SSH access for management"
}

resource "vultr_firewall_rule" "allow_https" {
  firewall_group_id = vultr_firewall_group.risk_worker_fw.id
  protocol          = "tcp"
  ip_type           = "v4"
  subnet            = "0.0.0.0"
  subnet_size       = 0
  port              = "443"
  notes             = "Allow HTTPS traffic (for future SSL setup)"
}

# Outputs
output "instance_id" {
  value       = vultr_instance.risk_worker.id
  description = "Vultr instance ID"
}

output "instance_ip" {
  value       = vultr_instance.risk_worker.main_ip
  description = "Public IP address of the risk worker"
}

output "worker_url" {
  value       = "http://${vultr_instance.risk_worker.main_ip}:8080"
  description = "Risk worker URL for backend configuration"
}

output "worker_health_check" {
  value       = "http://${vultr_instance.risk_worker.main_ip}:8080/health"
  description = "Health check endpoint"
}

output "worker_api_key" {
  value       = var.worker_api_key != "" ? var.worker_api_key : random_password.api_key.result
  description = "API key for worker authentication"
  sensitive   = true
}

output "ssh_command" {
  value       = "ssh root@${vultr_instance.risk_worker.main_ip}"
  description = "SSH command to access the instance"
}

output "backend_env_vars" {
  value = <<-EOT
    Add these to your backend .env file:
    
    VULTR_WORKER_URL=http://${vultr_instance.risk_worker.main_ip}:8080
    VULTR_API_KEY=${var.worker_api_key != "" ? var.worker_api_key : random_password.api_key.result}
  EOT
  description = "Environment variables for backend configuration"
  sensitive   = true
}
