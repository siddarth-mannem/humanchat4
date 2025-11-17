variable "zone_id" { type = string }
variable "primary_domain" { type = string }
variable "api_domain" { type = string }
variable "ws_domain" { type = string }
variable "frontend_target" { type = string }
variable "api_target" { type = string }
variable "ws_target" { type = string }

resource "cloudflare_record" "root" {
  zone_id = var.zone_id
  name    = var.primary_domain
  type    = "CNAME"
  value   = var.frontend_target
  proxied = true
}

resource "cloudflare_record" "api" {
  zone_id = var.zone_id
  name    = var.api_domain
  type    = "CNAME"
  value   = var.api_target
  proxied = true
}

resource "cloudflare_record" "ws" {
  zone_id = var.zone_id
  name    = var.ws_domain
  type    = "CNAME"
  value   = var.ws_target
  proxied = true
}
