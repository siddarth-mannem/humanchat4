variable "project_name" { type = string }
variable "region" { type = string }
variable "enable_replicas" { type = bool }

resource "supabase_project" "this" {
  name   = var.project_name
  region = var.region
}

resource "supabase_read_replica" "replica" {
  count      = var.enable_replicas ? 1 : 0
  project_id = supabase_project.this.id
  region     = var.region
}

output "database_url" {
  value = supabase_project.this.database_url
  sensitive = true
}
