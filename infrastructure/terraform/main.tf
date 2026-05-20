# --- OIDC Provider and IAM Role for GitHub Actions ---

module "oidc_github" {
  source  = "unfunco/oidc-github/aws"
  version = "~> 3.0"

  github_subjects = [var.github_repository]

  iam_role_inline_policies = {
    deploy = data.aws_iam_policy_document.deploy.json
  }

  tags = {
    Environment = var.environment
  }
}

# --- IAM Policy for Deploy Role (least-privilege) ---

data "aws_iam_policy_document" "deploy" {
  statement {
    sid    = "S3DeployAccess"
    effect = "Allow"

    actions = [
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket",
    ]

    resources = [
      "arn:aws:s3:::${var.s3_bucket_name}",
      "arn:aws:s3:::${var.s3_bucket_name}/*",
    ]
  }

  statement {
    sid    = "CloudFrontInvalidation"
    effect = "Allow"

    actions = [
      "cloudfront:CreateInvalidation",
    ]

    resources = [
      "arn:aws:cloudfront::${var.aws_account_id}:distribution/${var.cloudfront_distribution_id}",
    ]
  }
}

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
  plaintext_value = var.aws_account_id
}

resource "github_actions_environment_secret" "oidc_role_arn" {
  repository      = local.repo_name
  environment     = github_repository_environment.production.environment
  secret_name     = "OIDC_ROLE_ARN"
  plaintext_value = module.oidc_github.iam_role_arn
}

# --- GitHub Actions Environment Variables ---

resource "github_actions_environment_variable" "s3_bucket_name" {
  repository    = local.repo_name
  environment   = github_repository_environment.production.environment
  variable_name = "S3_BUCKET_NAME"
  value         = var.s3_bucket_name
}

resource "github_actions_environment_variable" "cloudfront_dist_id" {
  repository    = local.repo_name
  environment   = github_repository_environment.production.environment
  variable_name = "CLOUDFRONT_DIST_ID"
  value         = var.cloudfront_distribution_id
}
