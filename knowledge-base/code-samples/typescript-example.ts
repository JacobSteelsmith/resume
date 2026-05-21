// ---
// source-type: code-sample
// category: serverless
// title: AWS Lambda RAG Handler - TypeScript
// language: typescript
// project: resume-site
// ---

/**
 * Example Lambda handler for a RAG (Retrieval-Augmented Generation) chatbot.
 * Demonstrates TypeScript patterns for AWS Lambda with Bedrock integration.
 */

import {
  BedrockAgentRuntimeClient,
  RetrieveAndGenerateCommand,
  RetrieveAndGenerateCommandInput,
} from '@aws-sdk/client-bedrock-agent-runtime';

interface ChatRequest {
  question: string;
}

interface ChatResponse {
  answer: string;
  sources: SourceAttribution[];
  filtered: boolean;
}

interface SourceAttribution {
  title: string;
  category: string;
}

const SENSITIVE_TERMS = ['[REDACTED]'];
const MAX_QUESTION_LENGTH = 500;
const MAX_RESPONSE_TOKENS = 1024;

const client = new BedrockAgentRuntimeClient({ region: 'us-east-1' });

export async function handler(event: {
  body: string;
}): Promise<{ statusCode: number; body: string }> {
  try {
    const request: ChatRequest = JSON.parse(event.body);

    if (!request.question || request.question.length > MAX_QUESTION_LENGTH) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Question is required and must be 500 characters or fewer.',
        }),
      };
    }

    const input: RetrieveAndGenerateCommandInput = {
      input: { text: request.question },
      retrieveAndGenerateConfiguration: {
        type: 'KNOWLEDGE_BASE',
        knowledgeBaseConfiguration: {
          knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID!,
          modelArn: `arn:aws:bedrock:us-east-1::foundation-model/${process.env.MODEL_ID}`,
          retrievalConfiguration: {
            vectorSearchConfiguration: {
              numberOfResults: 5,
            },
          },
          generationConfiguration: {
            inferenceConfig: {
              textInferenceConfig: {
                maxTokens: MAX_RESPONSE_TOKENS,
              },
            },
          },
        },
      },
    };

    const command = new RetrieveAndGenerateCommand(input);
    const result = await client.send(command);

    const answer = result.output?.text ?? 'I do not have enough information to answer that question.';
    const sources: SourceAttribution[] =
      result.citations?.flatMap(
        (citation) =>
          citation.retrievedReferences?.map((ref) => ({
            title: ref.metadata?.title as string ?? 'Unknown',
            category: ref.metadata?.category as string ?? 'general',
          })) ?? []
      ) ?? [];

    const { text: filteredAnswer, wasFiltered } = filterSensitiveContent(answer);

    const response: ChatResponse = {
      answer: filteredAnswer,
      sources,
      filtered: wasFiltered,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Chat handler error:', error);
    return {
      statusCode: 503,
      body: JSON.stringify({ error: 'Service temporarily unavailable.' }),
    };
  }
}

function filterSensitiveContent(text: string): { text: string; wasFiltered: boolean } {
  let filtered = text;
  let wasFiltered = false;

  for (const term of SENSITIVE_TERMS) {
    if (filtered.includes(term)) {
      filtered = filtered.replaceAll(term, '[REDACTED]');
      wasFiltered = true;
    }
  }

  return { text: filtered, wasFiltered };
}
