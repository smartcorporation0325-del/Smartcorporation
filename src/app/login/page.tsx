import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { signInAction } from "./actions";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard");
  }
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Elite Marry Me</div>
          <h1 className="mt-1 text-lg font-semibold">Sales Intelligence</h1>
        </div>
        {error && <div className="mb-4 rounded-lg border border-bad/30 bg-bad/5 p-2 text-xs text-bad">{error}</div>}
        <form action={signInAction} className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input name="email" type="email" required />
          </div>
          <div>
            <Label>Password</Label>
            <Input name="password" type="password" required />
          </div>
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
      </Card>
    </div>
  );
}
