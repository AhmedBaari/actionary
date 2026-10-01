import Link from "next/link";

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
            <div className="text-center">
                <h1 className="text-6xl font-bold font-outfit mb-2">404</h1>
                <h2 className="text-2xl font-semibold mb-4">Page not found</h2>
                <p className="text-[var(--color-text-secondary)] mb-8">
                    The page you're looking for doesn't exist or has been moved.
                </p>
            </div>
            <Link
                href="/"
                className="px-6 py-2 bg-[var(--color-brand)] text-white rounded-lg font-medium hover:opacity-90 transition"
            >
                Go home
            </Link>
        </div>
    );
}
