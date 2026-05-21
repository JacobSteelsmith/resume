# ---
# source-type: code-sample
# category: automation
# title: Knowledge Base Ingestion Script - Python
# language: python
# project: resume-site
# ---

"""
Example ingestion pipeline script for processing knowledge base content
into vector embeddings using Amazon Bedrock.

Demonstrates Python patterns for AWS SDK usage, content chunking,
and error handling in data pipelines.
"""

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

CHUNK_MIN_TOKENS = 500
CHUNK_MAX_TOKENS = 1000
CHUNK_OVERLAP_TOKENS = 100
EXCLUDED_TERMS = ["EXCLUDED_ORG_1", "EXCLUDED_ORG_2", "EXCLUDED_ORG_3"]


@dataclass
class ChunkMetadata:
    """Metadata associated with a content chunk."""

    source_type: str
    category: str
    title: str
    language: Optional[str] = None
    project: Optional[str] = None


@dataclass
class ContentChunk:
    """A chunk of content ready for embedding."""

    text: str
    metadata: ChunkMetadata
    token_count: int = 0


@dataclass
class IngestionSummary:
    """Summary report of an ingestion run."""

    files_processed: int = 0
    chunks_generated: int = 0
    embeddings_stored: int = 0
    files_skipped: int = 0
    errors: list[str] = field(default_factory=list)


def estimate_tokens(text: str) -> int:
    """Estimate token count using whitespace splitting approximation."""
    return len(text.split())


def chunk_content(text: str, metadata: ChunkMetadata) -> list[ContentChunk]:
    """Split text into overlapping chunks within token bounds."""
    words = text.split()
    chunks: list[ContentChunk] = []
    start = 0

    while start < len(words):
        end = min(start + CHUNK_MAX_TOKENS, len(words))
        chunk_words = words[start:end]
        chunk_text = " ".join(chunk_words)

        if not contains_excluded_content(chunk_text):
            chunks.append(
                ContentChunk(
                    text=chunk_text,
                    metadata=metadata,
                    token_count=len(chunk_words),
                )
            )

        start += CHUNK_MAX_TOKENS - CHUNK_OVERLAP_TOKENS

    return chunks


def contains_excluded_content(text: str) -> bool:
    """Check if text contains any excluded terms."""
    text_lower = text.lower()
    return any(term.lower() in text_lower for term in EXCLUDED_TERMS)


def parse_frontmatter(content: str) -> tuple[dict, str]:
    """Parse YAML frontmatter from file content."""
    if not content.startswith("---"):
        return {}, content

    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}, content

    import yaml

    metadata = yaml.safe_load(parts[1])
    body = parts[2].strip()
    return metadata or {}, body


def process_file(file_path: Path) -> list[ContentChunk]:
    """Process a single knowledge base file into chunks."""
    content = file_path.read_text(encoding="utf-8")

    if not content.strip():
        raise ValueError(f"Empty file: {file_path}")

    metadata_dict, body = parse_frontmatter(content)

    metadata = ChunkMetadata(
        source_type=metadata_dict.get("source-type", "unknown"),
        category=metadata_dict.get("category", "general"),
        title=metadata_dict.get("title", file_path.stem),
        language=metadata_dict.get("language"),
        project=metadata_dict.get("project"),
    )

    return chunk_content(body, metadata)


def run_ingestion(knowledge_base_dir: Path) -> IngestionSummary:
    """Run the full ingestion pipeline on a knowledge base directory."""
    summary = IngestionSummary()

    for file_path in sorted(knowledge_base_dir.rglob("*")):
        if not file_path.is_file():
            continue

        try:
            chunks = process_file(file_path)
            summary.files_processed += 1
            summary.chunks_generated += len(chunks)

            for chunk in chunks:
                store_embedding(chunk)
                summary.embeddings_stored += 1

        except (ValueError, OSError) as e:
            logger.error("Failed to process %s: %s", file_path, e)
            summary.files_skipped += 1
            summary.errors.append(f"{file_path}: {e}")

    return summary


def store_embedding(chunk: ContentChunk) -> None:
    """Store a chunk embedding in the vector database via Bedrock."""
    # In production, this calls the Bedrock embedding API
    # and stores the result in the knowledge base data source
    logger.info(
        "Storing embedding for chunk from '%s' (%d tokens)",
        chunk.metadata.title,
        chunk.token_count,
    )


if __name__ == "__main__":
    kb_path = Path("knowledge-base")
    summary = run_ingestion(kb_path)

    print(f"\nIngestion Summary:")
    print(f"  Files processed: {summary.files_processed}")
    print(f"  Chunks generated: {summary.chunks_generated}")
    print(f"  Embeddings stored: {summary.embeddings_stored}")
    print(f"  Files skipped: {summary.files_skipped}")

    if summary.errors:
        print(f"\nErrors:")
        for error in summary.errors:
            print(f"  - {error}")
