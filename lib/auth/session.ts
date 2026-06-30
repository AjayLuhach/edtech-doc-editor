import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import type { SessionUser } from "@/types/auth";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "./constants";
import { signSession, verifySession } from "./jwt";

// Deduped per request so multiple callers share one cookie read/verify.
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
});

// Set the httpOnly session cookie; only callable from a route handler or server action.
export async function createSession(user: SessionUser): Promise<void> {
  const token = await signSession(user);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
