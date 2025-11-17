variable "project_name" { type = string }
variable "domain" { type = string }
variable "vercel_team" { type = string }
variable "env_variables" { type = map(string) }

resource "vercel_project" "this" {
  name = var.project_name
  framework = "nextjs"
  git_repository {
    type = "github"
    repo = var.project_name
  }
}

resource "vercel_project_environment_variable" "vars" {
  for_each = var.env_variables
  project_id = vercel_project.this.id
  key        = each.key
  value      = each.value
  target     = ["production"]
}

resource "vercel_project_domain" "primary" {
  project_id = vercel_project.this.id
  domain     = var.domain
}

output "hosted_domain" {
  value = vercel_project_domain.primary.domain
}
