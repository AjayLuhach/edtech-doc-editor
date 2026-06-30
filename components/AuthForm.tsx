"use client";
import Link from "next/link";
import { useActionState } from "react";
import type { AuthState } from "@/types/auth";

type Props = {
  mode: "login" | "register";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
};

const field =
  "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 dark:border-white/15 dark:bg-neutral-900";

export default function AuthForm({ mode, action }: Props) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, {});
  const isRegister = mode === "register";

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4" noValidate>
      <h1 className="text-xl font-semibold">{isRegister ? "Create your account" : "Welcome back"}</h1>

      {isRegister && (
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium">Name</label>
          <input id="name" name="name" autoComplete="name" required className={field} />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className={field} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isRegister ? "new-password" : "current-password"}
          required
          minLength={8}
          className={field}
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
      </button>

      <p className="text-sm text-neutral-500">
        {isRegister ? "Already have an account? " : "Need an account? "}
        <Link href={isRegister ? "/login" : "/register"} className="font-medium underline">
          {isRegister ? "Sign in" : "Create one"}
        </Link>
      </p>
    </form>
  );
}
