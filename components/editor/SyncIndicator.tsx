import { FiAlertTriangle, FiCheck, FiCloudOff, FiLock, FiRefreshCw } from "react-icons/fi";
import type { SyncStatus } from "./useSync";

const MAP: Record<SyncStatus, { label: string; className: string; Icon: typeof FiCheck; spin?: boolean }> = {
  syncing: { label: "Syncing…", className: "text-blue-600", Icon: FiRefreshCw, spin: true },
  synced: { label: "Synced", className: "text-emerald-600", Icon: FiCheck },
  offline: { label: "Offline — saved locally", className: "text-amber-600", Icon: FiCloudOff },
  error: { label: "Sync failed — will retry", className: "text-red-600", Icon: FiAlertTriangle },
  forbidden: { label: "View only", className: "text-neutral-500", Icon: FiLock },
};

export default function SyncIndicator({ status }: { status: SyncStatus }) {
  const { label, className, Icon, spin } = MAP[status];
  return (
    <span
      role="status"
      aria-live="polite"
      className={`flex items-center gap-1.5 text-xs font-medium ${className}`}
    >
      <Icon aria-hidden className={`h-3.5 w-3.5 ${spin ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}
