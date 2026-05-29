# AI-Assisted Development and Testing Infrastructure

## Project Overview

Jacob built a comprehensive AI-assisted development workflow and testing infrastructure for the Candidates Portal project, a React + AWS Amplify Gen2 application with 90+ Python Lambda functions. The initiative progressed from Amazon Q Developer custom CLI agents to Kiro with hooks and steering files, establishing automated code quality guardrails and a full-stack testing pipeline. Jacob created the testing infrastructure from scratch, including pytest unit tests with process isolation, a custom test runner with CI/CD integration, and a Playwright end-to-end test framework with custom utilities for authentication, database setup, and parallel test data management.

## AI-Assisted Development Progression

### Amazon Q Developer Custom Agents

Jacob initially created custom Amazon Q Developer CLI agents to accelerate serverless development. These agents included:

- **serverless-developer agent** — Specialized in AWS Lambda, API Gateway, DynamoDB, and SAM applications. Configured with file system access to the serverless codebase and AWS service permissions in us-west-2.
- **database-expert agent** — Focused on MySQL schema exploration, query optimization, and RDS Data API patterns for Aurora Serverless.
- **project-manager agent** — Managed project documentation, ticket tracking, and cross-agent coordination for development workflows.

Each agent had scoped tool permissions, resource access patterns, and specialized system prompts tailored to its domain.

### Kiro with Hooks and Steering Files

Jacob transitioned from Amazon Q custom agents to Kiro, leveraging its hooks and steering files system for persistent, context-aware AI assistance. This approach embedded project knowledge directly into the development environment, ensuring consistent code quality across all AI-assisted development sessions.

## Kiro Steering Files for Candidates Portal

Jacob authored a comprehensive set of Kiro steering files for the Candidates Portal project, each providing domain-specific guidance:

### Database Schema Steering

Documented how to explore the MySQL database schema dynamically using the local Docker database instance. Guided correct field names, table names, database names, and foreign key relationships via `SHOW CREATE TABLE` statements. Included connection configuration and caveats about local vs. sandbox data synchronization.

### Lambda Function Patterns Steering

Defined the Python Lambda development standards including project structure (`amplify/functions/`), shared utilities (`amplify/shared/python_utils.py`), sanitization layer deployment, and the critical CDK Function construct pattern with bundling for Python Lambdas. Established that all Lambda functions follow a consistent `app.py`, `resource.ts`, and `requirements.txt` structure.

### Frontend Conventions Steering

Specified the React 18 technology stack with Vite build tooling, Tailwind CSS styling, React Context API state management, AWS Amplify v6 API client, and React Router v6 routing. Defined project structure conventions for components, contexts, pages, and utilities.

### End-to-End Testing Steering

Documented the Playwright E2E testing standards including parallel test execution patterns, worker email isolation using `getWorkerEmail()`, required setup patterns with `loadTestConfig()`, HTTP Basic Auth handling, and the custom `custom-api.js` utility library for test data management.

### Environment Variables Steering

Established the centralized environment variable approach using `amplify/shared/environment.ts` as the single source of truth. Documented separate `devEnvironment` and `prodEnvironment` configurations with automatic selection based on deployment type, ensuring Lambda functions receive consistent configuration.

### Workflow Steering

Defined the development workflow including Redmine ticket management, branch naming conventions (`rm-XXXX`), documentation requirements in `_tickets/<rm-XXXX>` directories, database update procedures, and automated test requirements for all tickets.

## Custom Kiro Hook for Timezone-Aware Datetime Validation

Jacob created a custom Kiro hook that automatically validates timezone awareness in Lambda functions. The hook triggers on any edit to files matching `amplify/functions/*/app.py` and checks for unsafe `datetime.now()` usage.

The hook enforces that all Lambda functions importing datetime must use timezone-aware datetime objects (e.g., `datetime.now(ZoneInfo("America/Los_Angeles"))`) because AWS Lambda runs in UTC by default. Without timezone awareness, datetime comparisons against Pacific Time database values produce incorrect results — a class of bug that caused production issues with deadline validation, test scheduling, and time-based business logic.

