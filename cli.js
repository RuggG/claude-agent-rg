#!/usr/bin/env node

import * as readline from "readline";

const API_URL = process.env.AGENT_API_URL || "http://localhost:3000";
const API_KEY = process.env.AGENT_API_KEY || "test123";

const args = process.argv.slice(2);
const isInteractive = args.includes("-i") || args.includes("--interactive");
const prompt = args.filter(a => !a.startsWith("-")).join(" ");

if (!prompt && !isInteractive) {
  console.log("Usage: ./cli.js [options] <prompt>");
  console.log("       ./cli.js -i    (interactive mode)");
  console.log("");
  console.log("Options:");
  console.log("  -i, --interactive   Start interactive session");
  console.log("");
  console.log("Environment:");
  console.log("  AGENT_API_URL       API endpoint (default: http://localhost:3000)");
  console.log("  AGENT_API_KEY       API key for authentication");
  process.exit(0);
}

// Track session across messages
let sessionId = null;
let lastText = "";
let isResuming = false;

async function chat(message) {
  // Track if we're resuming an existing session
  isResuming = sessionId !== null;

  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
    },
    body: JSON.stringify({
      message,
      sessionId, // Pass session ID for continuity
    }),
  });

  if (!res.ok) {
    console.error(`❌ Error: ${res.status} ${res.statusText}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  lastText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;

      try {
        const event = JSON.parse(line.slice(6));

        // Capture session ID for subsequent messages
        if (event.sessionId && !sessionId) {
          sessionId = event.sessionId;
        }

        formatEvent(event);
      } catch (e) {
        // Skip malformed JSON
      }
    }
  }
}

function formatEvent(event) {
  switch (event.type) {
    case "system":
      if (event.data?.subtype === "init") {
        const resumeLabel = isResuming ? " (resuming)" : "";
        console.log(`\n🤖 \x1b[36mInitialized\x1b[0m (${event.data.model})${resumeLabel}`);
        console.log(`   Tools: ${event.data.tools?.length || 0} available`);
      }
      break;

    case "assistant":
      const content = event.data?.message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "text" && block.text) {
            if (block.text !== lastText) {
              console.log(`\n📝 \x1b[37m${block.text}\x1b[0m`);
              lastText = block.text;
            }
          } else if (block.type === "tool_use") {
            console.log(`\n🔧 \x1b[33mTool:\x1b[0m ${block.name}`);
            const input = formatToolInput(block.name, block.input);
            if (input) console.log(`   ${input}`);
          } else if (block.type === "thinking") {
            console.log(`\n💭 \x1b[90mThinking...\x1b[0m`);
          }
        }
      }
      break;

    case "text":
      break;

    case "tool_progress":
      process.stdout.write(`\r   ⏳ ${event.data?.tool_name || "Working"}... (${Math.round(event.data?.elapsed_time_seconds || 0)}s)`);
      break;

    case "result":
      const data = event.data;
      if (data) {
        const cost = data.total_cost_usd?.toFixed(4) || "0.0000";
        const duration = ((data.duration_ms || 0) / 1000).toFixed(1);
        const status = data.is_error ? "❌ Error" : "✅ Done";
        console.log(`\n${status} \x1b[90m(${duration}s, $${cost})\x1b[0m\n`);
      }
      break;

    case "error":
      console.log(`\n❌ \x1b[31mError:\x1b[0m ${event.error}`);
      break;

    case "done":
      break;
  }
}

function formatToolInput(toolName, input) {
  if (!input) return null;

  switch (toolName) {
    case "Bash":
      return `\x1b[90m$ ${input.command}\x1b[0m`;
    case "Read":
      return `\x1b[90m${input.file_path}\x1b[0m`;
    case "Write":
      return `\x1b[90m${input.file_path} (${input.content?.length || 0} chars)\x1b[0m`;
    case "Edit":
      return `\x1b[90m${input.file_path}\x1b[0m`;
    case "Glob":
      return `\x1b[90m${input.pattern}\x1b[0m`;
    case "Grep":
      return `\x1b[90m/${input.pattern}/\x1b[0m`;
    case "WebSearch":
      return `\x1b[90m"${input.query}"\x1b[0m`;
    case "WebFetch":
      return `\x1b[90m${input.url}\x1b[0m`;
    default:
      return `\x1b[90m${JSON.stringify(input).slice(0, 80)}...\x1b[0m`;
  }
}

async function interactive() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\x1b[36m╭─────────────────────────────────────╮\x1b[0m");
  console.log("\x1b[36m│\x1b[0m   Claude Agent Interactive Mode    \x1b[36m│\x1b[0m");
  console.log("\x1b[36m│\x1b[0m   Type 'exit' or Ctrl+C to quit    \x1b[36m│\x1b[0m");
  console.log("\x1b[36m│\x1b[0m   Type 'new' for new session       \x1b[36m│\x1b[0m");
  console.log("\x1b[36m╰─────────────────────────────────────╯\x1b[0m\n");

  const askQuestion = () => {
    const sessionInfo = sessionId ? `\x1b[90m[${sessionId.slice(0, 8)}]\x1b[0m ` : "";
    rl.question(`${sessionInfo}\x1b[32m>\x1b[0m `, async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        askQuestion();
        return;
      }

      if (trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "quit") {
        console.log("\n👋 Goodbye!\n");
        rl.close();
        process.exit(0);
      }

      if (trimmed.toLowerCase() === "new") {
        sessionId = null;
        console.log("\n🔄 Starting new session\n");
        askQuestion();
        return;
      }

      await chat(trimmed);
      askQuestion();
    });
  };

  askQuestion();
}

// Main
if (isInteractive) {
  interactive();
} else {
  chat(prompt).catch((err) => {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  });
}
