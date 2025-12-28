output "frontend_domain" {
  value = module.frontend.hosted_domain
}

output "api_hostname" {
  value = module.api_service.hostname
}

output "ws_hostname" {
  value = module.ws_service.hostname
}
