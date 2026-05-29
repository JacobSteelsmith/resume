# Automated Database Refresh Pipeline

## Project Overview

Jacob designed and built an automated database refresh pipeline that copies production databases to test environments on a weekly schedule. The system uses AWS ECS Fargate to execute long-running mysqldump operations, piping data directly from a production read-only endpoint into the test Aurora cluster. The pipeline incorporates multiple layers of safety guardrails to prevent accidental writes to production, enforces SSL encryption for data in transit, and performs PII anonymization after each copy to protect sensitive data in non-production environments.

The pipeline is deployed entirely via AWS CloudFormation and triggered automatically by Amazon EventBridge on a configurable weekly schedule. Jacob built this system to eliminate manual database refresh processes that were error-prone and time-consuming, while ensuring that test environments always have recent production-like data for development and QA workflows.

## Architecture

### Infrastructure Components

The pipeline architecture consists of several AWS services working together:

- **AWS CloudFormation** deploys and manages all infrastructure resources as code
- **Amazon EventBridge** triggers the ECS task on a weekly cron schedule
- **AWS ECS Fargate** runs the database refresh container without managing servers
- **Amazon Aurora MySQL** serves as both the source (production) and target (test) database clusters
- **AWS Secrets Manager** stores database credentials securely
- **Amazon SNS** sends notifications on pipeline success or failure
- **Amazon CloudWatch** captures container logs for debugging and audit trails

### Data Flow

The refresh process follows this sequence:

1. EventBridge triggers the ECS Fargate task on the configured schedule
2. The container retrieves database credentials from AWS Secrets Manager
3. Safety guardrails validate all connection parameters before proceeding
4. mysqldump connects to the production read-only endpoint with SSL verification
5. The dump output pipes directly into the test cluster (no intermediate storage)
6. After the copy completes, PII anonymization queries run against the test cluster
7. SNS notifications report success or failure to the operations team

### ECS Fargate Task Configuration

The Fargate task runs in a private subnet with VPC networking configured to reach both the production read-only endpoint and the test cluster. The task definition specifies sufficient CPU and memory for large database transfers, and the container image includes the MySQL client tools, AWS CLI, and the RDS CA certificate bundle for SSL verification.

## Design Decisions

### Fargate Over Lambda

Jacob chose ECS Fargate over AWS Lambda for this pipeline due to several technical constraints:

- **Lambda 15-minute hard timeout**: Production database dumps routinely exceed 15 minutes for large databases, making Lambda unsuitable for the core operation
- **Aurora Serverless pause/resume delays**: Aurora Serverless clusters may be paused and require several minutes to resume, consuming valuable Lambda execution time before the actual work begins
- **Long-running database operations**: The mysqldump-pipe-to-import pattern requires a sustained connection for the duration of the transfer, which can take 30-60 minutes for larger databases
- **No intermediate storage needed**: Piping directly from source to target avoids the need for temporary S3 storage and the associated Lambda memory constraints

Fargate provides up to 24 hours of execution time with no timeout concerns, making it the appropriate compute choice for variable-duration database operations.

## Safety Guardrails

### Multi-Layer Validation Architecture

Jacob implemented multiple independent safety checks that must all pass before any database operation begins. This defense-in-depth approach ensures that a single misconfiguration cannot result in accidental production data loss.

### ARN Name Validation

The pipeline validates that the production database ARN does not contain the string "test" in its identifier. This prevents scenarios where a test cluster ARN is accidentally configured as the production source, which could result in circular overwrites or data loss.

### Cluster Identifier Validation

The target cluster identifier is validated against expected naming patterns to confirm it refers to a test environment. This provides an additional layer beyond ARN validation to catch misconfigurations.

### Read-Only Endpoint Enforcement

The pipeline enforces that the production connection uses a cluster reader endpoint by validating the hostname contains the `cluster-ro-` prefix. This guarantees the pipeline connects to a read-only Aurora replica rather than the writer instance, providing database-level protection against accidental writes to production even if other guardrails fail.

### SSL Verification with RDS CA Bundle

All database connections use SSL/TLS encryption verified against the official AWS RDS Certificate Authority bundle. This ensures data in transit is encrypted and prevents man-in-the-middle attacks. The RDS CA bundle is included in the container image and referenced explicitly in connection parameters.

### Identical ARN and Cluster Abort Checks

The pipeline compares the source and target ARNs and cluster identifiers. If the source and target resolve to the same cluster, the operation aborts immediately. This prevents catastrophic scenarios where a misconfiguration causes the pipeline to dump and reimport into the same database.

## Secrets Management

### AWS Secrets Manager Integration

Jacob implemented a strict secrets management approach with no hardcoded credentials anywhere in the codebase or configuration:

- **Separate read-only credentials**: The production database connection uses dedicated read-only credentials stored in AWS Secrets Manager, limiting the blast radius if credentials are compromised
- **Separate write credentials**: The test cluster connection uses separate write-capable credentials, also stored in Secrets Manager
- **Runtime retrieval**: Credentials are fetched at task execution time, never baked into container images or task definitions
- **Automatic rotation compatibility**: The Secrets Manager integration supports credential rotation without pipeline changes
- **IAM-scoped access**: The ECS task role has least-privilege IAM policies granting access only to the specific secrets required

## PII Anonymization

### Post-Copy Data Protection

After the database copy completes, the pipeline executes a PII anonymization step against the test cluster. This process replaces personally identifiable information with synthetic data, ensuring that test environments do not contain real customer data. The anonymization covers fields such as names, email addresses, phone numbers, and other sensitive attributes identified in the data classification policy.

This approach allows test environments to maintain realistic data volumes and relationships while complying with data protection requirements. Developers and QA engineers can work with production-like data structures without exposure to actual customer information.

## Operational Features

### SNS Notifications

The pipeline sends Amazon SNS notifications on both success and failure outcomes. Success notifications include a summary of databases refreshed and timing information. Failure notifications include error details and the specific guardrail or step that failed, enabling rapid incident response.

### CloudWatch Logging

All container output streams to Amazon CloudWatch Logs, providing a complete audit trail of each pipeline execution. Log entries include timestamps, database names being processed, guardrail validation results, and transfer progress. CloudWatch log retention is configured for compliance and debugging purposes.

### Manual Trigger Capability

In addition to the weekly EventBridge schedule, the pipeline supports manual triggering for on-demand database refreshes. This allows developers to request a fresh copy of production data when needed for specific testing scenarios without waiting for the next scheduled run.

### Configurable Database List

The pipeline accepts a configurable list of databases to refresh, allowing selective copying of specific schemas rather than requiring a full cluster dump. This enables teams to refresh only the databases relevant to their current work, reducing execution time and resource consumption when a full refresh is not needed.

## Technologies

- AWS ECS Fargate, AWS CloudFormation, Amazon EventBridge
- Amazon Aurora MySQL, mysqldump, MySQL client
- AWS Secrets Manager, IAM roles and policies
- Amazon SNS, Amazon CloudWatch Logs
- SSL/TLS with RDS CA certificate bundle
- Docker containerization
- Bash scripting, AWS CLI
- PII anonymization, data masking
