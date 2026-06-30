import "server-only";
import bcrypt from "bcryptjs";

// bcryptjs is pure JS (no native build) so it works on Vercel without externalizing.
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
