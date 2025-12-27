variable "project_name" { type = string }
variable "primary_domain" { type = string }
variable "api_domain" { type = string }
variable "ws_domain" { type = string }
variable "vercel_token" { type = string }
variable "vercel_team" { type = string }
variable "git_repo_slug" { type = string }
variable "cloudflare_token" { type = string }
variable "cloudflare_zone_id" { type = string }
variable "frontend_env" { type = map(string) }
variable "backend_env" { type = map(string) }
variable "ws_env" { type = map(string) }

variable "gcp_project_id" { type = string }
variable "gcp_region" { type = string }

variable "api_image" { type = string }
variable "ws_image" { type = string }
