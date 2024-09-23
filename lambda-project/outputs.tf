output "dynamodb_table_arn" {
  value = module.dynamodb_table.dynamodb_table_arn
}

output "api_gateway_url" {
  value = module.api_gateway.api_endpoint
}