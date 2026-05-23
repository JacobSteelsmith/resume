import {
  BedrockAgentRuntimeClient,
  RetrieveAndGenerateCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';

const KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID;
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID;
const BEDROCK_REGION = process.env.BEDROCK_REGION;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;

const client = new BedrockAgentRuntimeClient({ region: BEDROCK_REGION });

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  // Handle preflight (shouldn't hit Lambda with MOCK integration, but just in case)
  if (event.httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  // Parse and validate request body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { error: 'Invalid JSON in request body' });
  }

  const { question } = body;

  if (!question || typeof question !== 'string') {
    return response(400, { error: 'Missing or invalid "question" field' });
  }

  if (question.length > 500) {
    return response(400, { error: 'Question exceeds 500 character limit' });
  }

  try {
    const command = new RetrieveAndGenerateCommand({
      input: { text: question },
      retrieveAndGenerateConfiguration: {
        type: 'KNOWLEDGE_BASE',
        knowledgeBaseConfiguration: {
          knowledgeBaseId: KNOWLEDGE_BASE_ID,
          modelArn: BEDROCK_MODEL_ID,
          retrievalConfiguration: {
            vectorSearchConfiguration: {
              numberOfResults: 5,
            },
          },
          generationConfiguration: {
            promptTemplate: {
              textPromptTemplate: `You are a helpful assistant that answers questions about Jacob Steelsmith's professional background, skills, and experience based on his resume and portfolio. Be concise and friendly. If the information isn't available in the provided context, say so honestly.

$search_results$

Question: $query$`,
            },
          },
        },
      },
    });

    const result = await client.send(command);

    const answer = result.output?.text || 'Sorry, I could not generate a response.';

    // Extract source attributions
    const sources = (result.citations || []).flatMap((citation) =>
      (citation.retrievedReferences || []).map((ref) => ({
        title: ref.metadata?.title || ref.location?.s3Location?.uri || 'Resume',
        category: ref.metadata?.category || 'general',
      }))
    );

    // Deduplicate sources by title
    const uniqueSources = [...new Map(sources.map((s) => [s.title, s])).values()];

    return response(200, { answer, sources: uniqueSources });
  } catch (err) {
    console.error('Bedrock RetrieveAndGenerate error:', err);

    if (err.name === 'ThrottlingException') {
      return response(429, { error: 'Rate limit exceeded. Please try again shortly.' });
    }

    return response(500, { error: 'An error occurred while processing your question.' });
  }
}
