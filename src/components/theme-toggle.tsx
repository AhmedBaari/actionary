"use client";

import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): "light" | "dark" | "system" {
  try {
    return (
      (localStorage.getItem("sastranet-theme") as
        | "light"
        | "dark"
        | "system") || "system"
    );
  } catch {
    return "system";
  }
}

function getServerSnapshot(): "light" | "dark" | "system" {
  return "system";
}

export function ThemeToggle() {
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function applyTheme(newTheme: "light" | "dark" | "system") {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    if (newTheme === "dark") {
      root.classList.add("dark");
    } else if (newTheme === "light") {
      root.classList.add("light");
    }
  }

  function toggle() {
    const isDarkEffective =
      theme === "dark" ||
      (theme === "system" &&
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    const nextTheme = isDarkEffective ? "light" : "dark";
    try {
      localStorage.setItem("sastranet-theme", nextTheme);
      window.dispatchEvent(new Event("storage"));
    } catch {}
    applyTheme(nextTheme);
  }

  if (!isMounted) {
    return <div className="h-8 w-8" />;
  }

  const isDarkEffective =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <button
      aria-label={`Switch to ${isDarkEffective ? "light" : "dark"} mode`}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
      onClick={toggle}
      title={`Currently ${theme} (${isDarkEffective ? "dark" : "light"}). Click to switch.`}
      type="button"
    >
      {isDarkEffective ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
