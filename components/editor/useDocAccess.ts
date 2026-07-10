"use client";
import { useEffect, useState } from "react";
import { getDocAccess } from "@/lib/docs/api";
import type { Role } from "@/types/auth";

// Resolve the caller's role for a doc. Defaults to owner for local-only (unsynced) docs.
// writeConfirmed is true only when writing is provably safe: the server granted an editing role, or
// it was reachable and doesn't know the doc (a local-only doc that belongs to this browser).
export function useDocAccess(docId: string): { role: Role; resolved: boolean; writeConfirmed: boolean } {
  const [role, setRole] = useState<Role>("owner");
  const [resolved, setResolved] = useState(false);
  const [writeConfirmed, setWriteConfirmed] = useState(false);

  useEffect(() => {
    let active = true;
    setRole("owner");
    setResolved(false);
    setWriteConfirmed(false);
    void getDocAccess(docId).then(({ access, reachable }) => {
      if (!active) return;
      if (access) setRole(access.role);
      setWriteConfirmed(access ? access.role !== "viewer" : reachable);
      setResolved(true);
    });
    return () => {
      active = false;
    };
  }, [docId]);

  return { role, resolved, writeConfirmed };
}
