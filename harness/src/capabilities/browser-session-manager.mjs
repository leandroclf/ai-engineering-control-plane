import { randomUUID } from "node:crypto";

export class BrowserSessionManager {
  constructor({ provider, persist = async () => {}, now = () => Date.now(), ttlMs = 30 * 60_000 } = {}) {
    if (!provider) throw new TypeError("browser provider is required");
    this.provider = provider; this.persist = persist; this.now = now; this.ttlMs = ttlMs; this.sessions = new Map(); this.locks = new Map();
  }

  async create({ profileId = null, agentId, projectId, sessionId = randomUUID() }) {
    if (!agentId || !projectId) throw new TypeError("agentId and projectId are required");
    const session = { sessionId, profileId, agentId, projectId, status: "ACTIVE", createdAt: new Date(this.now()).toISOString(), expiresAt: new Date(this.now() + this.ttlMs).toISOString() };
    this.sessions.set(sessionId, session);
    await this.persist({ ...session });
    return Object.freeze({ ...session });
  }

  get(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("BROWSER_SESSION_NOT_FOUND");
    if (session.status !== "ACTIVE") throw new Error(`BROWSER_SESSION_${session.status}`);
    if (new Date(session.expiresAt).getTime() <= this.now()) { session.status = "EXPIRED"; throw new Error("BROWSER_SESSION_EXPIRED"); }
    return session;
  }

  async withLock(sessionId, operation) {
    this.get(sessionId);
    const previous = this.locks.get(sessionId) ?? Promise.resolve();
    let release;
    const current = new Promise((resolve) => { release = resolve; });
    this.locks.set(sessionId, previous.then(() => current));
    await previous;
    try { return await operation(this.get(sessionId)); } finally { release(); if (this.locks.get(sessionId) === current) this.locks.delete(sessionId); }
  }

  async close(sessionId, status = "CLOSED") {
    const session = this.get(sessionId);
    session.status = status;
    session.closedAt = new Date(this.now()).toISOString();
    await this.persist({ ...session });
    return Object.freeze({ ...session });
  }
}
