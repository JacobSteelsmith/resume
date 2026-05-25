// ---
// source-type: code-sample
// category: serverless
// title: TypeScript Serverless Patterns - Amplify Gen2 CDK and Lambda Handlers
// language: typescript
// project: candidates-portal
// ---

// =============================================================================
// AWS CDK Lambda Function Definition using Amplify Gen2 Patterns
// =============================================================================
//
// In the Candidates Portal, Jacob defines all backend infrastructure within
// Amplify Gen2's defineBackend() configuration. This pattern uses AWS CDK
// constructs directly, giving full control over Lambda functions, API Gateway
// routes, IAM policies, and environment variables — all type-safe in TypeScript.

import { defineBackend } from "@aws-amplify/backend";
import { Stack } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as apigateway from "aws-cdk-lib/aws-apigatewayv2";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

// Amplify Gen2 uses defineBackend to compose auth, data, and custom resources.
// Jacob extends this with custom CDK stacks for Lambda functions that connect
// to Aurora Serverless MySQL via the RDS Data API.
const backend = defineBackend({
  // Auth and data resources defined elsewhere in the Amplify Gen2 project
});

// Retrieve the main CDK stack from the Amplify backend definition.
// All custom resources are added to this stack for unified deployment.
const apiStack = backend.createStack("CandidatesApiStack");

// Reference existing secrets stored in AWS Secrets Manager.
// Secrets are never hardcoded — each environment (sandbox, test, prod)
// has its own secret ARN resolved at deploy time.
const dbSecret = secretsmanager.Secret.fromSecretNameV2(
  apiStack,
  "DatabaseSecret",
  `candidates-portal/${getEnvironmentName()}/database-credentials`
);

// Reference the encryption key secret used for AES encryption of PII fields.
// Separate keys exist for different data domains (applicant PII, practice tests).
const encryptionKeySecret = secretsmanager.Secret.fromSecretNameV2(
  apiStack,
  "EncryptionKeySecret",
  `candidates-portal/${getEnvironmentName()}/encryption-key`
);

// =============================================================================
// Lambda Function Definition Pattern
// =============================================================================
//
// Each Lambda function in the Candidates Portal handles a single API endpoint.
// Jacob defines functions with environment-specific configuration, IAM policies
// scoped to least privilege, and shared environment variables for RDS Data API.

// Define a Lambda function for retrieving candidate profile data.
// This demonstrates the standard pattern used across 120+ functions.
const getApplicantProfileFn = new lambda.Function(apiStack, "GetApplicantProfile", {
  // Python 3.12 runtime for all Candidates Portal Lambda functions
  runtime: lambda.Runtime.PYTHON_3_12,
  // Handler points to the specific module and function entry point
  handler: "get_applicant_profile.handler",
  // Code is bundled from the Lambda functions directory
  code: lambda.Code.fromAsset("amplify/functions/applicant"),
  // 30-second timeout appropriate for RDS Data API HTTP round-trips
  timeout: Stack.of(apiStack).resolve("30s") as any,
  // Environment variables provide runtime configuration without hardcoding
  environment: {
    // Aurora cluster ARN for RDS Data API calls
    CLUSTER_ARN: getClusterArn(),
    // Secret ARN for database credentials (resolved by RDS Data API)
    SECRET_ARN: dbSecret.secretArn,
    // Database name varies by environment (test vs production)
    DATABASE_NAME: getDatabaseName(),
    // Encryption key secret ARN for decrypting PII fields in responses
    ENCRYPTION_KEY_SECRET_ARN: encryptionKeySecret.secretArn,
    // Environment identifier for conditional logic (sandbox, test, prod)
    ENVIRONMENT: getEnvironmentName(),
  },
  // Memory allocation balances cost and performance for Data API workloads
  memorySize: 256,
});

// Grant the Lambda function permission to read database credentials.
// This enables the RDS Data API to authenticate without exposing credentials.
dbSecret.grantRead(getApplicantProfileFn);

// Grant access to the encryption key for decrypting PII fields.
encryptionKeySecret.grantRead(getApplicantProfileFn);

