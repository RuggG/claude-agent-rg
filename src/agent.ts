import {
  query,
  type Options,
  type SDKMessage,
  type McpServerConfig,
} from "@anthropic-ai/claude-agent-sdk";

export interface AgentOptions {
  systemPrompt?: string;
  mcpServers?: Record<string, McpServerConfig>;
  model?: string;
  maxTurns?: number;
  cwd?: string;
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant that can read and write files, run commands, search the web, and help with various tasks. Be concise and efficient.`;

export async function* runAgent(
  prompt: string,
  options: AgentOptions = {}
): AsyncGenerator<SDKMessage, void> {
  const mcpServers: Record<string, McpServerConfig> = {
    // Add default MCP servers from environment
    ...(process.env.PRIMER_MCP_URL
      ? {
          "primer-mcp": {
            type: "http" as const,
            url: process.env.PRIMER_MCP_URL,
            headers: {
              "X-API-Key": process.env.PRIMER_MCP_API_KEY || "",
            },
          },
        }
      : {}),
    // Add user-provided MCP servers
    ...options.mcpServers,
  };

  const agentOptions: Options = {
    systemPrompt: options.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    permissionMode: "bypassPermissions",
    mcpServers: Object.keys(mcpServers).length > 0 ? mcpServers : undefined,
    model: options.model,
    maxTurns: options.maxTurns,
    cwd: options.cwd || process.cwd(),
  };

  const queryResult = query({ prompt, options: agentOptions });

  for await (const message of queryResult) {
    yield message;
  }
}

export function formatMessage(message: SDKMessage): string | null {
  switch (message.type) {
    case "assistant": {
      const content = message.message.content;
      if (Array.isArray(content)) {
        return content
          .map((block) => {
            if ("text" in block) return block.text;
            if ("type" in block && block.type === "tool_use") {
              return `[Tool: ${block.name}]`;
            }
            return null;
          })
          .filter(Boolean)
          .join("\n");
      }
      return null;
    }
    case "result":
      return message.subtype === "success" ? message.result : null;
    case "system":
      if (message.subtype === "init") {
        return `[Initialized with model: ${message.model}]`;
      }
      return null;
    default:
      return null;
  }
}
