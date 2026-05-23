# --- API Gateway REST API ---

resource "aws_api_gateway_rest_api" "chat" {
  name        = "${var.domain_name}-chat-api"
  description = "Chat API for RAG agent on ${var.domain_name}"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = {
    Environment = var.environment
  }
}

resource "aws_api_gateway_resource" "chat" {
  rest_api_id = aws_api_gateway_rest_api.chat.id
  parent_id   = aws_api_gateway_rest_api.chat.root_resource_id
  path_part   = "chat"
}

resource "aws_api_gateway_method" "chat_post" {
  rest_api_id   = aws_api_gateway_rest_api.chat.id
  resource_id   = aws_api_gateway_resource.chat.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "chat_lambda" {
  rest_api_id             = aws_api_gateway_rest_api.chat.id
  resource_id             = aws_api_gateway_resource.chat.id
  http_method             = aws_api_gateway_method.chat_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.chat_handler.invoke_arn
}

# --- CORS Configuration ---

resource "aws_api_gateway_method" "chat_options" {
  rest_api_id   = aws_api_gateway_rest_api.chat.id
  resource_id   = aws_api_gateway_resource.chat.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "chat_options" {
  rest_api_id = aws_api_gateway_rest_api.chat.id
  resource_id = aws_api_gateway_resource.chat.id
  http_method = aws_api_gateway_method.chat_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "chat_options_200" {
  rest_api_id = aws_api_gateway_rest_api.chat.id
  resource_id = aws_api_gateway_resource.chat.id
  http_method = aws_api_gateway_method.chat_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }

  response_models = {
    "application/json" = "Empty"
  }
}

resource "aws_api_gateway_integration_response" "chat_options" {
  rest_api_id = aws_api_gateway_rest_api.chat.id
  resource_id = aws_api_gateway_resource.chat.id
  http_method = aws_api_gateway_method.chat_options.http_method
  status_code = aws_api_gateway_method_response.chat_options_200.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'https://${var.domain_name}'"
  }
}

# --- API Gateway Deployment and Stage ---

resource "aws_api_gateway_deployment" "chat" {
  rest_api_id = aws_api_gateway_rest_api.chat.id

  depends_on = [
    aws_api_gateway_integration.chat_lambda,
    aws_api_gateway_integration.chat_options,
  ]

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.chat.id
  rest_api_id   = aws_api_gateway_rest_api.chat.id
  stage_name    = "prod"

  tags = {
    Environment = var.environment
  }
}

# --- API Gateway Usage Plan (100 req/min global rate limit) ---

resource "aws_api_gateway_usage_plan" "chat" {
  name        = "${var.domain_name}-chat-usage-plan"
  description = "Usage plan for chat API with 100 req/min throttle"

  api_stages {
    api_id = aws_api_gateway_rest_api.chat.id
    stage  = aws_api_gateway_stage.prod.stage_name
  }

  throttle_settings {
    rate_limit  = 100
    burst_limit = 50
  }

  tags = {
    Environment = var.environment
  }
}

# --- WAF Web ACL (per-IP rate-based rule: 10 req/min = 600 per 5-min window) ---

resource "aws_wafv2_web_acl" "chat_api" {
  name        = "${replace(var.domain_name, ".", "-")}-chat-waf"
  description = "WAF for chat API with per-IP rate limiting"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "per-ip-rate-limit"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 600
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "ChatAPIPerIPRateLimit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "ChatAPIWebACL"
    sampled_requests_enabled   = true
  }

  tags = {
    Environment = var.environment
  }
}

resource "aws_wafv2_web_acl_association" "chat_api" {
  resource_arn = aws_api_gateway_stage.prod.arn
  web_acl_arn  = aws_wafv2_web_acl.chat_api.arn
}

# --- Lambda Function for RAG Agent ---

data "archive_file" "chat_handler_placeholder" {
  type        = "zip"
  output_path = "${path.module}/chat-handler-placeholder.zip"

  source {
    content  = "exports.handler = async (event) => { return { statusCode: 501, headers: { 'Access-Control-Allow-Origin': 'https://${var.domain_name}', 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Access-Control-Allow-Methods': 'POST,OPTIONS' }, body: JSON.stringify({ message: 'Not implemented' }) }; };"
    filename = "index.js"
  }
}

resource "aws_lambda_function" "chat_handler" {
  function_name    = "${replace(var.domain_name, ".", "-")}-chat-handler"
  description      = "RAG agent handler for resume chat API"
  role             = aws_iam_role.chat_lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30
  memory_size      = 256
  filename         = data.archive_file.chat_handler_placeholder.output_path
  source_code_hash = data.archive_file.chat_handler_placeholder.output_base64sha256

  environment {
    variables = {
      KNOWLEDGE_BASE_ID = aws_bedrockagent_knowledge_base.resume.id
      BEDROCK_MODEL_ID  = var.bedrock_model_id
      BEDROCK_REGION    = var.aws_region
      ALLOWED_ORIGIN    = "https://${var.domain_name}"
    }
  }

  tags = {
    Environment = var.environment
  }
}

