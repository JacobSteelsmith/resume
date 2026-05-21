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
      aws_s3_bucket.site.arn,
      "${aws_s3_bucket.site.arn}/*",
    ]
  }

  statement {
    sid    = "CloudFrontInvalidation"
    effect = "Allow"

    actions = [
      "cloudfront:CreateInvalidation",
    ]

    resources = [
      aws_cloudfront_distribution.site.arn,
    ]
  }
}
