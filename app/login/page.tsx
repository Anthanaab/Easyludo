import { hasPassword } from "@/lib/auth";
import { isAuthed } from "@/lib/session";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await isAuthed()) redirect("/");
  const { next } = await searchParams;
  return <LoginForm setup={!hasPassword()} next={next?.startsWith("/") && !next.startsWith("//") ? next : "/"} />;
}
