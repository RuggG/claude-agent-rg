import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import { runAgent, formatMessage } from "./agent.js";
import {
  getOrCreateSession,
  getSession,
  deleteSession,
  listSessions,
} from "./sessions.js";
import { ChatRequestSchema } from "./types.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// Middleware
app.use(express.json());

// Authentication middleware
function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers["x-api-key"];
  const expectedKey = process.env.AGENT_API_KEY;

  if (!expectedKey) {
    console.warn("Warning: AGENT_API_KEY not set, authentication disabled");
    next();
    return;
  }

  if (apiKey !== expectedKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

// Health check (no auth required)
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Apply auth to all other routes
app.use(authMiddleware);

// Chat endpoint with SSE streaming
app.post("/chat", async (req: Request, res: Response) => {
  const parseResult = ChatRequestSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      error: "Invalid request",
      details: parseResult.error.errors,
    });
    return;
  }

  const { sessionId, message } = parseResult.data;
  const session = getOrCreateSession(sessionId);

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Session-Id", session.id);

  try {
    for await (const sdkMessage of runAgent(message)) {
      const event = {
        type: sdkMessage.type,
        data: sdkMessage,
        sessionId: session.id,
      };
      res.write(`data: ${JSON.stringify(event)}\n\n`);

      // Also log formatted text for debugging
      const formatted = formatMessage(sdkMessage);
      if (formatted) {
        res.write(`data: ${JSON.stringify({ type: "text", content: formatted, sessionId: session.id })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: "done", sessionId: session.id })}\n\n`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.write(
      `data: ${JSON.stringify({ type: "error", error: errorMessage, sessionId: session.id })}\n\n`
    );
  } finally {
    res.end();
  }
});

// Get session info
app.get("/sessions/:id", (req: Request, res: Response) => {
  const session = getSession(req.params.id);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json(session);
});

// List all sessions
app.get("/sessions", (_req: Request, res: Response) => {
  const sessions = listSessions();
  res.json({ sessions, count: sessions.length });
});

// Delete session
app.delete("/sessions/:id", (req: Request, res: Response) => {
  const deleted = deleteSession(req.params.id);

  if (!deleted) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json({ success: true });
});

// Start server
app.listen(PORT, () => {
  console.log(`Claude Agent API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(
    `Auth: ${process.env.AGENT_API_KEY ? "enabled" : "disabled (set AGENT_API_KEY)"}`
  );
});
