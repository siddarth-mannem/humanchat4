variable "service_name" { type = string }
variable "repository_url" { type = string }
variable "env_variables" { type = map(string) }
variable "plan" { type = string }
variable "min_instances" { type = number }
variable "max_instances" { type = number }

resource "railway_service" "this" {
  name      = var.service_name
  repo_url  = var.repository_url
  plan      = var.plan
  min_scale = var.min_instances
  max_scale = var.max_instances
}

resource "railway_variable" "env" {
  for_each   = var.env_variables
  service_id = railway_service.this.id
  key        = each.key
  value      = each.value
}

output "hostname" {
  value = railway_service.this.domain
}
