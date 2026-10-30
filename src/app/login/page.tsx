import Link from "next/link";
import { Screen } from "@/components/screen";
import { isAuthConfigured } from "@/server/auth/current-user";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Screen className="justify-center">
      <div className="font-display text-[28px] font-semibold text-accent">
        dear money
      </div>
      <p className="m-0 text-[15px] text-ink-muted">
        Хватит ли мне на то, что важно, и сколько для этого откладывать.
      </p>
      <LoginForm configured={isAuthConfigured()} />
      <Link href="/install" className="text-center text-sm font-semibold">
        Как установить на iPhone
      </Link>
    </Screen>
  );
}
