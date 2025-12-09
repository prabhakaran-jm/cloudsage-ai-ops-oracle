variable "vultr_api_key" {
  description = "Vultr API Key (get from https://my.vultr.com/settings/#settingsapi)"
  type        = string
  sensitive   = true
}

variable "ssh_key_ids" {
  description = "List of SSH Key IDs for instance access (get from: vultr-cli ssh-key list)"
  type        = list(string)
  default     = []
}

variable "region" {
  description = "Vultr region code (ewr=New Jersey, lax=Los Angeles, fra=Frankfurt)"
  type        = string
  default     = "ewr"
  
  validation {
    condition     = contains(["ewr", "lax", "ord", "dfw", "sea", "atl", "ams", "fra", "lhr", "sgp", "syd"], var.region)
    error_message = "Region must be a valid Vultr region code."
  }
}

variable "plan" {
  description = "Vultr instance plan (vc2-1c-1gb=$6/mo, vc2-2c-4gb=$18/mo)"
  type        = string
  default     = "vc2-1c-1gb"
  
  validation {
    condition     = contains(["vc2-1c-1gb", "vc2-2c-4gb", "vc2-4c-8gb", "vc2-6c-16gb"], var.plan)
    error_message = "Plan must be a valid Vultr Cloud Compute plan."
  }
}

variable "github_repo" {
  description = "GitHub repository URL (e.g., https://github.com/username/cloudsage-ai-ops-oracle.git)"
  type        = string
  default     = "https://github.com/YOUR_USERNAME/cloudsage-ai-ops-oracle.git"
}

variable "worker_api_key" {
  description = "API key for worker authentication (leave empty to auto-generate)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "enable_backups" {
  description = "Enable automatic backups ($1/month)"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Additional tags for the instance"
  type        = list(string)
  default     = []
}
