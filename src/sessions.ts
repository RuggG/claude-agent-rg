import { v4 as uuidv4 } from "uuid";
import type { Session } from "./types.js";

const sessions = new Map<string, Session>();

const SESSION_MAX_AGE_MS = parseInt(
  process.env.SESSION_MAX_AGE_MS || "3600000",
  10
);

export function getOrCreateSession(sessionId?: string): Session {
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    session.lastAccessedAt = new Date();
    return session;
  }

  const newSession: Session = {
    id: sessionId || uuidv4(),
    createdAt: new Date(),
    lastAccessedAt: new Date(),
  };

  sessions.set(newSession.id, newSession);
  return newSession;
}

export function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId);
}

export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

export function listSessions(): Session[] {
  return Array.from(sessions.values());
}

export function cleanupStaleSessions(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [id, session] of sessions) {
    if (now - session.lastAccessedAt.getTime() > SESSION_MAX_AGE_MS) {
      sessions.delete(id);
      cleaned++;
    }
  }

  return cleaned;
}

// Run cleanup every 5 minutes
setInterval(cleanupStaleSessions, 5 * 60 * 1000);
