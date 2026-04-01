"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
            <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-8 w-8" />
                <h2 className="text-2xl font-bold tracking-tight">Something went wrong!</h2>
            </div>
            <p className="text-muted-foreground max-w-md text-center">
                We apologize for the inconvenience. An unexpected error has occurred.
                Please try again or contact support if the problem persists.
            </p>
            <div className="flex gap-4 mt-4">
                <Button onClick={() => reset()} variant="default">
                    Try again
                </Button>
                <Button onClick={() => window.location.href = '/dashboard'} variant="outline">
                    Return to Dashboard
                </Button>
            </div>
        </div>
    );
}
