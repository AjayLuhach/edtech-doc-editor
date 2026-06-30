import "server-only";
import { SignJWT, jwtVerify } from "jose";
import type { SessionUser } from "@/types/auth";

const ALG = "HS256";

// Read the secret lazily so a missing env var fails at call time, not module load/build.
function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(value);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ name: user.name, email: user.email })
    .setProtectedHeader({ alg: ALG })
    .setSubject(user.userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] });
    if (typeof payload.sub !== "string" || typeof payload.name !== "string" || typeof payload.email !== "string") {
      return null;
    }
    return { userId: payload.sub, name: payload.name, email: payload.email };
  } catch {
    return null;
  }
}
