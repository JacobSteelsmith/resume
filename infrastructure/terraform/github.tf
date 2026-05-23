# --- Local Values ---

locals {
  repo_name = split("/", var.github_repository)[1]
}

# --- GitHub Branch Protection ---

resource "github_branch_protection" "main" {
  repository_id = local.repo_name
  pattern       = "main"

  required_pull_request_reviews {
    required_approving_review_count = 1
  }

  required_status_checks {
    strict = true
  }
}

# --- GitHub Actions Environment ---

resource "github_repository_environment" "production" {
  environment = "production"
  repository  = local.repo_name
}

# --- GitHub Actions Environment Secrets ---

resource "github_actions_environment_secret" "aws_account_id" {
  repository      = local.repo_name
  environment     = github_repository_environment.production.environment
  secret_name     = "AWS_ACCOUNT_ID"
  value = var.aws_account_id
}

resource "github_actions_environment_secret" "oidc_role_arn" {
  repository      = local.repo_name
  environment     = github_repository_environment.production.environment
  secret_name     = "OIDC_ROLE_ARN"
  value = module.oidc_github.iam_role_arn
}

# --- GitHub Actions Environment Variables ---

resource "github_actions_environment_variable" "s3_bucket_name" {
  repository    = local.repo_name
  environment   = github_repository_environment.production.environment
  variable_name = "S3_BUCKET_NAME"
  value         = aws_s3_bucket.site.id
}

resource "github_actions_environment_variable" "cloudfront_dist_id" {
  repository    = local.repo_name
  environment   = github_repository_environment.production.environment
  variable_name = "CLOUDFRONT_DIST_ID"
  value         = aws_cloudfront_distribution.site.id
}
