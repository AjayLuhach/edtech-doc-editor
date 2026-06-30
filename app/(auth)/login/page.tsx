import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { loginAction } from "@/lib/auth/actions";
import { getSession } from "@/lib/auth/session";

export default async function LoginPage() {
  if (await getSession()) redirect("/documents");
  return <AuthForm mode="login" action={loginAction} />;
}
