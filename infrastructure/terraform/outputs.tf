output "oidc_role_arn" {
  description = "The ARN of the IAM role assumable by GitHub Actions via OIDC"
  value       = module.oidc_github.iam_role_arn
}

# --- Hosting Outputs ---

output "bucket_name" {
  description = "The name of the S3 bucket for static site hosting"
  value       = aws_s3_bucket.site.id
}

output "distribution_id" {
  description = "The CloudFront distribution ID"
  value       = aws_cloudfront_distribution.site.id
}

output "distribution_domain_name" {
  description = "The CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.site.domain_name
}

# --- Chatbot Outputs ---

output "api_endpoint" {
  description = "The API Gateway endpoint URL for the chat API"
  value       = aws_api_gateway_stage.prod.invoke_url
}

output "knowledge_base_id" {
  description = "The Bedrock Knowledge Base ID"
  value       = aws_bedrockagent_knowledge_base.resume.id
}
