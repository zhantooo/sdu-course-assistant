/**
 * In-memory store of live SDU SIS sessions, keyed to the app's own session.
 *
 * Holds the authenticated SisClient (its cookie jar) so data loaders can read
 * the student's real pages on later requests. In-memory is fine for this
 * single-node personal tool; a multi-instance deployment would use Redis.
 * Nothing here is persisted to disk — the SIS session lives only for its life.
 */
import { SisClient } from "@/services/sdu/sis/client";

interface PendingLogin {
  client: SisClient;
  createdAt: number;
}
interface SisSession {
  client: SisClient;
  studentId: string;
  createdAt: number;
}

const PENDING_TTL = 10 * 60 * 1000; // 10 min to finish 2FA
const SESSION_TTL = 60 * 60 * 1000; // 1 h; SIS itself may expire sooner

const g = globalThis as unknown as {
  __sisPending?: Map<string, PendingLogin>;
  __sisSessions?: Map<string, SisSession>;
};
g.__sisPending ??= new Map();
g.__sisSessions ??= new Map();

function sweep() {
  const now = Date.now();
  for (const [k, v] of g.__sisPending!) if (now - v.createdAt > PENDING_TTL) g.__sisPending!.delete(k);
  for (const [k, v] of g.__sisSessions!) if (now - v.createdAt > SESSION_TTL) g.__sisSessions!.delete(k);
}

function id(): string {
  return crypto.randomUUID();
}

/** Store a client that is mid-2FA; returns the ticket to put in a short cookie. */
export function stashPending(client: SisClient): string {
  sweep();
  const ticket = id();
  g.__sisPending!.set(ticket, { client, createdAt: Date.now() });
  return ticket;
}

export function takePending(ticket: string | undefined): SisClient | null {
  if (!ticket) return null;
  return g.__sisPending!.get(ticket)?.client ?? null;
}

export function dropPending(ticket: string | undefined): void {
  if (ticket) g.__sisPending!.delete(ticket);
}

/** Promote an authenticated client to a durable SIS session keyed by studentId. */
export function openSession(studentId: string, client: SisClient): void {
  sweep();
  g.__sisSessions!.set(studentId, { client, studentId, createdAt: Date.now() });
}

export function getSisClient(studentId: string): SisClient | null {
  return g.__sisSessions!.get(studentId)?.client ?? null;
}

export function closeSession(studentId: string): void {
  g.__sisSessions!.delete(studentId);
}
