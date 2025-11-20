# Supabase Module

Terraform module that provisions a Supabase project and an optional read replica.

## Inputs
- `project_name` – project display name in the Supabase dashboard.
- `region` – Supabase region slug (e.g., `us-east-1`).
- `enable_replicas` – set to `true` to create a single read replica in the same region.

## Outputs
- `database_url` – Postgres connection string returned by the managed project (marked sensitive).

## Usage
```hcl
module "supabase" {
  source          = "./infra/modules/supabase"
  project_name    = "humanchat"
  region          = "us-east-1"
  enable_replicas = true
}
```

Apply via `terraform init && terraform apply` inside the module's consumer; no additional documentation references are required.
