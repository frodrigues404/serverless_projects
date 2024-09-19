terraform {
  backend "s3" {
    bucket = "fernando.rodrigues-tfstates"
    key    = "serverless-project/terraform.tfstate"
    region = "us-east-1"
  }
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.67.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}