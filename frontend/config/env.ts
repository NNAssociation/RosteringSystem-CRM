export const ENV = {
    API_BASE_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
} as const;

// Ensure required environment variables are present
export const validateEnv = () => {
    if (typeof window === "undefined") {
        // Server-side validation
        if (!ENV.CLERK_SECRET_KEY) console.warn("Missing CLERK_SECRET_KEY in environment variables");
    }

    if (!ENV.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
        console.warn("Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in environment variables");
    }
};
