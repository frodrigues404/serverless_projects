locals {
  common_tags = {
    Owner       = var.owner
    Environment = var.environment
  }
}

variable "owner" {
  description = "The owner of the infrastructure"
  type        = string
  default     = "Fernando"
}

variable "environment" {
  description = "The environment of the infrastructure"
  type        = string
  default     = "development"
}

variable "region" {
  description = "The AWS region"
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "DNS domain name"
  type        = string
  default     = "fernandojrlinux.net"
}