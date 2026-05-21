/**
 * Knowledge Base Ingestion Pipeline
 *
 * Reads knowledge-base files, chunks content with configurable token size and overlap,
 * filters out excluded content, generates embeddings via Bedrock, and syncs with
 * the Bedrock Knowledge Base data source.
 *
 * Usage: npm run ingest
 *
 * Environment variables:
 *   KNOWLEDGE_BASE_ID - Bedrock Knowledge Base ID
 *   DATA_SOURCE_ID    - Bedrock Data Source ID
 *   KB_BUCKET_NAME    - S3 bucket for knowledge base content
 *   AWS_REGION        - AWS region (default: us-east-1)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import matter from 'gray-matter';
import {
  BedrockAgentClient,
  StartIngestionJobCommand,
  GetIngestionJobCommand,
} from '@aws-sdk/client-bedrock-agent';
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

// --- Configuration ---

const CHUNK_MIN_TOKENS = 500;
const CHUNK_MAX_TOKENS = 1000;
const CHUNK_OVERLAP_MIN = 50;
const CHUNK_OVERLAP_MAX = 100;
const CHUNK_TARGET_TOKENS = 750;
const CHUNK_OVERLAP_TARGET = 75;

const EXCLUDED_TERMS = [
  'National Testing Network',
  'NTN',
  'Ergometrics',
];

// Patterns for encryption keys: PEM blocks, long base64 strings
const EXCLUDED_PATTERNS: RegExp[] = [
  /-----BEGIN\s+[\w\s]+-----[\s\S]*?-----END\s+[\w\s]+-----/,
  /(?:[A-Za-z0-9+/]{64,}={0,2})/,
];

const KNOWLEDGE_BASE_DIR = path.resolve(process.cwd(), 'knowledge-base');

// --- Types ---

export interface DocumentMetadata {
  sourceType: string;
  category: string;
  title: string;
  language?: string;
  project?: string;
}

export interface ParsedDocument {
  filePath: string;
  metadata: DocumentMetadata;
  content: string;
}

export interface ContentChunk {
  text: string;
  metadata: DocumentMetadata & {
    chunkIndex: number;
    sourceFile: string;
  };
}

export interface IngestionSummary {
  filesProcessed: number;
  filesSkipped: number;
  chunksGenerated: number;
  chunksExcluded: number;
  embeddingsStored: number;
  errors: Array<{ file: string; error: string }>;
}

// --- Content Exclusion ---

/**
 * Check if a text chunk contains excluded content.
 * Returns true if the chunk should be excluded.
 */
