import { redirect } from "next/navigation";
import DocumentsClient from "@/components/editor/DocumentsClient";
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

      <DocumentsClient userId={session.userId} />
    </main>
  );
}
