# ---
# source-type: code-sample
# category: serverless
# title: Python Serverless Patterns - Candidates Portal Lambda Functions
# language: python
# project: candidates-portal
# ---

"""
Python serverless patterns from the Candidates Portal project.
These patterns demonstrate Jacob's approach to building secure,
scalable Lambda functions with Aurora Serverless MySQL via RDS Data API.
"""

import base64
import hashlib
import json
import logging
import os
import re
import time
from typing import Any, Optional

import boto3

logger = logging.getLogger(__name__)

# ============================================================================
# RDS Data API Query Execution with Parameter Binding
# ============================================================================
# Jacob chose the RDS Data API over traditional MySQL connections because it
# eliminates connection pool management in high-concurrency Lambda environments.
# The API is HTTP-based and stateless, so each Lambda invocation does not need
# to maintain or reuse persistent database connections.
# ============================================================================


def execute_sql_query(
    sql: str,
    parameters: Optional[list[dict[str, Any]]] = None,
    transaction_id: Optional[str] = None,
) -> dict:
    """
    Execute a SQL query via the AWS RDS Data API with parameter binding.

    This wrapper standardizes all database access across 120+ Lambda functions
    in the Candidates Portal. It handles credential resolution through Secrets
    Manager and enforces parameterized queries to prevent SQL injection.

    Args:
        sql: The SQL statement with :named parameter placeholders.
        parameters: List of parameter dicts with name, value, and typeHint.
        transaction_id: Optional transaction ID for multi-statement operations.

    Returns:
        The RDS Data API response containing records and column metadata.
    """
    # Initialize the RDS Data API client
    # The client communicates over HTTPS — no VPC or security group config needed
    rds_client = boto3.client("rds-data")

    # Build the base request with cluster ARN and secret ARN from environment
    # These are injected by CDK during Lambda deployment
    request_params = {
        "resourceArn": os.environ["DB_CLUSTER_ARN"],
        "secretArn": os.environ["DB_SECRET_ARN"],
        "database": os.environ["DB_NAME"],
        "sql": sql,
        "includeResultMetadata": True,
    }

    # Attach parameters if provided — this enforces parameterized queries
    # and prevents SQL injection by separating data from query structure
    if parameters:
        request_params["parameters"] = parameters

    # Attach transaction ID for multi-statement atomic operations
    # RDS Data API supports BeginTransaction, CommitTransaction, RollbackTransaction
    if transaction_id:
        request_params["transactionId"] = transaction_id

    # Execute the query and return the full response
    # The response includes columnMetadata for mapping results to field names
    response = rds_client.execute_statement(**request_params)
    return response


def build_parameter(name: str, value: Any, type_hint: Optional[str] = None) -> dict:
    """
    Build a typed parameter dict for RDS Data API parameter binding.

    The Data API requires explicit type annotations for each parameter.
    This helper maps Python types to the correct Data API field keys.

    Args:
        name: The parameter name matching the :name placeholder in SQL.
        value: The Python value to bind.
        type_hint: Optional type hint (e.g., 'TIMESTAMP', 'DECIMAL').

    Returns:
        A parameter dict ready for the RDS Data API parameters list.
    """
    param: dict[str, Any] = {"name": name}

    # Map Python types to RDS Data API value fields
    # The API uses separate keys for each type: stringValue, longValue, etc.
    if value is None:
        param["value"] = {"isNull": True}
    elif isinstance(value, bool):
        param["value"] = {"booleanValue": value}
    elif isinstance(value, int):
        param["value"] = {"longValue": value}
    elif isinstance(value, float):
        param["value"] = {"stringValue": str(value)}
        type_hint = type_hint or "DECIMAL"
    else:
        # Default to string representation for all other types
        param["value"] = {"stringValue": str(value)}

    # Add type hint for ambiguous types like TIMESTAMP or DECIMAL
    if type_hint:
        param["typeHint"] = type_hint

    return param


