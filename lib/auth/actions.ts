"use server";
import { redirect } from "next/navigation";
import type { AuthState } from "@/types/auth";
import { credentialsSchema, registerSchema } from "@/lib/validation/auth";
import { hashPassword, verifyPassword } from "./password";
import { findLogin, registerUser } from "./queries";
import { createSession, destroySession } from "./session";

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Please enter a name, a valid email, and an 8+ character password." };

  const email = parsed.data.email.toLowerCase();
  const hash = await hashPassword(parsed.data.password);
  let userId: string;
  try {
    userId = await registerUser(email, parsed.data.name, hash);
  } catch {
    return { error: "That email is already registered." };
  }
  await createSession({ userId, name: parsed.data.name, email });
  redirect("/documents");
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Invalid email or password." };

  const email = parsed.data.email.toLowerCase();
  const found = await findLogin(email);
  // Verify even when not found to keep timing similar and avoid leaking which emails exist.
  const ok = found
    ? await verifyPassword(parsed.data.password, found.passwordHash)
    : await verifyPassword(parsed.data.password, "$2a$12$0000000000000000000000000000000000000000000000000000");
  if (!found || !ok) return { error: "Invalid email or password." };

  await createSession({ userId: found.id, name: found.name, email });
  redirect("/documents");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
