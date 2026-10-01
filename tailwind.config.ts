import type { Config } from "tailwindcss";

export default {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                outfit: "var(--font-outfit)",
                "plus-jakarta": "var(--font-plus-jakarta-sans)",
                mono: "var(--font-jetbrains-mono)",
            },
            colors: {
                bone: "var(--color-bone)",
                sand: "var(--color-sand)",
                brand: "var(--color-brand)",
                surface: "var(--color-surface)",
            },
        },
    },
    plugins: [],
} satisfies Config;