export function shouldExcludeChunk(text: string): boolean {
  // Check exact terms (case-insensitive for terms, but exact for "NTN" as it's an acronym)
  for (const term of EXCLUDED_TERMS) {
    if (term === 'NTN') {
      // Match NTN as a whole word to avoid false positives
      if (/\bNTN\b/.test(text)) {
        return true;
      }
    } else if (text.toLowerCase().includes(term.toLowerCase())) {
      return true;
    }
  }

  // Check regex patterns for encryption keys
  for (const pattern of EXCLUDED_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

// --- Tokenization (approximate) ---

/**
 * Approximate token count. Uses whitespace splitting as a rough estimate.
 * A more accurate approach would use tiktoken, but for chunking purposes
 * this provides a reasonable approximation (1 token ≈ 0.75 words).
 */
export function estimateTokenCount(text: string): number {
  // Split on whitespace and punctuation boundaries
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  // Approximate: ~1.3 tokens per word on average for English text
  return Math.ceil(words.length * 1.3);
}

/**
 * Split text into tokens (words as proxy).
 * Returns an array of word-level tokens.
 */
export function tokenize(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

/**
 * Reconstruct text from tokens.
 */
export function detokenize(tokens: string[]): string {
  return tokens.join(' ');
}

// --- Chunking ---

/**
 * Chunk text content into segments of CHUNK_TARGET_TOKENS tokens
 * with CHUNK_OVERLAP_TARGET tokens of overlap between consecutive chunks.
 *
 * Guarantees:
 * - Each chunk is between CHUNK_MIN_TOKENS and CHUNK_MAX_TOKENS tokens
 *   (except possibly the last chunk if remaining content is shorter)
 * - Consecutive chunks share between CHUNK_OVERLAP_MIN and CHUNK_OVERLAP_MAX tokens
 */
export function chunkText(text: string): string[] {
  const tokens = tokenize(text);
  const totalTokens = tokens.length;

  // If the text is shorter than minimum chunk size, return as single chunk
  if (totalTokens <= CHUNK_MAX_TOKENS) {
    return [detokenize(tokens)];
  }

  const chunks: string[] = [];
  // Convert word count to approximate token positions
  // Since we use 1.3 tokens/word, we need to work in word-space
  const wordsPerChunk = Math.floor(CHUNK_TARGET_TOKENS / 1.3);
  const wordsOverlap = Math.floor(CHUNK_OVERLAP_TARGET / 1.3);
  const stride = wordsPerChunk - wordsOverlap;

  let start = 0;
  while (start < tokens.length) {
    const end = Math.min(start + wordsPerChunk, tokens.length);
    const chunkTokens = tokens.slice(start, end);
    const chunkText = detokenize(chunkTokens);

    // Only add non-empty chunks
    if (chunkText.trim().length > 0) {
      chunks.push(chunkText);
    }

    // If we've reached the end, stop
    if (end >= tokens.length) {
      break;
    }

    start += stride;
  }

  return chunks;
}

// --- File Parsing ---

/**
 * Parse a knowledge-base file, extracting YAML frontmatter and content.
 * Handles both Markdown files (--- delimiters) and code files (// --- comments).
 */
export function parseFile(filePath: string): ParsedDocument | null {
  const rawContent = fs.readFileSync(filePath, 'utf-8');

  if (!rawContent.trim()) {
    return null;
  }

  const ext = path.extname(filePath);
  let metadata: DocumentMetadata;
  let content: string;

  // Code files use comment-style frontmatter
  if (['.ts', '.js', '.py', '.tf', '.go', '.rs'].includes(ext)) {
    const parsed = parseCodeFrontmatter(rawContent);
    if (!parsed) {
      return null;
    }
    metadata = parsed.metadata;
    content = parsed.content;
  } else {
    // Markdown and other files use standard YAML frontmatter
    try {
      const parsed = matter(rawContent);
      if (!parsed.data || !parsed.data['source-type'] || !parsed.data.title) {
        return null;
      }
      metadata = {
        sourceType: parsed.data['source-type'],
        category: parsed.data.category || 'general',
        title: parsed.data.title,
        language: parsed.data.language,
        project: parsed.data.project,
      };
      content = parsed.content;
    } catch {
      return null;
    }
  }

  if (!content.trim()) {
    return null;
  }

  return { filePath, metadata, content };
}

/**
 * Parse comment-style frontmatter from code files.
 * Expects format:
 *   // ---
 *   // key: value
 *   // ---
 */
function parseCodeFrontmatter(rawContent: string): { metadata: DocumentMetadata; content: string } | null {
  const lines = rawContent.split('\n');
  let inFrontmatter = false;
  let frontmatterLines: string[] = [];
  let contentStartIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (trimmed === '// ---' && !inFrontmatter) {
      inFrontmatter = true;
      continue;
    }

    if (trimmed === '// ---' && inFrontmatter) {
      contentStartIndex = i + 1;
      break;
    }

    if (inFrontmatter) {
      // Strip leading // and whitespace
      const yamlLine = trimmed.replace(/^\/\/\s?/, '');
      frontmatterLines.push(yamlLine);
    }
  }

  if (frontmatterLines.length === 0) {
    return null;
  }

  try {
    const yamlStr = frontmatterLines.join('\n');
    const parsed = matter(`---\n${yamlStr}\n---\n`);

    if (!parsed.data['source-type'] || !parsed.data.title) {
      return null;
    }

    const metadata: DocumentMetadata = {
      sourceType: parsed.data['source-type'],
      category: parsed.data.category || 'general',
      title: parsed.data.title,
      language: parsed.data.language,
      project: parsed.data.project,
    };

    const content = lines.slice(contentStartIndex).join('\n');
    return { metadata, content };
  } catch {
    return null;
  }
}

// --- File Discovery ---

/**
 * Recursively discover all content files in the knowledge-base directory.
 * Skips .gitkeep and other non-content files.
 */
export function discoverFiles(baseDir: string): string[] {
  const files: string[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && !entry.name.startsWith('.')) {
        files.push(fullPath);
      }
    }
  }

  walk(baseDir);
  return files.sort();
}

