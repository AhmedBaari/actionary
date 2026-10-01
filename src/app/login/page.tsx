"use client";

import { FormEvent, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SASTRANetLogo } from "@/components/SASTRANetLogo";

function getCallbackUrl() {
  if (typeof window === "undefined") return "/";

  const callbackUrl = new URLSearchParams(window.location.search).get(
    "callbackUrl"
  );

  return callbackUrl?.startsWith("/") ? callbackUrl : "/";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          rememberMe: true,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
          error?: string | { message?: string };
        } | null;
        const errorMessage =
          typeof body?.error === "string"
            ? body.error
            : body?.error?.message;
        throw new Error(
          body?.message ??
            errorMessage ??
            "Unable to sign in. Check your email and password."
        );
      }

      window.location.assign(getCallbackUrl());
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to sign in. Please try again."
      );
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-6 py-12">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>

      <section className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-sm transition-colors sm:p-10">
        <div className="mb-10">
          <SASTRANetLogo className="mb-5 text-[var(--color-brand)]" size={42} />
          <h1 className="font-[family-name:var(--font-outfit)] text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Welcome back
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
            Sign in with your workspace account to continue.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label
              className="text-sm font-semibold text-[var(--color-text-primary)]"
              htmlFor="email"
            >
              Work email
            </label>
            <input
              required
              autoComplete="email"
              className="h-12 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand)]"
              id="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              type="email"
              value={email}
            />
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-semibold text-[var(--color-text-primary)]"
              htmlFor="password"
            >
              Password
            </label>
            <input
              required
              autoComplete="current-password"
              className="h-12 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand)]"
              id="password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </div>

          {error ? (
            <p
              aria-live="polite"
              className="rounded-lg border border-[var(--severity-red)]/30 bg-[var(--severity-red)]/10 px-4 py-3 text-sm leading-5 font-medium text-[var(--severity-red)]"
            >
              {error}
            </p>
          ) : null}

          <button
            className="h-12 w-full rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
