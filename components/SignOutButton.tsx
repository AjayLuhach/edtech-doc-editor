import { FiLogOut } from "react-icons/fi";
import { logoutAction } from "@/lib/auth/actions";

// Server component: a form posting to the logout server action (no client JS needed).
export default function SignOutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="flex items-center gap-1.5 rounded-lg border border-black/15 px-3 py-1.5 text-sm transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
      >
        <FiLogOut aria-hidden className="h-4 w-4" />
        Sign out
      </button>
    </form>
  );
}