resource "aws_lambda_permission" "chat_api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.chat_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.chat.execution_arn}/*/*"
}

# --- IAM Role for Lambda (least-privilege Bedrock access) ---

data "aws_iam_policy_document" "chat_lambda_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "chat_lambda" {
  name               = "${replace(var.domain_name, ".", "-")}-chat-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.chat_lambda_assume_role.json

  tags = {
    Environment = var.environment
  }
}

data "aws_iam_policy_document" "chat_lambda_policy" {
  # Basic Lambda execution - CloudWatch Logs
  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"

    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]

    resources = [
      "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/${replace(var.domain_name, ".", "-")}-chat-handler:*",
    ]
  }

  # Bedrock InvokeModel - scoped to specific model
  # Bedrock InvokeModel - scoped to inference profile and underlying model
  statement {
    sid    = "BedrockInvokeModel"
    effect = "Allow"

    actions = [
      "bedrock:InvokeModel",
    ]

    resources = [
      "arn:aws:bedrock:${var.aws_region}::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
      "arn:aws:bedrock:${var.aws_region}::inference-profile/${var.bedrock_model_id}",
    ]
  }

  # Bedrock Retrieve - scoped to specific knowledge base
  statement {
    sid    = "BedrockRetrieve"
    effect = "Allow"

    actions = [
      "bedrock:Retrieve",
    ]

    resources = [
      aws_bedrockagent_knowledge_base.resume.arn,
    ]
  }

  # Bedrock RetrieveAndGenerate requires additional permission
  statement {
    sid    = "BedrockRetrieveAndGenerate"
    effect = "Allow"

    actions = [
      "bedrock:RetrieveAndGenerate",
    ]

    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "chat_lambda" {
  name   = "chat-lambda-policy"
  role   = aws_iam_role.chat_lambda.id
  policy = data.aws_iam_policy_document.chat_lambda_policy.json
}

# --- Knowledge Base S3 Bucket ---

resource "aws_s3_bucket" "knowledge_base" {
  bucket = "${replace(var.domain_name, ".", "-")}-knowledge-base"

  tags = {
    Environment = var.environment
  }
}

resource "aws_s3_bucket_public_access_block" "knowledge_base" {
  bucket = aws_s3_bucket.knowledge_base.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# --- IAM Role for Bedrock Knowledge Base ---

data "aws_iam_policy_document" "knowledge_base_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["bedrock.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.aws_account_id]
    }
  }
}

resource "aws_iam_role" "knowledge_base" {
  name               = "${replace(var.domain_name, ".", "-")}-kb-role"
  assume_role_policy = data.aws_iam_policy_document.knowledge_base_assume_role.json

  tags = {
    Environment = var.environment
  }
}

data "aws_iam_policy_document" "knowledge_base_policy" {
  # S3 access for knowledge base content
  statement {
    sid    = "S3ReadAccess"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:ListBucket",
    ]

    resources = [
      aws_s3_bucket.knowledge_base.arn,
      "${aws_s3_bucket.knowledge_base.arn}/*",
    ]
  }

  # Bedrock embedding model access
  statement {
    sid    = "BedrockInvokeModel"
    effect = "Allow"

    actions = [
      "bedrock:InvokeModel",
    ]

    resources = [
      "arn:aws:bedrock:${var.aws_region}::foundation-model/amazon.titan-embed-text-v2:0",
    ]
  }

  # OpenSearch Serverless access for vector storage
  statement {
    sid    = "AOSSAccess"
    effect = "Allow"

    actions = [
      "aoss:APIAccessAll",
    ]

    resources = [
      aws_opensearchserverless_collection.kb.arn,
    ]
  }
}

resource "aws_iam_role_policy" "knowledge_base" {
  name   = "knowledge-base-policy"
  role   = aws_iam_role.knowledge_base.id
  policy = data.aws_iam_policy_document.knowledge_base_policy.json
}

# --- OpenSearch Serverless Collection for Knowledge Base ---

locals {
  # AOSS names have a 32-char limit; use a short prefix
  aoss_name = "resume-kb"
}

resource "aws_opensearchserverless_security_policy" "kb_encryption" {
  name = "${local.aoss_name}-enc"
  type = "encryption"

  policy = jsonencode({
    Rules = [
      {
        Resource     = ["collection/${local.aoss_name}"]
        ResourceType = "collection"
      }
    ]
    AWSOwnedKey = true
  })
}

