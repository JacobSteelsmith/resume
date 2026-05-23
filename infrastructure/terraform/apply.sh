#!/usr/bin/env bash
#
# apply.sh - Run terraform apply with proper credential setup
#
# The opensearch provider (used to create the vector index in OpenSearch
# Serverless) doesn't support the `aws login` credential type directly.
# It relies on standard environment variables for AWS authentication.
#
# This script exports your current AWS session credentials as env vars
# before running terraform, so both the aws and opensearch providers
# can authenticate successfully.
#
# Usage:
#   ./apply.sh          # runs terraform apply
#   ./apply.sh plan     # runs terraform plan
#   ./apply.sh destroy  # runs terraform destroy
#
# Prerequisites:
#   - Run `aws login` first to establish a session
#   - Ensure terraform is initialized (`terraform init`)

set -euo pipefail

# Export AWS credentials from the current session as environment variables.
# This converts the `aws login` session into AWS_ACCESS_KEY_ID,
# AWS_SECRET_ACCESS_KEY, and AWS_SESSION_TOKEN env vars that the
# opensearch provider can use.
eval "$(aws configure export-credentials --format env)"

# Default to 'apply' if no argument provided
COMMAND="${1:-apply}"

terraform "$COMMAND"
