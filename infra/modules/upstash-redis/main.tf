variable "cluster_name" { type = string }
variable "region" { type = string }
variable "multiregion" { type = bool }

resource "upstash_redis_database" "this" {
  database_name = var.cluster_name
  region        = var.region
  multiregion   = var.multiregion
}

output "redis_url" {
  value = upstash_redis_database.this.rest_url
  sensitive = true
}
