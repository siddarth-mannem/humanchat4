output "frontend_domain" {
  value = module.frontend.hosted_domain
}

output "api_hostname" {
  value = module.api.hostname
}

output "ws_hostname" {
  value = module.ws.hostname
}

output "database_url" {
  value     = module.database.database_url
  sensitive = true
}

output "redis_url" {
  value     = module.redis.redis_url
  sensitive = true
}
