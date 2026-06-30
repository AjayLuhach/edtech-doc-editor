import { redirect } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";
import { getSession } from "@/lib/auth/session";

export default async function DocumentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Your documents</h1>
          <p className="text-sm text-neutral-500">Signed in as {session.name}</p>
        </div>
        <SignOutButton />
      </header>

      <section className="mt-8 rounded-xl border border-dashed border-black/15 p-10 text-center text-neutral-500 dark:border-white/15">
        Local-first editor lands in the next phase.
      </section>
    </main>
  );
}
