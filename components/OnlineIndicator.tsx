"use client";
import { useEffect, useState } from "react";
import { FiWifi, FiWifiOff } from "react-icons/fi";

// Global, always-visible network indicator (fixed bottom-left).
export default function OnlineIndicator() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-3 left-3 z-50 flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium shadow-sm ${
        online
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"
          : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
      }`}
    >
      {online ? <FiWifi aria-hidden className="h-3.5 w-3.5" /> : <FiWifiOff aria-hidden className="h-3.5 w-3.5" />}
      {online ? "Online" : "Offline"}
    </div>
  );
}