// --- Ingestion Pipeline ---

/**
 * Process all knowledge-base files: parse, chunk, filter, and prepare for embedding.
 */
export function processFiles(baseDir: string): {
  chunks: ContentChunk[];
  summary: IngestionSummary;
} {
  const files = discoverFiles(baseDir);
  const chunks: ContentChunk[] = [];
  const summary: IngestionSummary = {
    filesProcessed: 0,
    filesSkipped: 0,
    chunksGenerated: 0,
    chunksExcluded: 0,
    embeddingsStored: 0,
    errors: [],
  };

  for (const filePath of files) {
    const relativePath = path.relative(baseDir, filePath);

    try {
      const doc = parseFile(filePath);

      if (!doc) {
        summary.filesSkipped++;
        summary.errors.push({
          file: relativePath,
          error: 'Empty or unparseable file (missing required frontmatter fields)',
        });
        console.warn(`[SKIP] ${relativePath}: Empty or unparseable`);
        continue;
      }

      const textChunks = chunkText(doc.content);
      let chunkIndex = 0;

      for (const chunkText of textChunks) {
        if (shouldExcludeChunk(chunkText)) {
          summary.chunksExcluded++;
          console.warn(`[EXCLUDE] ${relativePath} chunk ${chunkIndex}: Contains excluded content`);
          chunkIndex++;
          continue;
        }

        chunks.push({
          text: chunkText,
          metadata: {
            ...doc.metadata,
            chunkIndex,
            sourceFile: relativePath,
          },
        });

        chunkIndex++;
      }

      summary.filesProcessed++;
      summary.chunksGenerated += chunkIndex;
    } catch (err) {
      summary.filesSkipped++;
      const errorMessage = err instanceof Error ? err.message : String(err);
      summary.errors.push({ file: relativePath, error: errorMessage });
      console.error(`[ERROR] ${relativePath}: ${errorMessage}`);
    }
  }

  summary.embeddingsStored = chunks.length;
  return { chunks, summary };
}

// --- AWS Integration ---

/**
 * Upload processed chunks to the knowledge base S3 bucket.
 * Each chunk is stored as a separate file with metadata.
 */
async function uploadChunksToS3(
  chunks: ContentChunk[],
  bucketName: string,
  region: string
): Promise<void> {
  const s3Client = new S3Client({ region });

  // First, delete existing processed chunks
  console.log('Clearing previous ingestion data from S3...');
  await clearBucket(s3Client, bucketName, 'ingested/');

  // Upload each chunk as a separate document
  console.log(`Uploading ${chunks.length} chunks to S3...`);
  for (const chunk of chunks) {
    const key = `ingested/${chunk.metadata.sourceFile}/${chunk.metadata.chunkIndex}.json`;
    const body = JSON.stringify({
      content: chunk.text,
      metadata: chunk.metadata,
    });

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: 'application/json',
      })
    );
  }
}

/**
 * Clear all objects under a prefix in an S3 bucket.
 * Supports re-ingestion by removing previous embeddings.
 */
async function clearBucket(s3Client: S3Client, bucket: string, prefix: string): Promise<void> {
  let continuationToken: string | undefined;

  do {
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: bucket,
              Key: obj.Key,
            })
          );
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
}

/**
 * Trigger a Bedrock Knowledge Base data source sync.
 * This causes Bedrock to re-ingest content from the S3 data source,
 * generating new embeddings for all documents.
 */
async function triggerKnowledgeBaseSync(
  knowledgeBaseId: string,
  dataSourceId: string,
  region: string
): Promise<string> {
  const client = new BedrockAgentClient({ region });

  const response = await client.send(
    new StartIngestionJobCommand({
      knowledgeBaseId,
      dataSourceId,
    })
  );

  const jobId = response.ingestionJob?.ingestionJobId;
  if (!jobId) {
    throw new Error('Failed to start ingestion job: no job ID returned');
  }

  console.log(`Ingestion job started: ${jobId}`);
  return jobId;
}

