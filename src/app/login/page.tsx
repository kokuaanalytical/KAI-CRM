import { signIn } from "./actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string; error?: string };
}) {
  const next = searchParams?.next ?? "/accounts";
  const error = searchParams?.error ? decodeURIComponent(searchParams.error) : null;

  return (
    <div className="flex h-dvh items-center justify-center p-6">
      <Card className="w-full max-w-md rounded-2xl border-border bg-card/30">
        <CardContent className="space-y-4 p-6">
          <div>
            <div className="text-2xl font-semibold">Kai</div>
            <div className="text-sm text-muted-foreground">Sign in</div>
          </div>

          <form action={signIn} className="space-y-3">
            <input type="hidden" name="next" value={next} />

            <Input name="email" className="rounded-2xl" placeholder="Email" required />
            <Input name="password" type="password" className="rounded-2xl" placeholder="Password" required />

            {error && <div className="text-sm text-red-400">{error}</div>}

            <Button className="w-full rounded-2xl" type="submit">
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
