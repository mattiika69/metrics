type ClaudeMessage = {
  role: "user" | "assistant";
  content: string;
};

type ClaudeRequest = {
  system?: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
};

type ClaudeTextBlock = {
  type: "text";
  text: string;
};

type ClaudeResponse = {
  content?: ClaudeTextBlock[];
};

const ANTHROPIC_VERSION = "2023-06-01";

function getClaudeConfig() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL;

  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY.");
  if (!model) throw new Error("Missing ANTHROPIC_MODEL.");

  return { apiKey, model };
}

export async function createClaudeText({
  system,
  messages,
  maxTokens = 800,
  temperature = 0.2,
}: ClaudeRequest) {
  const { apiKey, model } = getClaudeConfig();

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      ...(system ? { system } : {}),
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API request failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as ClaudeResponse;
  return payload.content?.filter((block) => block.type === "text").map((block) => block.text).join("\n").trim() ?? "";
}
