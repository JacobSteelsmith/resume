# --- OIDC Provider and IAM Role for GitHub Actions ---

module "oidc_github" {
  source  = "unfunco/oidc-github/aws"
  version = "~> 3.0"

  github_subjects = [
    "${var.github_repository}:ref:refs/heads/master",
    "${var.github_repository}:pull_request",
    "${var.github_repository}:environment:production",
  ]

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

  statement {
    sid    = "LambdaDeploy"
    effect = "Allow"

    actions = [
      "lambda:UpdateFunctionCode",
    ]

    resources = [
      aws_lambda_function.chat_handler.arn,
    ]
  }

  statement {
    sid    = "KnowledgeBaseS3Sync"
    effect = "Allow"

    actions = [
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket",
    ]

    resources = [
      aws_s3_bucket.knowledge_base.arn,
      "${aws_s3_bucket.knowledge_base.arn}/*",
    ]
  }

  statement {
    sid    = "BedrockIngestion"
    effect = "Allow"

    actions = [
      "bedrock:StartIngestionJob",
    ]

    resources = [
      aws_bedrockagent_knowledge_base.resume.arn,
    ]
  }
}
