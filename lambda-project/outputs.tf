output "api_gateway_url" {
  value = module.api_gateway.api_endpoint
}

output "user_images-s3_bucket_arn" {
  value = module.user_images.s3_bucket_arn
}

output "image_queue_arn" {
  value = module.sqs.userinfo.queue_url
}

output "user_queue_arn" {
  value = module.sqs.userimage.queue_url
}