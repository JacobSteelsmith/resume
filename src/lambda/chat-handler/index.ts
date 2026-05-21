import {
  BedrockAgentRuntimeClient,
  RetrieveAndGenerateCommand,
  type RetrieveAndGenerateCommandOutput,
} from "@aws-sdk/client-bedrock-agent-runtime";

// --- Interfaces ---

export interface ChatRequest {
  question: string;
}

export interface ChatResponse {
  answer: string;
  sources: SourceAttribution[];
  filtered: boolean;
}

export interface SourceAttribution {
  title: string;
  category: string;
}

// --- Environment Variables ---

const KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID ?? "";
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID ?? "";
const BEDROCK_REGION = process.env.BEDROCK_REGION ?? "us-east-1";
const SITE_DOMAIN = process.env.SITE_DOMAIN ?? "resume.jacob.steelsmith.org";

// --- Constants ---

const MAX_QUESTION_LENGTH = 500;
const MAX_TOKENS = 1024;
const TOP_K_CHUNKS = 5;

const PROFESSIONAL_SYSTEM_PROMPT = `You are a professional assistant for Jacob Steelsmith's resume site. You answer questions about Jacob's career, skills, projects, certifications, and professional background only. If a question is unrelated to Jacob's professional background, politely decline and redirect the conversation to professional topics. Keep responses concise and grounded in the provided context.`;

// --- CORS Headers ---

function getCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": `https://${SITE_DOMAIN}`,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Content-Type": "application/json",
  };
}

// --- Response Helpers ---

function buildResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: getCorsHeaders(),
    body: JSON.stringify(body),
  };
}

// --- Input Validation ---

export function validateInput(body: unknown): { valid: true; question: string } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const { question } = body as Record<string, unknown>;

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return { valid: false, error: "The 'question' field is required and must be a non-empty string" };
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    return { valid: false, error: `Question must not exceed ${MAX_QUESTION_LENGTH} characters` };
  }

  return { valid: true, question: question.trim() };
}

// --- Source Attribution Extraction ---

export function extractSourceAttributions(
  output: RetrieveAndGenerateCommandOutput
): SourceAttribution[] {
  const citations = output.citations ?? [];
  const attributions: SourceAttribution[] = [];
  const seen = new Set<string>();

  for (const citation of citations) {
    const references = citation.retrievedReferences ?? [];
    for (const ref of references) {
      const uri = ref.location?.s3Location?.uri ?? "";
      const title = extractTitleFromUri(uri);
      const category = extractCategoryFromUri(uri);
      const key = `${title}:${category}`;

      if (!seen.has(key) && title) {
        seen.add(key);
        attributions.push({ title, category });
      }
    }
  }

  return attributions;
}

function extractTitleFromUri(uri: string): string {
  const parts = uri.split("/");
  const filename = parts[parts.length - 1] ?? "";
  return filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
}

function extractCategoryFromUri(uri: string): string {
  const parts = uri.split("/");
  // Expect structure like: s3://bucket/category/filename
  if (parts.length >= 2) {
    const category = parts[parts.length - 2] ?? "";
    return category.replace(/[-_]/g, " ");
  }
  return "general";
}

// --- Content Filtering ---

const SENSITIVE_TERMS: RegExp[] = [
  /National Testing Network/gi,
  /\bNTN\b/g,
  /Ergometrics/gi,
  /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g,
  /[A-Za-z0-9+/]{64,}={0,2}/g,
];

export function filterSensitiveContent(text: string): { filtered: boolean; text: string } {
  let filtered = false;
  let result = text;

  for (const pattern of SENSITIVE_TERMS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    if (pattern.test(result)) {
      filtered = true;
      pattern.lastIndex = 0;
      result = result.replace(pattern, "[REDACTED]");
    }
  }

  return { filtered, text: result };
}

// --- Bedrock Client ---

let bedrockClient: BedrockAgentRuntimeClient | null = null;

