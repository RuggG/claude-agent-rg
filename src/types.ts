import { z } from "zod";

export const ChatRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export interface Session {
  id: string;
  createdAt: Date;
  lastAccessedAt: Date;
}

export interface ChatEvent {
  type: "message" | "tool_use" | "tool_result" | "error" | "done";
  data: unknown;
  sessionId: string;
}
