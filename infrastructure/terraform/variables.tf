variable "github_repository" {
  description = "The GitHub repository in the format 'owner/repo'"
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

variable "domain_name" {
  description = "The domain name for the resume site (e.g., resume.jacob.steelsmith.org)"
  type        = string
}

variable "hosted_zone_id" {
  description = "The Route 53 hosted zone ID for the parent domain (steelsmith.org)"
  type        = string
}

variable "bedrock_model_id" {
  description = "The Bedrock foundation model ID for the RAG chatbot (e.g., anthropic.claude-3-haiku-20240307-v1:0)"
  type        = string
  default     = "anthropic.claude-3-haiku-20240307-v1:0"
}
