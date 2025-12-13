/**
 * OpenTelemetry GenAI Semantic Convention Attributes.
 * Based on https://opentelemetry.io/docs/specs/semconv/gen-ai/
 *
 * Note: These follow the official OTel GenAI semantic conventions.
 * Attribute names use the standardized `gen_ai.*` namespace.
 */

// -----------------------------------------------------------------------------
// Operation Attributes
// -----------------------------------------------------------------------------

/** The name of the GenAI operation being performed */
export const ATTR_GEN_AI_OPERATION_NAME = 'gen_ai.operation.name';

/** The GenAI provider as identified by the client or server */
export const ATTR_GEN_AI_PROVIDER_NAME = 'gen_ai.provider.name';

// -----------------------------------------------------------------------------
// Model Attributes
// -----------------------------------------------------------------------------

/** The name of the GenAI model a request is being made to */
export const ATTR_GEN_AI_REQUEST_MODEL = 'gen_ai.request.model';

/** The name of the model that generated the response */
export const ATTR_GEN_AI_RESPONSE_MODEL = 'gen_ai.response.model';

// -----------------------------------------------------------------------------
// Token Usage Attributes
// -----------------------------------------------------------------------------

/** The number of tokens used in the GenAI input (prompt) */
export const ATTR_GEN_AI_USAGE_INPUT_TOKENS = 'gen_ai.usage.input_tokens';

/** The number of tokens used in the GenAI response (completion) */
export const ATTR_GEN_AI_USAGE_OUTPUT_TOKENS = 'gen_ai.usage.output_tokens';

// -----------------------------------------------------------------------------
// Request Parameter Attributes
// -----------------------------------------------------------------------------

/** Temperature setting for the model */
export const ATTR_GEN_AI_REQUEST_TEMPERATURE = 'gen_ai.request.temperature';

/** Maximum tokens to generate */
export const ATTR_GEN_AI_REQUEST_MAX_TOKENS = 'gen_ai.request.max_tokens';

/** Top-p sampling parameter */
export const ATTR_GEN_AI_REQUEST_TOP_P = 'gen_ai.request.top_p';

// -----------------------------------------------------------------------------
// Tool Attributes
// -----------------------------------------------------------------------------

/** Name of the tool utilized by the agent */
export const ATTR_GEN_AI_TOOL_NAME = 'gen_ai.tool.name';

/** The tool call identifier */
export const ATTR_GEN_AI_TOOL_CALL_ID = 'gen_ai.tool.call.id';

/** Parameters passed to the tool call (opt-in, sensitive) */
export const ATTR_GEN_AI_TOOL_CALL_ARGUMENTS = 'gen_ai.tool.call.arguments';

/** The result returned by the tool call (opt-in, sensitive) */
export const ATTR_GEN_AI_TOOL_CALL_RESULT = 'gen_ai.tool.call.result';

// -----------------------------------------------------------------------------
// Content Attributes (Opt-In / Sensitive)
// -----------------------------------------------------------------------------

/** Chat history provided as input (opt-in, sensitive) */
export const ATTR_GEN_AI_INPUT_MESSAGES = 'gen_ai.input.messages';

/** Model-generated response messages (opt-in, sensitive) */
export const ATTR_GEN_AI_OUTPUT_MESSAGES = 'gen_ai.output.messages';

/** System prompts (opt-in, sensitive) */
export const ATTR_GEN_AI_SYSTEM_INSTRUCTIONS = 'gen_ai.system_instructions';

// -----------------------------------------------------------------------------
// Response Attributes
// -----------------------------------------------------------------------------

/** Reasons the model stopped generating */
export const ATTR_GEN_AI_RESPONSE_FINISH_REASONS = 'gen_ai.response.finish_reasons';

/** Unique completion identifier */
export const ATTR_GEN_AI_RESPONSE_ID = 'gen_ai.response.id';

// -----------------------------------------------------------------------------
// Session/Conversation Attributes
// -----------------------------------------------------------------------------

/** Session or thread identifier */
export const ATTR_GEN_AI_CONVERSATION_ID = 'gen_ai.conversation.id';

// -----------------------------------------------------------------------------
// Error Attributes (standard OTel)
// -----------------------------------------------------------------------------

/** Error type or exception name */
export const ATTR_ERROR_TYPE = 'error.type';

// -----------------------------------------------------------------------------
// Well-Known Operation Names
// -----------------------------------------------------------------------------

export const GEN_AI_OPERATION = {
  CHAT: 'chat',
  TEXT_COMPLETION: 'text_completion',
  EMBEDDINGS: 'embeddings',
  EXECUTE_TOOL: 'execute_tool',
  CREATE_AGENT: 'create_agent',
  INVOKE_AGENT: 'invoke_agent',
} as const;

export type GenAIOperationName = (typeof GEN_AI_OPERATION)[keyof typeof GEN_AI_OPERATION];

// -----------------------------------------------------------------------------
// Well-Known Provider Names
// -----------------------------------------------------------------------------

export const GEN_AI_PROVIDER = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  AZURE_OPENAI: 'azure.ai.openai',
  AZURE_FOUNDRY: 'azure.ai.foundry',
  GOOGLE_VERTEX: 'gcp.vertex_ai',
  GOOGLE_GEMINI: 'google.gemini',
  GITHUB: 'github',
  LOCAL: 'local',
} as const;

export type GenAIProviderName = (typeof GEN_AI_PROVIDER)[keyof typeof GEN_AI_PROVIDER];