def query_applicant_by_id(applicant_id: int) -> Optional[dict]:
    """
    Example of the small-queries pattern: fetch a single applicant record.

    Jacob adopted small, focused queries with minimal joins because each
    RDS Data API call incurs HTTP overhead. Targeted SELECTs execute faster
    than complex multi-table joins and improve error isolation.
    """
    # Single-table query with one parameter — optimized for Data API latency
    sql = """
        SELECT applicant_id, email, first_name_encrypted, last_name_encrypted,
               created_at, status
        FROM applicants
        WHERE applicant_id = :applicant_id
        AND is_active = 1
    """

    parameters = [build_parameter("applicant_id", applicant_id)]

    response = execute_sql_query(sql, parameters)

    # Parse the response records using column metadata
    if not response.get("records"):
        return None

    columns = [col["name"] for col in response["columnMetadata"]]
    row = response["records"][0]
    # Map each column to its corresponding value from the record
    return {
        columns[i]: _extract_field_value(row[i]) for i in range(len(columns))
    }


def _extract_field_value(field: dict) -> Any:
    """Extract the typed value from an RDS Data API field response."""
    # The API returns one key per field indicating the type
    if "isNull" in field and field["isNull"]:
        return None
    if "stringValue" in field:
        return field["stringValue"]
    if "longValue" in field:
        return field["longValue"]
    if "booleanValue" in field:
        return field["booleanValue"]
    if "doubleValue" in field:
        return field["doubleValue"]
    return None


# ============================================================================
# JWT Token Extraction and Validation from API Gateway Events
# ============================================================================
# The Candidates Portal uses AWS Cognito for authentication. API Gateway's
# built-in JWT authorizer validates the token signature and expiration before
# the Lambda is invoked. The Lambda then extracts claims from the already-
# validated token to identify the authenticated user.
# ============================================================================


def get_authenticated_applicant_id(event: dict) -> Optional[int]:
    """
    Extract the authenticated applicant ID from an API Gateway event.

    API Gateway HTTP API with JWT authorizer validates the Cognito token
    before invoking the Lambda. By the time this function runs, the token
    is already verified — we just need to extract the claims.

    Args:
        event: The API Gateway HTTP API event dict.

    Returns:
        The applicant_id from the JWT claims, or None if not present.
    """
    # API Gateway HTTP API places validated JWT claims in requestContext
    # The authorizer has already verified signature, expiration, and issuer
    request_context = event.get("requestContext", {})
    authorizer = request_context.get("authorizer", {})
    jwt_claims = authorizer.get("jwt", {}).get("claims", {})

    # Extract the Cognito subject (sub) — this is the unique user identifier
    cognito_sub = jwt_claims.get("sub")
    if not cognito_sub:
        logger.warning("No 'sub' claim found in JWT token")
        return None

    # Look up the applicant record by their Cognito sub identifier
    # This maps the auth identity to the application's internal user ID
    sql = """
        SELECT applicant_id FROM applicants
        WHERE cognito_sub = :cognito_sub AND is_active = 1
    """
    parameters = [build_parameter("cognito_sub", cognito_sub)]
    response = execute_sql_query(sql, parameters)

    if not response.get("records"):
        logger.warning("No applicant found for cognito_sub: %s", cognito_sub)
        return None

    # Return the internal applicant_id for use in subsequent queries
    return response["records"][0][0].get("longValue")


def extract_jwt_from_header(event: dict) -> Optional[str]:
    """
    Extract the raw JWT token from the Authorization header.

    Used in cases where the Lambda needs to forward the token to another
    service or inspect additional claims beyond what API Gateway provides.

    Args:
        event: The API Gateway event dict.

    Returns:
        The raw JWT string without the 'Bearer ' prefix, or None.
    """
    # Headers may be lowercase in HTTP API events
    headers = event.get("headers", {})
    auth_header = headers.get("authorization") or headers.get("Authorization")

    if not auth_header:
        return None

    # Strip the Bearer prefix to get the raw token
    if auth_header.startswith("Bearer "):
        return auth_header[7:]

    return auth_header


