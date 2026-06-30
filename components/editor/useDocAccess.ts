"use client";
import { useEffect, useState } from "react";
import { getDocAccess } from "@/lib/docs/api";
import type { Role } from "@/types/auth";

// Resolve the caller's role for a doc. Defaults to owner for local-only (unsynced) docs.
export function useDocAccess(docId: string): { role: Role; resolved: boolean } {
  const [role, setRole] = useState<Role>("owner");
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let active = true;
    setResolved(false);
    void getDocAccess(docId).then((access) => {
      if (!active) return;
      if (access) setRole(access.role);
      setResolved(true);
    });
    return () => {
      active = false;
    };
  }, [docId]);

  return { role, resolved };
}
