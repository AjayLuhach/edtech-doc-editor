import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { registerAction } from "@/lib/auth/actions";
import { getSession } from "@/lib/auth/session";

export default async function RegisterPage() {
  if (await getSession()) redirect("/documents");
  return <AuthForm mode="register" action={registerAction} />;
}