def decode_jwt_claims(token: str) -> dict:
    """
    Decode JWT claims without verification (token already validated by Gateway).

    This is safe because API Gateway's JWT authorizer has already verified
    the token signature, expiration, audience, and issuer before the Lambda
    is invoked. We only decode to read the payload claims.

    Args:
        token: The raw JWT string (already validated by API Gateway).

    Returns:
        The decoded claims dict from the JWT payload.
    """
    # JWT structure: header.payload.signature — we need the payload (index 1)
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid JWT format: expected 3 dot-separated parts")

    # Decode the base64url-encoded payload section
    # Add padding since JWT base64url encoding strips trailing '=' characters
    payload = parts[1]
    padding = 4 - len(payload) % 4
    if padding != 4:
        payload += "=" * padding

    decoded_bytes = base64.urlsafe_b64decode(payload)
    return json.loads(decoded_bytes)


# ============================================================================
# Input Sanitization for XSS Prevention
# ============================================================================
# The Candidates Portal sanitizes all user input on both frontend (DOMPurify)
# and backend (Lambda functions). This defense-in-depth approach ensures that
# even if frontend validation is bypassed, malicious content cannot be stored
# in the database or reflected back to other users.
# ============================================================================

# Pattern matching potentially dangerous HTML/script content
# These patterns catch common XSS vectors including script tags, event handlers,
# javascript: URIs, and data: URIs that could execute code
DANGEROUS_PATTERNS = [
    re.compile(r"<script[^>]*>.*?</script>", re.IGNORECASE | re.DOTALL),
    re.compile(r"<iframe[^>]*>.*?</iframe>", re.IGNORECASE | re.DOTALL),
    re.compile(r"javascript:", re.IGNORECASE),
    re.compile(r"on\w+\s*=", re.IGNORECASE),
    re.compile(r"data:\s*text/html", re.IGNORECASE),
]

# Allowed HTML tags for fields that support basic formatting (e.g., job descriptions)
ALLOWED_TAGS = {"b", "i", "em", "strong", "p", "br", "ul", "ol", "li"}


def sanitize_input(value: str, allow_html: bool = False) -> str:
    """
    Sanitize user input to prevent XSS and injection attacks.

    Applied to all user-submitted text before database storage. This is the
    backend complement to frontend DOMPurify sanitization, providing
    defense-in-depth against XSS even if the frontend is bypassed.

    Args:
        value: The raw user input string.
        allow_html: If True, permit a whitelist of safe formatting tags.

    Returns:
        The sanitized string safe for storage and rendering.
    """
    if not value:
        return value

    # Strip null bytes which can bypass other sanitization checks
    sanitized = value.replace("\x00", "")

    # Remove any detected dangerous patterns (scripts, iframes, event handlers)
    for pattern in DANGEROUS_PATTERNS:
        sanitized = pattern.sub("", sanitized)

    if not allow_html:
        # Strip ALL HTML tags when HTML is not permitted for this field
        sanitized = re.sub(r"<[^>]+>", "", sanitized)
    else:
        # Remove only disallowed tags, keeping safe formatting tags
        sanitized = _strip_disallowed_tags(sanitized)

    # Normalize whitespace — collapse multiple spaces and trim
    sanitized = " ".join(sanitized.split())

    return sanitized.strip()


def _strip_disallowed_tags(html: str) -> str:
    """
    Remove HTML tags not in the ALLOWED_TAGS whitelist.

    Keeps safe formatting tags (bold, italic, lists) while removing
    any potentially dangerous elements like div, span, or custom tags.
    """
    def replace_tag(match):
        tag_content = match.group(1)
        # Extract the tag name from the match (handles closing tags and attributes)
        tag_name = tag_content.strip("/").split()[0].lower() if tag_content else ""
        # Only keep tags that are in our safe whitelist
        if tag_name in ALLOWED_TAGS:
            return match.group(0)
        return ""

    # Match opening and closing HTML tags
    return re.sub(r"<(/?\s*[^>]+)>", replace_tag, html)


def validate_email_format(email: str) -> bool:
    """
    Validate email format before processing.

    Basic format validation prevents malformed data from entering the system.
    Cognito handles full email verification during registration.
    """
    # Simple pattern check — Cognito performs authoritative validation
    pattern = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
    return bool(pattern.match(email))


