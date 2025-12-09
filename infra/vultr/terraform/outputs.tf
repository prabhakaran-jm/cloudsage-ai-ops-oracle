# Terraform Outputs
# These values are displayed after terraform apply

output "summary" {
  value = <<-EOT
    
    ╔════════════════════════════════════════════════════════════════╗
    ║           CloudSage Risk Worker - Deployment Summary          ║
    ╚════════════════════════════════════════════════════════════════╝
    
    Instance Details:
    ─────────────────
    Instance ID:  ${vultr_instance.risk_worker.id}
    IP Address:   ${vultr_instance.risk_worker.main_ip}
    Region:       ${var.region}
    Plan:         ${var.plan}
    
    Endpoints:
    ──────────
    Worker URL:   http://${vultr_instance.risk_worker.main_ip}:8080
    Health Check: http://${vultr_instance.risk_worker.main_ip}:8080/health
    Score API:    http://${vultr_instance.risk_worker.main_ip}:8080/score
    
    SSH Access:
    ───────────
    Command:      ssh root@${vultr_instance.risk_worker.main_ip}
    
    Backend Configuration:
    ──────────────────────
    Add these to your apps/api/.env file:
    
    VULTR_WORKER_URL=http://${vultr_instance.risk_worker.main_ip}:8080
    VULTR_API_KEY=${var.worker_api_key != "" ? "[CUSTOM_KEY]" : "[AUTO_GENERATED]"}
    
    To view the API key:
    terraform output -raw worker_api_key
    
    Next Steps:
    ───────────
    1. Test health endpoint:
       curl http://${vultr_instance.risk_worker.main_ip}:8080/health
    
    2. Update backend .env with VULTR_WORKER_URL and VULTR_API_KEY
    
    3. Redeploy backend:
       cd apps/api && ./scripts/deploy-raindrop.sh
    
    4. Test integration:
       curl -X POST http://${vultr_instance.risk_worker.main_ip}:8080/score \
         -H "Authorization: Bearer YOUR_API_KEY" \
         -H "Content-Type: application/json" \
         -d '{"projectId":"test","logs":["ERROR: test"]}'
    
    Management:
    ───────────
    SSH into instance:  ssh root@${vultr_instance.risk_worker.main_ip}
    View logs:          ssh root@${vultr_instance.risk_worker.main_ip} "pm2 logs risk-worker"
    Restart worker:     ssh root@${vultr_instance.risk_worker.main_ip} "pm2 restart risk-worker"
    
    ╔════════════════════════════════════════════════════════════════╗
    ║  Deployment complete! Worker should be ready in 2-3 minutes.  ║
    ╚════════════════════════════════════════════════════════════════╝
    
  EOT
  description = "Deployment summary with all important information"
}

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

output "worker_api_key" {
  value       = var.worker_api_key != "" ? var.worker_api_key : random_password.api_key.result
  description = "API key for worker authentication"
  sensitive   = true
}

output "ssh_command" {
  value       = "ssh root@${vultr_instance.risk_worker.main_ip}"
  description = "SSH command to access the instance"
}
