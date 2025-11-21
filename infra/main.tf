terraform {
  required_version = ">= 1.7.0"
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 0.13"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.30"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 5.30"
    }
  }
}

provider "vercel" {
  api_token = var.vercel_token
}

provider "cloudflare" {
  api_token = var.cloudflare_token
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

data "google_compute_default_service_account" "default" {
  project = var.gcp_project_id
}

data "google_project" "current" {
  project_id = var.gcp_project_id
}


resource "google_compute_network" "main" {
  name                    = "${var.project_name}-network"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "main" {
  name          = "${var.project_name}-subnet"
  ip_cidr_range = "10.100.0.0/28"
  region        = var.gcp_region
  network       = google_compute_network.main.id
}

resource "google_vpc_access_connector" "cloud_run" {
  name   = "${var.project_name}-connector"
  region = var.gcp_region

  subnet {
    name = google_compute_subnetwork.main.name
  }
}

module "frontend" {
  source        = "./modules/frontend"
  project_name  = var.project_name
  domain        = var.primary_domain
  vercel_team   = var.vercel_team
  git_repo_slug = var.git_repo_slug
  env_variables = var.frontend_env
}

module "api_service" {
  source                = "./modules/cloud-run-service"
  project_id            = var.gcp_project_id
  region                = var.gcp_region
  service_name          = "humanchat-api"
  image                 = var.api_image
  env_variables         = merge(var.backend_env, { REDIS_URL = local.redis_url })
  min_instances         = 1
  max_instances         = 3
  vpc_connector         = google_vpc_access_connector.cloud_run.name
  vpc_connector_egress  = "private-ranges-only"
  cloud_sql_instances   = var.api_cloud_sql_instances
  service_account_email = data.google_compute_default_service_account.default.email
}

module "ws_service" {
  source                = "./modules/cloud-run-service"
  project_id            = var.gcp_project_id
  region                = var.gcp_region
  service_name          = "humanchat-ws"
  image                 = var.ws_image
  env_variables         = merge(var.ws_env, { REDIS_URL = local.redis_url })
  min_instances         = 0
  max_instances         = 5
  vpc_connector         = google_vpc_access_connector.cloud_run.name
  vpc_connector_egress  = "private-ranges-only"
  cloud_sql_instances   = var.api_cloud_sql_instances
  service_account_email = data.google_compute_default_service_account.default.email
}

module "redis" {
  source     = "./modules/memorystore-redis"
  name       = "${var.project_name}-redis"
  project_id = var.gcp_project_id
  region     = var.gcp_region
  network    = google_compute_network.main.id
}

locals {
  redis_url = "redis://${module.redis.host}:${module.redis.port}"
}

resource "google_cloud_run_domain_mapping" "api" {
  location = var.gcp_region
  name     = var.api_domain

  metadata {
    namespace = data.google_project.current.number
  }

  spec {
    route_name = module.api_service.name
  }
}

resource "google_cloud_run_domain_mapping" "ws" {
  location = var.gcp_region
  name     = var.ws_domain

  metadata {
    namespace = data.google_project.current.number
  }

  spec {
    route_name = module.ws_service.name
  }
}

locals {
  api_domain_target = try(trimsuffix(google_cloud_run_domain_mapping.api.status[0].resource_records[0].rrdata, "."), module.api_service.hostname)
  ws_domain_target  = try(trimsuffix(google_cloud_run_domain_mapping.ws.status[0].resource_records[0].rrdata, "."), module.ws_service.hostname)
}

module "dns" {
  source          = "./modules/cloudflare-dns"
  zone_id         = var.cloudflare_zone_id
  primary_domain  = var.primary_domain
  api_domain      = var.api_domain
  ws_domain       = var.ws_domain
  frontend_target = "cname.vercel-dns.com"
  api_target      = local.api_domain_target
  ws_target       = local.ws_domain_target
}

resource "google_project_iam_member" "cloud_run_cloudsql_client" {
  project = var.gcp_project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${data.google_compute_default_service_account.default.email}"
}

resource "google_project_iam_member" "cloud_run_vpcaccess" {
  project = var.gcp_project_id
  role    = "roles/vpcaccess.user"
  member  = "serviceAccount:${data.google_compute_default_service_account.default.email}"
}
