import type { Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { FiArrowLeft } from "react-icons/fi";
import Editor from "@/components/editor/Editor";
import { getSession } from "@/lib/auth/session";

export default async function DocumentPage({ params }: { params: Promise<{ docId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Validate the id shape before it reaches the store (defends against malformed routes).
  const { docId } = await params;
  if (!z.uuid().safeParse(docId).success) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
      <Link
        href={"/documents" as Route}
        className="mb-4 flex w-fit items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
      >
        <FiArrowLeft aria-hidden className="h-4 w-4" />
        All documents
      </Link>
      {/* Keyed by id so per-document state (editor binding, migration gate) resets on navigation. */}
      <Editor key={docId} docId={docId} />
    </main>
  );
}
