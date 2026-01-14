import { redirect } from "next/navigation";

export default function AppLoginRedirect({
  searchParams,
}: {
  searchParams?: { next?: string; error?: string };
}) {
  const next = searchParams?.next ?? "/";
  const error = searchParams?.error;

  const qs = new URLSearchParams();
  if (next) qs.set("next", next);
  if (error) qs.set("error", error);

  redirect(`/login?${qs.toString()}`);
}
