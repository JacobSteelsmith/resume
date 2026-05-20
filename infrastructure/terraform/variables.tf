variable "github_repository" {
  description = "The GitHub repository in the format 'owner/repo'"
  type        = string
}

variable "s3_bucket_name" {
  description = "The name of the S3 bucket for static site hosting (from CloudFormation output)"
  type        = string
}

variable "cloudfront_distribution_id" {
  description = "The CloudFront distribution ID (from CloudFormation output)"
  type        = string
}

variable "aws_account_id" {
  description = "The AWS account ID"
  type        = string
  sensitive   = true
}

variable "aws_region" {
  description = "The AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "The deployment environment (e.g., production, staging)"
  type        = string
  default     = "production"
}
