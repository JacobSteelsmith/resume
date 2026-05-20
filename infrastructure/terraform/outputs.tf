output "oidc_role_arn" {
  description = "The ARN of the IAM role assumable by GitHub Actions via OIDC"
  value       = module.oidc_github.iam_role_arn
}
