import { redirect } from "next/navigation";

export default function Home() {
    // Automatically redirect the root route to the dashboard.
    // The Clerk middleware will intercept this and require sign-in first if unauthenticated.
    redirect("/dashboard");
}
