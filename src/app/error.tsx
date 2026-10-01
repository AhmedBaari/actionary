"use client";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
            <div className="text-center">
                <h1 className="text-4xl font-bold font-outfit mb-2">
                    Something went wrong
                </h1>
                <p className="text-[var(--color-text-secondary)] mb-6">
                    {error.message || "An unexpected error occurred"}
                </p>
            </div>
            <button
                onClick={reset}
                className="px-6 py-2 bg-[var(--color-brand)] text-white rounded-lg font-medium hover:opacity-90 transition"
            >
                Try again
            </button>
        </div>
    );
}
