import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import {
  shouldExcludeChunk,
  estimateTokenCount,
  tokenize,
  detokenize,
  chunkText,
  parseFile,
  discoverFiles,
  processFiles,
} from '../../scripts/ingest.ts';

describe('shouldExcludeChunk', () => {
  it('excludes chunks containing "National Testing Network"', () => {
    expect(shouldExcludeChunk('I worked at the National Testing Network for 3 years')).toBe(true);
  });

  it('excludes chunks containing "NTN" as a word boundary', () => {
    expect(shouldExcludeChunk('The NTN organization provides testing services')).toBe(true);
  });

  it('does not exclude "NTN" when part of another word', () => {
    expect(shouldExcludeChunk('The NTNU university is in Norway')).toBe(false);
  });

  it('excludes chunks containing "Ergometrics"', () => {
    expect(shouldExcludeChunk('Ergometrics develops assessment tools')).toBe(true);
  });

  it('excludes chunks containing PEM blocks', () => {
    const pemContent = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWep4PAtGoRBh
-----END RSA PRIVATE KEY-----`;
    expect(shouldExcludeChunk(pemContent)).toBe(true);
  });

  it('excludes chunks containing long base64 strings (encryption keys)', () => {
    const base64Key = 'A'.repeat(64);
    expect(shouldExcludeChunk(`The key is: ${base64Key}`)).toBe(true);
  });

  it('does not exclude normal content', () => {
    expect(shouldExcludeChunk('Jacob has experience with AWS Lambda and TypeScript')).toBe(false);
  });

  it('is case-insensitive for "National Testing Network"', () => {
    expect(shouldExcludeChunk('national testing network')).toBe(true);
  });
});

describe('tokenize and detokenize', () => {
  it('splits text into words', () => {
    expect(tokenize('hello world foo')).toEqual(['hello', 'world', 'foo']);
  });

  it('handles multiple spaces', () => {
    expect(tokenize('hello   world')).toEqual(['hello', 'world']);
  });

  it('reconstructs text from tokens', () => {
    expect(detokenize(['hello', 'world'])).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(tokenize('')).toEqual([]);
  });
});

describe('estimateTokenCount', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokenCount('')).toBe(0);
  });

  it('estimates tokens for a sentence', () => {
    const count = estimateTokenCount('This is a simple test sentence');
    // 6 words * 1.3 ≈ 8 tokens
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(20);
  });
});

describe('chunkText', () => {
  it('returns single chunk for short text', () => {
    const shortText = 'This is a short text.';
    const chunks = chunkText(shortText);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(shortText);
  });

  it('produces multiple chunks for long text', () => {
    // Generate text with ~2000 words (well over max chunk size)
    const words = Array.from({ length: 2000 }, (_, i) => `word${i}`);
    const longText = words.join(' ');
    const chunks = chunkText(longText);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('produces overlapping chunks', () => {
    const words = Array.from({ length: 2000 }, (_, i) => `word${i}`);
    const longText = words.join(' ');
    const chunks = chunkText(longText);

    // Check that consecutive chunks share some content
    if (chunks.length >= 2) {
      const chunk1Words = chunks[0].split(' ');
      const chunk2Words = chunks[1].split(' ');
      // Find overlap: words at end of chunk1 that appear at start of chunk2
      const lastWordsOfChunk1 = new Set(chunk1Words.slice(-100));
      const firstWordsOfChunk2 = chunk2Words.slice(0, 100);
      const overlap = firstWordsOfChunk2.filter((w) => lastWordsOfChunk1.has(w));
      expect(overlap.length).toBeGreaterThan(0);
    }
  });

  it('does not produce empty chunks', () => {
    const words = Array.from({ length: 1500 }, (_, i) => `word${i}`);
    const longText = words.join(' ');
    const chunks = chunkText(longText);
    for (const chunk of chunks) {
      expect(chunk.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('parseFile', () => {
  it('parses markdown files with YAML frontmatter', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-test-'));
    const filePath = path.join(tmpDir, 'test.md');
    fs.writeFileSync(
      filePath,
      `---
source-type: skills
category: cloud
title: AWS Skills
---

# AWS Skills

Content about AWS skills here.
`
    );

    const result = parseFile(filePath);
    expect(result).not.toBeNull();
    expect(result!.metadata.sourceType).toBe('skills');
    expect(result!.metadata.category).toBe('cloud');
    expect(result!.metadata.title).toBe('AWS Skills');
    expect(result!.content).toContain('Content about AWS skills here.');

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('parses code files with comment-style frontmatter', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-test-'));
    const filePath = path.join(tmpDir, 'example.ts');
    fs.writeFileSync(
      filePath,
      `// ---
// source-type: code-sample
// category: serverless
// title: Lambda Handler
// language: typescript
// project: resume-site
// ---

export function handler() {
  return { statusCode: 200 };
}
`
    );

    const result = parseFile(filePath);
    expect(result).not.toBeNull();
    expect(result!.metadata.sourceType).toBe('code-sample');
    expect(result!.metadata.language).toBe('typescript');
    expect(result!.metadata.project).toBe('resume-site');
    expect(result!.content).toContain('export function handler()');

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('returns null for empty files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-test-'));
    const filePath = path.join(tmpDir, 'empty.md');
    fs.writeFileSync(filePath, '');

    const result = parseFile(filePath);
    expect(result).toBeNull();

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('returns null for files without required frontmatter', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-test-'));
    const filePath = path.join(tmpDir, 'no-meta.md');
    fs.writeFileSync(
      filePath,
      `---
category: cloud
---

Missing source-type and title.
`
    );

    const result = parseFile(filePath);
    expect(result).toBeNull();

    fs.rmSync(tmpDir, { recursive: true });
  });
});

describe('discoverFiles', () => {
  it('finds files recursively and skips dotfiles', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-test-'));
    fs.mkdirSync(path.join(tmpDir, 'sub'));
    fs.writeFileSync(path.join(tmpDir, 'file1.md'), 'content');
    fs.writeFileSync(path.join(tmpDir, 'sub', 'file2.md'), 'content');
    fs.writeFileSync(path.join(tmpDir, '.gitkeep'), '');

    const files = discoverFiles(tmpDir);
    expect(files).toHaveLength(2);
    expect(files.some((f) => f.endsWith('file1.md'))).toBe(true);
    expect(files.some((f) => f.endsWith('file2.md'))).toBe(true);
    expect(files.some((f) => f.endsWith('.gitkeep'))).toBe(false);

    fs.rmSync(tmpDir, { recursive: true });
  });
});

describe('processFiles', () => {
  it('processes valid files and skips invalid ones', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-test-'));

    // Valid file
    fs.writeFileSync(
      path.join(tmpDir, 'valid.md'),
      `---
source-type: skills
category: cloud
title: Valid File
---

This is valid content about cloud skills and AWS services.
`
    );

    // Invalid file (no frontmatter)
    fs.writeFileSync(path.join(tmpDir, 'invalid.md'), 'No frontmatter here');

    const { chunks, summary } = processFiles(tmpDir);
    expect(summary.filesProcessed).toBe(1);
    expect(summary.filesSkipped).toBe(1);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].metadata.sourceFile).toBe('valid.md');

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('excludes chunks with sensitive content', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-test-'));

    fs.writeFileSync(
      path.join(tmpDir, 'sensitive.md'),
      `---
source-type: experience
category: work
title: Work Experience
---

I worked at the National Testing Network developing assessment tools.
`
    );

    const { chunks, summary } = processFiles(tmpDir);
    expect(summary.chunksExcluded).toBeGreaterThan(0);
    // No chunks should contain the excluded term
    for (const chunk of chunks) {
      expect(chunk.text.toLowerCase()).not.toContain('national testing network');
    }

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('preserves code sample metadata in chunks', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-test-'));

    fs.writeFileSync(
      path.join(tmpDir, 'sample.ts'),
      `// ---
// source-type: code-sample
// category: serverless
// title: Lambda Example
// language: typescript
// project: resume-site
// ---

export function handler() {
  return { statusCode: 200, body: 'Hello' };
}
`
    );

    const { chunks } = processFiles(tmpDir);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].metadata.language).toBe('typescript');
    expect(chunks[0].metadata.project).toBe('resume-site');

    fs.rmSync(tmpDir, { recursive: true });
  });
});