# ============================================================================
# AES Encryption/Decryption for PII Protection
# ============================================================================
# Sensitive applicant data is encrypted
# at rest using AES encryption. Encryption keys are stored in AWS Secrets
# Manager and cached in Lambda memory to reduce API calls. This ensures PII
# is protected even if the database is compromised.
# ============================================================================

# Cache for encryption keys — avoids repeated Secrets Manager calls
# Keys are cached for the lifetime of the Lambda execution environment
# (typically 5-15 minutes between cold starts)
_encryption_key_cache: dict[str, dict] = {}
_cache_timestamp: float = 0.0
CACHE_TTL_SECONDS = 300  # 5-minute TTL for key cache


def get_encryption_key(secret_name: Optional[str] = None) -> bytes:
    """
    Retrieve the AES encryption key from AWS Secrets Manager with caching.

    Keys are cached in Lambda memory with a 5-minute TTL to balance security
    (key rotation) with performance (reducing Secrets Manager API calls).
    Each Lambda environment maintains its own cache.

    Args:
        secret_name: The Secrets Manager secret name. Defaults to env var.

    Returns:
        The raw AES key bytes for encryption/decryption operations.
    """
    global _encryption_key_cache, _cache_timestamp

    secret_name = secret_name or os.environ.get("ENCRYPTION_SECRET_ARN", "")

    # Check if cached key is still valid (within TTL)
    current_time = time.time()
    if (
        secret_name in _encryption_key_cache
        and (current_time - _cache_timestamp) < CACHE_TTL_SECONDS
    ):
        return _encryption_key_cache[secret_name]["key"]

    # Fetch fresh key from Secrets Manager
    secrets_client = boto3.client("secretsmanager")
    response = secrets_client.get_secret_value(SecretId=secret_name)

    # Parse the secret — stored as JSON with an 'encryption_key' field
    secret_data = json.loads(response["SecretString"])
    key_string = secret_data["encryption_key"]

    # Derive a 32-byte AES-256 key using SHA-256 hash of the stored key
    # This ensures consistent key length regardless of the stored secret format
    key_bytes = hashlib.sha256(key_string.encode("utf-8")).digest()

    # Update the cache with the fresh key
    _encryption_key_cache[secret_name] = {"key": key_bytes}
    _cache_timestamp = current_time

    return key_bytes


def encrypt_pii(plaintext: str, secret_name: Optional[str] = None) -> str:
    """
    Encrypt a PII field value using AES for secure database storage.

    Used for sensitive fields.
    The encrypted value is base64-encoded for safe storage in MySQL VARCHAR columns.

    Args:
        plaintext: The sensitive value to encrypt (e.g., applicant name).
        secret_name: Optional override for the Secrets Manager secret name.

    Returns:
        Base64-encoded encrypted string safe for database storage.
    """
    if not plaintext:
        return plaintext

    # Retrieve the AES key (from cache or Secrets Manager)
    key = get_encryption_key(secret_name)

    # Generate a random 16-byte initialization vector for this encryption
    # Each encryption uses a unique IV so identical plaintexts produce different ciphertexts
    iv = os.urandom(16)

    # Pad plaintext to AES block size (16 bytes) using PKCS7 padding
    plaintext_bytes = plaintext.encode("utf-8")
    padding_length = 16 - (len(plaintext_bytes) % 16)
    padded = plaintext_bytes + bytes([padding_length] * padding_length)

    # Encrypt using AES-256-CBC mode
    # In production, this uses the cryptography library's Cipher class
    # Simplified here to demonstrate the pattern
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    encryptor = cipher.encryptor()
    ciphertext = encryptor.update(padded) + encryptor.finalize()

    # Prepend IV to ciphertext and base64-encode for VARCHAR storage
    # Format: base64(IV + ciphertext) — IV is needed for decryption
    encrypted_blob = iv + ciphertext
    return base64.b64encode(encrypted_blob).decode("utf-8")


