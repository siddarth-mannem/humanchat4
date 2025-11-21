variable "project_id" { type = string }
variable "region" { type = string }
variable "service_name" { type = string }
variable "image" { type = string }
variable "env_variables" {
  type    = map(string)
  default = {}
}
variable "min_instances" {
  type    = number
  default = null
}
variable "max_instances" {
  type    = number
  default = null
}
variable "concurrency" {
  type    = number
  default = 80
}
variable "timeout_seconds" {
  type    = number
  default = 300
}
variable "service_account_email" {
  type    = string
  default = null
}
variable "allow_unauthenticated" {
  type    = bool
  default = true
}
variable "cpu" {
  type    = string
  default = null
}
variable "memory" {
  type    = string
  default = null
}
variable "vpc_connector" {
  type    = string
  default = null
}
variable "vpc_connector_egress" {
  type    = string
  default = null
}
variable "cloud_sql_instances" {
  type    = list(string)
  default = []
}
variable "labels" {
  type    = map(string)
  default = {}
}

locals {
  annotations = merge(
    var.min_instances != null ? { "autoscaling.knative.dev/minScale" = tostring(var.min_instances) } : {},
    var.max_instances != null ? { "autoscaling.knative.dev/maxScale" = tostring(var.max_instances) } : {},
    var.vpc_connector != null ? { "run.googleapis.com/vpc-access-connector" = var.vpc_connector } : {},
    var.vpc_connector_egress != null ? { "run.googleapis.com/vpc-access-egress" = var.vpc_connector_egress } : {},
    length(var.cloud_sql_instances) > 0 ? { "run.googleapis.com/cloudsql-instances" = join(",", var.cloud_sql_instances) } : {},
    var.cpu != null ? { "run.googleapis.com/cpu" = var.cpu } : {},
    var.memory != null ? { "run.googleapis.com/memory" = var.memory } : {}
  )
}

resource "google_cloud_run_service" "this" {
  name     = var.service_name
  location = var.region
  project  = var.project_id

  autogenerate_revision_name = true

  template {
    metadata {
      labels      = var.labels
      annotations = local.annotations
    }

    spec {
      timeout_seconds      = var.timeout_seconds
      container_concurrency = var.concurrency
      service_account_name = var.service_account_email

      containers {
        image = var.image

        dynamic "env" {
          for_each = var.env_variables
          content {
            name  = env.key
            value = env.value
          }
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

resource "google_cloud_run_service_iam_member" "public" {
  count    = var.allow_unauthenticated ? 1 : 0
  project  = var.project_id
  location = var.region
  service  = google_cloud_run_service.this.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

output "url" {
  value = google_cloud_run_service.this.status[0].url
}

output "hostname" {
  value = trimsuffix(replace(google_cloud_run_service.this.status[0].url, "https://", ""), "/")
}

output "service_id" {
  value = google_cloud_run_service.this.id
}

output "name" {
  value = google_cloud_run_service.this.name
}