// IAM policy for RDS Data API access — scoped to the specific Aurora cluster.
// The rds-data:ExecuteStatement permission is the core Data API operation.
getApplicantProfileFn.addToRolePolicy(
  new iam.PolicyStatement({
    // Only the permissions needed for read operations on this endpoint
    actions: [
      "rds-data:ExecuteStatement",
      "rds-data:BatchExecuteStatement",
    ],
    // Resource scoped to the specific Aurora cluster ARN
    resources: [getClusterArn()],
  })
);

// =============================================================================
// HTTP API Gateway Route Integration
// =============================================================================
//
// Amplify Gen2 projects use HTTP API Gateway (not REST API) for lower cost,
// automatic CORS handling, and native JWT authorization via Cognito.

// Reference the HTTP API created by Amplify Gen2's auth configuration.
// Routes are added programmatically with Lambda integrations.
const httpApi = apigateway.HttpApi.fromHttpApiAttributes(apiStack, "HttpApi", {
  httpApiId: backend.resolveHttpApiId(),
});

// =============================================================================
// Node.js Lambda Handler - LiveKit Token Generation
// =============================================================================
//
// Jacob built Node.js Lambda functions for the LiveKit interview platform.
// This token generation handler creates JWT access tokens that control
// participant permissions in WebRTC video interview rooms.

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { AccessToken } from "livekit-server-sdk";

// Standard CORS headers applied to all responses.
// Required for browser-based clients calling the API from different origins.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Token expiration set to 6 hours — covers the maximum interview duration
// with buffer for network reconnections without requiring token refresh.
const TOKEN_TTL_SECONDS = 6 * 60 * 60;

/**
 * Lambda handler for generating LiveKit room access tokens.
 * Accepts room name, participant identity, and display name as query params.
 * Returns a signed JWT with room-join permissions (publish + subscribe).
 *
 * This function is deployed as a Docker container via Amazon ECR,
 * using the livekit-server-sdk for token signing.
 */
export async function tokenHandler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  // Extract query parameters from the API Gateway event.
  // Room name identifies which interview session to join.
  const roomName = event.queryStringParameters?.room;
  const participantIdentity = event.queryStringParameters?.identity;
  const participantName = event.queryStringParameters?.name;

  // Validate required parameters before token generation.
  // Missing parameters return 400 to prevent invalid token creation.
  if (!roomName || !participantIdentity || !participantName) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Missing required parameters: room, identity, name",
      }),
    };
  }

  // Retrieve LiveKit API credentials from environment variables.
  // These are injected from AWS Secrets Manager at deployment time.
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  // Guard against missing configuration — fail fast with clear error.
  if (!apiKey || !apiSecret) {
    console.error("LiveKit API credentials not configured");
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Server configuration error" }),
    };
  }

  // Create a new AccessToken using the LiveKit server SDK.
  // The token encodes the participant's identity and display name.
  const token = new AccessToken(apiKey, apiSecret, {
    identity: participantIdentity,
    name: participantName,
    ttl: TOKEN_TTL_SECONDS,
  });

  // Grant room-join permission with publish and subscribe capabilities.
  // This allows the participant to send and receive audio/video tracks.
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    // canPublishData enables chat messages within the interview room
    canPublishData: true,
  });

  // Convert the token to a signed JWT string for the client.
  const jwt = await token.toJwt();

  // Return the token with CORS headers for browser consumption.
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      token: jwt,
      room: roomName,
      identity: participantIdentity,
    }),
  };
}

// =============================================================================
// Helper Functions for Environment Resolution
// =============================================================================
//
// These utilities resolve environment-specific values at deploy time.
// Amplify Gen2 provides branch-based environment detection.

// Resolve the current environment name from Amplify Gen2 branch mapping.
// Sandbox deployments use developer-specific identifiers.
function getEnvironmentName(): string {
  return process.env.AMPLIFY_ENV || "sandbox";
}

// Resolve the Aurora cluster ARN based on the deployment environment.
// Each environment connects to its own isolated database cluster.
function getClusterArn(): string {
  return process.env.CLUSTER_ARN || "";
}

// Resolve the database name for the current environment.
// Test and production use separate databases within the same cluster.
function getDatabaseName(): string {
  return process.env.DATABASE_NAME || "candidates_portal";
}