function getBedrockClient(): BedrockAgentRuntimeClient {
  if (!bedrockClient) {
    bedrockClient = new BedrockAgentRuntimeClient({ region: BEDROCK_REGION });
  }
  return bedrockClient;
}

// Exported for testing
export function resetBedrockClient(): void {
  bedrockClient = null;
}

// --- Main Handler ---

export async function handler(event: {
  httpMethod?: string;
  body?: string | null;
  headers?: Record<string, string>;
}) {
  // Handle OPTIONS preflight
  if (event.httpMethod === "OPTIONS") {
    return buildResponse(200, {});
  }

  // Parse request body
  let parsedBody: unknown;
  try {
    parsedBody = event.body ? JSON.parse(event.body) : null;
  } catch {
    return buildResponse(400, { error: "Invalid JSON in request body" });
  }

  // Validate input
  const validation = validateInput(parsedBody);
  if (!validation.valid) {
    return buildResponse(400, { error: validation.error });
  }

  const { question } = validation;

  // Call Bedrock RetrieveAndGenerate
  try {
    const client = getBedrockClient();
    const modelArn = `arn:aws:bedrock:${BEDROCK_REGION}::foundation-model/${BEDROCK_MODEL_ID}`;

    const command = new RetrieveAndGenerateCommand({
      input: { text: question },
      retrieveAndGenerateConfiguration: {
        type: "KNOWLEDGE_BASE",
        knowledgeBaseConfiguration: {
          knowledgeBaseId: KNOWLEDGE_BASE_ID,
          modelArn,
          retrievalConfiguration: {
            vectorSearchConfiguration: {
              numberOfResults: TOP_K_CHUNKS,
              overrideSearchType: "SEMANTIC",
            },
          },
          generationConfiguration: {
            inferenceConfig: {
              textInferenceConfig: {
                maxTokens: MAX_TOKENS,
              },
            },
            promptTemplate: {
              textPromptTemplate: `${PROFESSIONAL_SYSTEM_PROMPT}\n\nContext:\n$search_results$\n\nQuestion: $query$\n\nAnswer:`,
            },
          },
        },
      },
    });

    const response = await client.send(command);

    // Check if we got a meaningful response
    const answerText = response.output?.text ?? "";

    // If no citations were returned, it means no chunks passed the relevance threshold
    const citations = response.citations ?? [];
    const hasRelevantChunks = citations.some(
      (c) => (c.retrievedReferences ?? []).length > 0
    );

    if (!hasRelevantChunks || !answerText) {
      const fallbackResponse: ChatResponse = {
        answer:
          "I don't have enough information to answer that question. Please try asking about Jacob's skills, experience, projects, or certifications.",
        sources: [],
        filtered: false,
      };
      return buildResponse(200, fallbackResponse);
    }

    // Extract source attributions
    const sources = extractSourceAttributions(response);

    // Apply content filtering
    const { filtered, text: filteredAnswer } = filterSensitiveContent(answerText);

    const chatResponse: ChatResponse = {
      answer: filteredAnswer,
      sources,
      filtered,
    };

    return buildResponse(200, chatResponse);
  } catch (error: unknown) {
    // Handle Bedrock service unavailability
    const errorName = (error as { name?: string })?.name ?? "";
    const errorMessage = (error as { message?: string })?.message ?? "";

    if (
      errorName === "ServiceUnavailableException" ||
      errorName === "ThrottlingException" ||
      errorName === "ServiceException" ||
      errorMessage.includes("Service Unavailable") ||
      errorMessage.includes("Internal Server Error")
    ) {
      return buildResponse(503, {
        error: "Service temporarily unavailable. Please try again later.",
      });
    }

    // For unexpected errors, return 503 as well to avoid leaking internals
    console.error("Unexpected error calling Bedrock:", error);
    return buildResponse(503, {
      error: "Service temporarily unavailable. Please try again later.",
    });
  }
}
