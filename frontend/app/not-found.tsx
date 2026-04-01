import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background px-4">
            <div className="text-center space-y-2">
                <h1 className="text-9xl font-bold tracking-tighter text-primary/20">404</h1>
                <h2 className="text-3xl font-bold tracking-tight">Page not found</h2>
                <p className="text-muted-foreground max-w-sm mx-auto">
                    Sorry, we couldn't find the page you're looking for. It might have been moved or deleted.
                </p>
            </div>
            <Button asChild className="mt-8">
                <Link href="/sign-in">Return to Login</Link>
            </Button>
        </div>
    );
}
