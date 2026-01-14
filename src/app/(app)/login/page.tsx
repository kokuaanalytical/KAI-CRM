import { redirect } from "next/navigation";

export default function AppLoginRedirect({
  searchParams,
}: {
  searchParams?: { next?: string; error?: string };
}) {
  const qs = new URLSearchParams();
  if (searchParams?.next) qs.set("next", searchParams.next);
  if (searchParams?.error) qs.set("error", searchParams.error);
  redirect(`/login${qs.toString() ? `?${qs.toString()}` : ""}`);
}