The hook references the testing steering file's timezone testing section, which documents the UTC-to-Pacific conversion patterns and required test cases for datetime logic (before deadline, after deadline, edge cases at 1 minute before/after, same-day different time, and null datetime handling).

## Testing Infrastructure

### Pytest Unit Tests with Process Isolation

Jacob built the unit testing infrastructure using Python's pytest framework with a critical design decision: each test file executes in a separate pytest process. This process isolation prevents module caching and environment variable bleeding between tests — essential when testing 90+ Lambda functions that each set different environment variables before importing their handlers.

The test structure follows a consistent pattern:
- Path manipulation to import Lambda handlers, shared utilities, and sanitization layers
- Environment variable setup before handler import
- Class-based test organization (TestMainFeature, TestEdgeCases, TestValidation)
- Mock patterns for database queries (`execute_sql_query`), authentication (`get_authenticated_id`), and AWS context objects
- Timezone testing with `freezegun` for datetime-sensitive business logic

### Custom Test Runner with CI/CD Integration

Jacob created a custom bash test runner (`run_tests.sh`) that orchestrates the isolated test execution. Features include:

- Automatic Python virtual environment activation
- Test file discovery with glob pattern matching
- Sequential execution with per-file process isolation
- Colored terminal output (green pass, red fail)
- Verbose and fail-fast modes
- Summary report with pass/fail counts and failed test listing
- CI-compatible exit codes (0 for all pass, 1 for any failure)
- Automatic dependency installation from `requirements.txt`

### Playwright E2E Test Framework

Jacob built a complete Playwright end-to-end testing framework with custom utilities that the team adopted after previous attempts at E2E testing had stalled. The framework includes:

- **Custom system-api.js utility library** — Custom functions used to create objects in the target system. 
- **Parallel test execution** — Fully parallel workers with isolated test data per worker, preventing data collisions through unique email addresses per spec file
- **Authentication utilities** — Cognito authentication setup, HTTP Basic Auth handling for protected environments, and admin authentication helpers
- **Database utilities** — Direct RDS Data API access for test data setup and teardown, database configuration loading from AWS Secrets Manager

## CI/CD Pipeline and Custom E2E Library

Jacob oversaw and was the primary creater of the CI/CD pipeline working for automated test execution. The pipeline includes:

- **E2E test runner script** — Handles AWS SSO token validation, environment-specific database configuration (sandbox vs. test), S3 CORS setup, HTTP Basic Auth credential loading from AWS Secrets Manager, and Playwright execution with multiple modes (headed, UI, debug, default)
- **Dual environment support** — Local development uses sandbox database with `amplify_outputs.json` for Cognito config; CI uses dedicated test database with hardcoded ARNs and Cognito configuration
- **Automated prerequisites** — AWS credential verification, S3 bucket CORS configuration, test file availability checks, and dependency installation
- **Test output logging** — Separate log files for CI and local runs, with HTML report generation for failed tests

## Property-Based Testing in E2E Tests

Jacob applied property-based testing principles to the E2E test suite for validating business rules across multiple scenarios. Rather than testing individual happy-path cases, the E2E tests validate properties that must hold across all valid inputs:

- Deadline validation properties tested across multiple timezone scenarios (before, after, edge cases at 1 minute boundaries)
- Payment processing properties validated across different cart configurations and payment states
- Document upload properties verified across file types, sizes, and concurrent upload scenarios
- Application workflow properties tested across different job types, agency configurations, and candidate states

This approach catches edge cases that traditional example-based E2E tests miss, particularly around timezone boundaries and concurrent data access patterns in the parallel test execution environment.

## Technologies

- Amazon Q Developer (custom CLI agents), Kiro (hooks, steering files, specs)
- Python, pytest, freezegun, unittest.mock
- Playwright, Node.js, JavaScript
- AWS Lambda, RDS Data API, Aurora Serverless MySQL, Cognito, Secrets Manager, S3
- React 18, Vite, AWS Amplify Gen2
- Bash scripting, CI/CD automation
- Process isolation testing patterns, property-based testing, parallel test execution
