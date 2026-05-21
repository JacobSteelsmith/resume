import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  handler,
  validateInput,
  extractSourceAttributions,
  filterSensitiveContent,
  resetBedrockClient,
} from "../../src/lambda/chat-handler/index";

const mockSend = vi.fn();

// Mock the AWS SDK
vi.mock("@aws-sdk/client-bedrock-agent-runtime", () => {
  return {
    BedrockAgentRuntimeClient: class {
      send = mockSend;
    },
    RetrieveAndGenerateCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

describe("chat-handler", () => {
  beforeEach(() => {
    vi.stubEnv("KNOWLEDGE_BASE_ID", "test-kb-id");
    vi.stubEnv("BEDROCK_MODEL_ID", "anthropic.claude-3-haiku-20240307-v1:0");
    vi.stubEnv("BEDROCK_REGION", "us-east-1");
    vi.stubEnv("SITE_DOMAIN", "resume.jacob.steelsmith.org");
    resetBedrockClient();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe("validateInput", () => {
    it("returns valid for a proper question", () => {
      const result = validateInput({ question: "What are your skills?" });
      expect(result).toEqual({ valid: true, question: "What are your skills?" });
    });

    it("returns invalid when body is null", () => {
      const result = validateInput(null);
      expect(result).toEqual({
        valid: false,
        error: "Request body must be a JSON object",
      });
    });

    it("returns invalid when body is not an object", () => {
      const result = validateInput("string");
      expect(result).toEqual({
        valid: false,
        error: "Request body must be a JSON object",
      });
    });

    it("returns invalid when question is missing", () => {
      const result = validateInput({});
      expect(result).toEqual({
        valid: false,
        error: "The 'question' field is required and must be a non-empty string",
      });
    });

    it("returns invalid when question is empty string", () => {
      const result = validateInput({ question: "" });
      expect(result).toEqual({
        valid: false,
        error: "The 'question' field is required and must be a non-empty string",
      });
    });

    it("returns invalid when question is whitespace only", () => {
      const result = validateInput({ question: "   " });
      expect(result).toEqual({
        valid: false,
        error: "The 'question' field is required and must be a non-empty string",
      });
    });

    it("returns invalid when question exceeds 500 characters", () => {
      const longQuestion = "a".repeat(501);
      const result = validateInput({ question: longQuestion });
      expect(result).toEqual({
        valid: false,
        error: "Question must not exceed 500 characters",
      });
    });

    it("accepts a question of exactly 500 characters", () => {
      const question = "a".repeat(500);
      const result = validateInput({ question });
      expect(result).toEqual({ valid: true, question });
    });

    it("trims whitespace from valid questions", () => {
      const result = validateInput({ question: "  What skills do you have?  " });
      expect(result).toEqual({ valid: true, question: "What skills do you have?" });
    });
  });

  describe("extractSourceAttributions", () => {
    it("extracts attributions from citations", () => {
      const output = {
        citations: [
          {
            retrievedReferences: [
              {
                location: {
                  s3Location: {
                    uri: "s3://bucket/skills/cloud-platforms.md",
                  },
                },
              },
              {
                location: {
                  s3Location: {
                    uri: "s3://bucket/experience/current-role.md",
                  },
                },
              },
            ],
          },
        ],
        $metadata: {},
      };

      const attributions = extractSourceAttributions(output as any);
      expect(attributions).toEqual([
        { title: "cloud platforms", category: "skills" },
        { title: "current role", category: "experience" },
      ]);
    });

    it("deduplicates attributions", () => {
      const output = {
        citations: [
          {
            retrievedReferences: [
              {
                location: {
                  s3Location: { uri: "s3://bucket/skills/aws.md" },
                },
              },
              {
                location: {
                  s3Location: { uri: "s3://bucket/skills/aws.md" },
                },
              },
            ],
          },
        ],
        $metadata: {},
      };

      const attributions = extractSourceAttributions(output as any);
      expect(attributions).toHaveLength(1);
    });

    it("returns empty array when no citations", () => {
      const output = { citations: [], $metadata: {} };
      const attributions = extractSourceAttributions(output as any);
      expect(attributions).toEqual([]);
    });
  });

  describe("filterSensitiveContent", () => {
    it("returns unfiltered text when no sensitive terms present", () => {
      const result = filterSensitiveContent("Jacob has AWS experience.");
      expect(result).toEqual({ filtered: false, text: "Jacob has AWS experience." });
    });

    it("redacts 'National Testing Network'", () => {
      const result = filterSensitiveContent("He worked at National Testing Network for 3 years.");
      expect(result.filtered).toBe(true);
      expect(result.text).toBe("He worked at [REDACTED] for 3 years.");
      expect(result.text).not.toContain("National Testing Network");
    });

    it("redacts 'NTN' as a whole word", () => {
      const result = filterSensitiveContent("His role at NTN involved testing.");
      expect(result.filtered).toBe(true);
      expect(result.text).toBe("His role at [REDACTED] involved testing.");
    });

    it("does not redact NTN when part of another word", () => {
      const result = filterSensitiveContent("The NTNU university is in Norway.");
      expect(result.filtered).toBe(false);
      expect(result.text).toBe("The NTNU university is in Norway.");
    });

    it("redacts 'Ergometrics'", () => {
      const result = filterSensitiveContent("He used Ergometrics testing tools.");
      expect(result.filtered).toBe(true);
      expect(result.text).toBe("He used [REDACTED] testing tools.");
    });

    it("redacts case-insensitive matches for National Testing Network", () => {
      const result = filterSensitiveContent("national testing network is a company.");
      expect(result.filtered).toBe(true);
      expect(result.text).toBe("[REDACTED] is a company.");
    });

    it("redacts case-insensitive matches for Ergometrics", () => {
      const result = filterSensitiveContent("ERGOMETRICS provides assessments.");
      expect(result.filtered).toBe(true);
      expect(result.text).toBe("[REDACTED] provides assessments.");
    });

    it("redacts PEM-style key blocks", () => {
      const pemKey = "-----BEGIN RSA PRIVATE KEY-----\nMIIBogIBAAJBALRiMLAH\n-----END RSA PRIVATE KEY-----";
      const result = filterSensitiveContent(`Here is a key: ${pemKey}`);
      expect(result.filtered).toBe(true);
      expect(result.text).not.toContain("BEGIN RSA PRIVATE KEY");
      expect(result.text).toContain("[REDACTED]");
    });

    it("redacts long base64 strings (encryption key patterns)", () => {
      const longBase64 = "A".repeat(64);
      const result = filterSensitiveContent(`The key is ${longBase64} stored here.`);
      expect(result.filtered).toBe(true);
      expect(result.text).not.toContain(longBase64);
      expect(result.text).toContain("[REDACTED]");
    });

    it("does not redact short base64-like strings", () => {
      const shortString = "ABC123def";
      const result = filterSensitiveContent(`The value is ${shortString}.`);
      expect(result.filtered).toBe(false);
      expect(result.text).toContain(shortString);
    });

    it("redacts multiple sensitive terms in one text", () => {
      const result = filterSensitiveContent(
        "He worked at National Testing Network using Ergometrics tools. NTN was great."
      );
      expect(result.filtered).toBe(true);
      expect(result.text).not.toContain("National Testing Network");
      expect(result.text).not.toContain("Ergometrics");
      expect(result.text).not.toContain("NTN");
    });

    it("handles empty string", () => {
      const result = filterSensitiveContent("");
      expect(result).toEqual({ filtered: false, text: "" });
    });
  });

  describe("handler", () => {
    it("returns 200 for OPTIONS preflight", async () => {
      const result = await handler({ httpMethod: "OPTIONS" });
      expect(result.statusCode).toBe(200);
      expect(result.headers["Access-Control-Allow-Origin"]).toBe(
        "https://resume.jacob.steelsmith.org"
      );
    });

    it("returns 400 for invalid JSON body", async () => {
      const result = await handler({
        httpMethod: "POST",
        body: "not json",
      });
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe("Invalid JSON in request body");
    });

    it("returns 400 when question is missing", async () => {
      const result = await handler({
        httpMethod: "POST",
        body: JSON.stringify({}),
      });
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain("question");
    });

    it("returns 400 when question exceeds 500 chars", async () => {
      const result = await handler({
        httpMethod: "POST",
        body: JSON.stringify({ question: "x".repeat(501) }),
      });
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain("500 characters");
    });

    it("returns fallback message when no relevant chunks found", async () => {
      mockSend.mockResolvedValueOnce({
        output: { text: "" },
        citations: [],
      });

      const result = await handler({
        httpMethod: "POST",
        body: JSON.stringify({ question: "What is the weather?" }),
      });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.answer).toContain("don't have enough information");
      expect(body.sources).toEqual([]);
      expect(body.filtered).toBe(false);
    });

    it("returns successful response with sources", async () => {
      mockSend.mockResolvedValueOnce({
        output: { text: "Jacob has extensive AWS experience." },
        citations: [
          {
            retrievedReferences: [
              {
                location: {
                  s3Location: { uri: "s3://bucket/skills/aws-services.md" },
                },
              },
            ],
          },
        ],
      });

      const result = await handler({
        httpMethod: "POST",
        body: JSON.stringify({ question: "What AWS services does Jacob know?" }),
      });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.answer).toBe("Jacob has extensive AWS experience.");
      expect(body.sources).toEqual([
        { title: "aws services", category: "skills" },
      ]);
      expect(body.filtered).toBe(false);
    });

    it("returns 503 when Bedrock is unavailable", async () => {
      const error = new Error("Service Unavailable");
      (error as any).name = "ServiceUnavailableException";
      mockSend.mockRejectedValueOnce(error);

      const result = await handler({
        httpMethod: "POST",
        body: JSON.stringify({ question: "Tell me about your skills" }),
      });

      expect(result.statusCode).toBe(503);
      const body = JSON.parse(result.body);
      expect(body.error).toContain("temporarily unavailable");
    });

    it("returns 503 for unexpected errors", async () => {
      mockSend.mockRejectedValueOnce(new Error("Something unexpected"));

      const result = await handler({
        httpMethod: "POST",
        body: JSON.stringify({ question: "Tell me about your skills" }),
      });

      expect(result.statusCode).toBe(503);
      const body = JSON.parse(result.body);
      expect(body.error).toContain("temporarily unavailable");
    });

    it("filters sensitive content from Bedrock response", async () => {
      mockSend.mockResolvedValueOnce({
        output: { text: "Jacob worked at National Testing Network using Ergometrics tools." },
        citations: [
          {
            retrievedReferences: [
              {
                location: {
                  s3Location: { uri: "s3://bucket/experience/current-role.md" },
                },
              },
            ],
          },
        ],
      });

      const result = await handler({
        httpMethod: "POST",
        body: JSON.stringify({ question: "Where did Jacob work?" }),
      });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.answer).not.toContain("National Testing Network");
      expect(body.answer).not.toContain("Ergometrics");
      expect(body.answer).toContain("[REDACTED]");
      expect(body.filtered).toBe(true);
    });

    it("sets filtered to false when no sensitive content present", async () => {
      mockSend.mockResolvedValueOnce({
        output: { text: "Jacob is skilled in AWS and TypeScript." },
        citations: [
          {
            retrievedReferences: [
              {
                location: {
                  s3Location: { uri: "s3://bucket/skills/aws.md" },
                },
              },
            ],
          },
        ],
      });

      const result = await handler({
        httpMethod: "POST",
        body: JSON.stringify({ question: "What are Jacob's skills?" }),
      });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.filtered).toBe(false);
    });

    it("includes CORS headers in all responses", async () => {
      const result = await handler({
        httpMethod: "POST",
        body: JSON.stringify({}),
      });

      expect(result.headers["Access-Control-Allow-Origin"]).toBe(
        "https://resume.jacob.steelsmith.org"
      );
      expect(result.headers["Access-Control-Allow-Methods"]).toBe("POST,OPTIONS");
      expect(result.headers["Content-Type"]).toBe("application/json");
    });
  });
});