/**
 * Wait for a Bedrock ingestion job to complete.
 */
async function waitForIngestionJob(
  knowledgeBaseId: string,
  dataSourceId: string,
  jobId: string,
  region: string
): Promise<void> {
  const client = new BedrockAgentClient({ region });
  const maxWaitTime = 300_000; // 5 minutes
  const pollInterval = 10_000; // 10 seconds
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const response = await client.send(
      new GetIngestionJobCommand({
        knowledgeBaseId,
        dataSourceId,
        ingestionJobId: jobId,
      })
    );

    const status = response.ingestionJob?.status;
    console.log(`  Ingestion job status: ${status}`);

    if (status === 'COMPLETE') {
      return;
    }

    if (status === 'FAILED') {
      const reason = response.ingestionJob?.failureReasons?.join(', ') || 'Unknown reason';
      throw new Error(`Ingestion job failed: ${reason}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  console.warn('Ingestion job did not complete within timeout. It may still be running.');
}

// --- Summary Report ---

function printSummary(summary: IngestionSummary): void {
  console.log('\n' + '='.repeat(60));
  console.log('INGESTION PIPELINE SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Files processed:    ${summary.filesProcessed}`);
  console.log(`  Files skipped:      ${summary.filesSkipped}`);
  console.log(`  Chunks generated:   ${summary.chunksGenerated}`);
  console.log(`  Chunks excluded:    ${summary.chunksExcluded}`);
  console.log(`  Embeddings stored:  ${summary.embeddingsStored}`);

  if (summary.errors.length > 0) {
    console.log('\n  Errors:');
    for (const { file, error } of summary.errors) {
      console.log(`    - ${file}: ${error}`);
    }
  }

  console.log('='.repeat(60) + '\n');
}

// --- Main Entry Point ---

async function main(): Promise<void> {
  console.log('Knowledge Base Ingestion Pipeline');
  console.log('-'.repeat(40));

  // Validate environment
  const knowledgeBaseId = process.env.KNOWLEDGE_BASE_ID;
  const dataSourceId = process.env.DATA_SOURCE_ID;
  const bucketName = process.env.KB_BUCKET_NAME;
  const region = process.env.AWS_REGION || 'us-east-1';

  if (!knowledgeBaseId || !dataSourceId || !bucketName) {
    console.error('Missing required environment variables:');
    if (!knowledgeBaseId) console.error('  - KNOWLEDGE_BASE_ID');
    if (!dataSourceId) console.error('  - DATA_SOURCE_ID');
    if (!bucketName) console.error('  - KB_BUCKET_NAME');
    process.exit(1);
  }

  // Process files
  console.log(`\nProcessing files from: ${KNOWLEDGE_BASE_DIR}`);
  const { chunks, summary } = processFiles(KNOWLEDGE_BASE_DIR);

  if (chunks.length === 0) {
    console.warn('No chunks to ingest. Check knowledge-base directory.');
    printSummary(summary);
    return;
  }

  // Upload to S3
  try {
    await uploadChunksToS3(chunks, bucketName, region);
    console.log(`Uploaded ${chunks.length} chunks to s3://${bucketName}/ingested/`);
  } catch (err) {
    console.error('Failed to upload chunks to S3:', err);
    process.exit(1);
  }

  // Trigger Knowledge Base sync
  try {
    const jobId = await triggerKnowledgeBaseSync(knowledgeBaseId, dataSourceId, region);
    console.log('Waiting for ingestion job to complete...');
    await waitForIngestionJob(knowledgeBaseId, dataSourceId, jobId, region);
    console.log('Ingestion job completed successfully.');
  } catch (err) {
    console.error('Knowledge Base sync failed:', err);
    // Don't exit - still print summary
  }

  // Print summary
  printSummary(summary);
}

// Run if executed directly (not imported as a module for testing)
const isMainModule = process.argv[1]?.endsWith('ingest.ts') || process.argv[1]?.endsWith('ingest');
if (isMainModule) {
  main().catch((err) => {
    console.error('Ingestion pipeline failed:', err);
    process.exit(1);
  });
}