resource "aws_opensearchserverless_security_policy" "kb_network" {
  name = "${local.aoss_name}-net"
  type = "network"

  policy = jsonencode([
    {
      Rules = [
        {
          Resource     = ["collection/${local.aoss_name}"]
          ResourceType = "collection"
        }
      ]
      AllowFromPublic = true
    }
  ])
}

resource "aws_opensearchserverless_access_policy" "kb_data" {
  name = "${local.aoss_name}-data"
  type = "data"

  policy = jsonencode([
    {
      Rules = [
        {
          Resource     = ["collection/${local.aoss_name}"]
          ResourceType = "collection"
          Permission = [
            "aoss:CreateCollectionItems",
            "aoss:DeleteCollectionItems",
            "aoss:UpdateCollectionItems",
            "aoss:DescribeCollectionItems"
          ]
        },
        {
          Resource     = ["index/${local.aoss_name}/*"]
          ResourceType = "index"
          Permission = [
            "aoss:CreateIndex",
            "aoss:DeleteIndex",
            "aoss:UpdateIndex",
            "aoss:DescribeIndex",
            "aoss:ReadDocument",
            "aoss:WriteDocument"
          ]
        }
      ]
      Principal = [
        aws_iam_role.knowledge_base.arn,
        "arn:aws:iam::${var.aws_account_id}:root"
      ]
    }
  ])
}

resource "aws_opensearchserverless_collection" "kb" {
  name = local.aoss_name
  type = "VECTORSEARCH"

  depends_on = [
    aws_opensearchserverless_security_policy.kb_encryption,
    aws_opensearchserverless_security_policy.kb_network,
    aws_opensearchserverless_access_policy.kb_data,
  ]

  tags = {
    Environment = var.environment
  }
}

# --- OpenSearch Provider (for creating the vector index) ---

provider "opensearch" {
  url                   = aws_opensearchserverless_collection.kb.collection_endpoint
  healthcheck           = false
  aws_region            = var.aws_region
  sign_aws_requests     = true
  aws_signature_service = "aoss"
}

# --- Vector Index in OpenSearch Serverless ---

resource "opensearch_index" "kb_vector" {
  name               = "bedrock-knowledge-base-default-index"
  number_of_shards   = "2"
  number_of_replicas = "0"
  index_knn          = true
  force_destroy      = true

  mappings = jsonencode({
    properties = {
      "bedrock-knowledge-base-default-vector" = {
        type      = "knn_vector"
        dimension = 1024
        method = {
          name       = "hnsw"
          engine     = "faiss"
          parameters = {
            m               = 16
            ef_construction = 512
          }
          space_type = "l2"
        }
      }
      "AMAZON_BEDROCK_METADATA" = {
        type  = "text"
        index = false
      }
      "AMAZON_BEDROCK_TEXT_CHUNK" = {
        type = "text"
      }
    }
  })

  lifecycle {
    ignore_changes = [mappings]
  }

  depends_on = [
    aws_opensearchserverless_collection.kb,
  ]
}

# --- Bedrock Knowledge Base ---

resource "aws_bedrockagent_knowledge_base" "resume" {
  name     = "${replace(var.domain_name, ".", "-")}-knowledge-base"
  role_arn = aws_iam_role.knowledge_base.arn

  knowledge_base_configuration {
    type = "VECTOR"

    vector_knowledge_base_configuration {
      embedding_model_arn = "arn:aws:bedrock:${var.aws_region}::foundation-model/amazon.titan-embed-text-v2:0"

      embedding_model_configuration {
        bedrock_embedding_model_configuration {
          dimensions = 1024
        }
      }
    }
  }

  storage_configuration {
    type = "OPENSEARCH_SERVERLESS"

    opensearch_serverless_configuration {
      collection_arn    = aws_opensearchserverless_collection.kb.arn
      vector_index_name = "bedrock-knowledge-base-default-index"

      field_mapping {
        vector_field   = "bedrock-knowledge-base-default-vector"
        text_field     = "AMAZON_BEDROCK_TEXT_CHUNK"
        metadata_field = "AMAZON_BEDROCK_METADATA"
      }
    }
  }

  depends_on = [
    aws_opensearchserverless_collection.kb,
    opensearch_index.kb_vector,
  ]

  tags = {
    Environment = var.environment
  }
}

# --- Bedrock Knowledge Base Data Source ---

resource "aws_bedrockagent_data_source" "resume" {
  name              = "${replace(var.domain_name, ".", "-")}-kb-data-source"
  knowledge_base_id = aws_bedrockagent_knowledge_base.resume.id

  data_source_configuration {
    type = "S3"

    s3_configuration {
      bucket_arn = aws_s3_bucket.knowledge_base.arn
    }
  }

  vector_ingestion_configuration {
    chunking_configuration {
      chunking_strategy = "FIXED_SIZE"

      fixed_size_chunking_configuration {
        max_tokens         = 1000
        overlap_percentage = 10
      }
    }
  }
}