def decrypt_pii(encrypted_value: str, secret_name: Optional[str] = None) -> str:
    """
    Decrypt a PII field value retrieved from the database.

    Reverses the encrypt_pii operation to recover the original plaintext.
    Called when applicant data needs to be displayed or processed.

    Args:
        encrypted_value: The base64-encoded encrypted string from the database.
        secret_name: Optional override for the Secrets Manager secret name.

    Returns:
        The decrypted plaintext value.
    """
    if not encrypted_value:
        return encrypted_value

    # Retrieve the AES key (from cache or Secrets Manager)
    key = get_encryption_key(secret_name)

    # Decode the base64 blob and split into IV and ciphertext
    encrypted_blob = base64.b64decode(encrypted_value)
    iv = encrypted_blob[:16]  # First 16 bytes are the IV
    ciphertext = encrypted_blob[16:]  # Remainder is the encrypted data

    # Decrypt using AES-256-CBC with the extracted IV
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    decryptor = cipher.decryptor()
    padded_plaintext = decryptor.update(ciphertext) + decryptor.finalize()

    # Remove PKCS7 padding to recover original plaintext
    padding_length = padded_plaintext[-1]
    plaintext_bytes = padded_plaintext[:-padding_length]

    return plaintext_bytes.decode("utf-8")


# ============================================================================
# Lambda Handler Pattern — Standardized Response Format
# ============================================================================
# All Lambda handlers in the Candidates Portal follow this pattern:
# 1. Extract and validate the authenticated user from JWT claims
# 2. Parse and sanitize request input
# 3. Execute business logic with parameterized database queries
# 4. Return a standardized JSON response with CORS headers
# ============================================================================


def create_response(status_code: int, body: Any) -> dict:
    """
    Create a standardized API Gateway response with CORS headers.

    Every Lambda function uses this helper to ensure consistent response
    formatting and proper CORS configuration for the React frontend.

    Args:
        status_code: HTTP status code (200, 400, 401, 500, etc.).
        body: Response payload — will be JSON-serialized.

    Returns:
        API Gateway-compatible response dict with headers and body.
    """
    return {
        "statusCode": status_code,
        # CORS headers as a fallback — the HTTP API Gateway handles CORS
        # automatically, but these ensure correct behavior if the Lambda is
        # invoked directly or through a different integration point
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": os.environ.get("ALLOWED_ORIGIN", "*"),
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        },
        "body": json.dumps(body, default=str),
    }


def lambda_handler(event: dict, context: Any) -> dict:
    """
    Example Lambda handler demonstrating the standard request processing pattern.

    This pattern is used across all 120+ Lambda functions in the Candidates Portal.
    Each handler follows the same structure: authenticate, validate, execute, respond.
    """
    try:
        # Step 1: Extract authenticated user from the validated JWT
        applicant_id = get_authenticated_applicant_id(event)
        if not applicant_id:
            return create_response(401, {"error": "Authentication required"})

        # Step 2: Parse and sanitize the request body
        body = json.loads(event.get("body", "{}"))
        first_name = sanitize_input(body.get("first_name", ""))
        last_name = sanitize_input(body.get("last_name", ""))

        # Step 3: Encrypt PII fields before database storage
        encrypted_first = encrypt_pii(first_name)
        encrypted_last = encrypt_pii(last_name)

        # Step 4: Execute parameterized query via RDS Data API
        sql = """
            UPDATE example
            SET col1_encrypted = :col1,
                col2_encrypted = :col2,
                updated_at = NOW()
            WHERE id = :col3
        """
        parameters = [
            build_parameter("col1", encrypted_first),
            build_parameter("col2", encrypted_last),
            build_parameter("col3", applicant_id),
        ]
        execute_sql_query(sql, parameters)

        # Step 5: Return success response with CORS headers
        return create_response(200, {"message": "Profile updated successfully"})

    except json.JSONDecodeError:
        # Handle malformed request body
        return create_response(400, {"error": "Invalid request body"})
    except Exception as e:
        # Log the full error for debugging, return generic message to client
        logger.exception("Unexpected error in lambda_handler")
        return create_response(500, {"error": "Internal server error"})
