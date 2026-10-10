"use client";
import { Button } from "@/components/ui/button";
import { FEATURES } from "@/config/features";
import {
  useGetEmployeeAccessQuery,
  workplaceApi,
  type EmployeeAccess,
} from "@/services/api/workplace.api";
import { useAuth, UserButton } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
const AccessContext = createContext<EmployeeAccess | null>(null);
export function useEmployeeAccess() {
  const access = useContext(AccessContext);
  if (!access) throw new Error("EmployeeAccess provider is required");
  return access;
}
export function featureEnabled(
  access: EmployeeAccess,
  key: "notices" | "incidents" | "lostProperty",
) {
  return (
    access.features[key] &&
    {
      notices: FEATURES.NOTICES,
      incidents: FEATURES.INCIDENTS,
      lostProperty: FEATURES.LOST_PROPERTY,
    }[key]
  );
}
function WorkspaceLoading() {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 20000);
    return () => clearTimeout(timer);
  }, []);
  if (timedOut)
    return (
      <div className="m-auto max-w-lg space-y-4 p-8">
        <h1 className="text-2xl font-bold">Unable to load your workspace</h1>
        <p role="alert">
          The sign-in or access check is taking too long. Check that the backend is running and your
          connection is available, then reload.
        </p>
        <Button onClick={() => window.location.reload()}>Reload workspace</Button>
      </div>
    );
  return (
    <div className="p-8 text-slate-500" role="status">
      Loading your workspace…
    </div>
  );
}
export function EmployeeAccessGate({ children }: { children: React.ReactNode }) {
  const { userId, isLoaded } = useAuth();
  const dispatch = useDispatch();
  const [cacheOwner, setCacheOwner] = useState(userId);
  const changingAccount = cacheOwner !== userId;
  // Clear old-account records BEFORE subscribing to the new identity request.
  // Resetting on mount erased the in-flight /me request and left it loading forever.
  useEffect(() => {
    if (!changingAccount) return;
    dispatch(workplaceApi.util.resetApiState());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Resume queries after synchronizing the external Redux cache.
    setCacheOwner(userId);
  }, [changingAccount, userId, dispatch]);
  const {
    currentData: data,
    isLoading,
    error,
    refetch,
  } = useGetEmployeeAccessQuery(userId || undefined, {
    skip: !isLoaded || !userId || changingAccount,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
    pollingInterval: 30000,
    skipPollingIfUnfocused: true,
  });
  const path = usePathname(),
    router = useRouter();
  useEffect(() => {
    if (isLoaded && !userId) router.replace("/sign-in");
  }, [isLoaded, userId, router]);
  const key = path.startsWith("/dashboard/notices")
    ? "notices"
    : path.startsWith("/dashboard/incidents")
      ? "incidents"
      : path.startsWith("/dashboard/lost-property")
        ? "lostProperty"
        : null;
  const landing =
    data && featureEnabled(data, "notices")
      ? "/dashboard/notices"
      : data && featureEnabled(data, "incidents")
        ? "/dashboard/incidents"
        : data && featureEnabled(data, "lostProperty")
          ? "/dashboard/lost-property"
          : "/dashboard/notices";
  const redirect = data && !data.office && !key && !path.startsWith("/dashboard/yard");
  useEffect(() => {
    if (redirect) router.replace(landing);
  }, [redirect, router, landing]);
  if (error)
    return (
      <div className="m-auto max-w-lg space-y-4 p-8">
        <UserButton />
        <h1 className="text-2xl font-bold">Employee access</h1>
        <p role="alert">
          {(error as any)?.data?.error || "Unable to verify your access. Please try again."}
        </p>
        <Button onClick={() => refetch()}>Try again</Button>
      </div>
    );
  if (!isLoaded || !userId || changingAccount || isLoading || !data || redirect)
    return <WorkspaceLoading />;
  if (key && !featureEnabled(data, key))
    return (
      <AccessContext.Provider value={data}>
        <div className="m-auto max-w-lg space-y-4 p-8">
          <UserButton />
          <h1 className="text-2xl font-bold">Feature not enabled</h1>
          <p>This module is not enabled for your workspace yet.</p>
          {data.office ? (
            <Button onClick={() => router.push("/dashboard")}>Back to dashboard</Button>
          ) : (
            path !== landing && <Button onClick={() => router.push(landing)}>Open workspace</Button>
          )}
        </div>
      </AccessContext.Provider>
    );
  return <AccessContext.Provider value={data}>{children}</AccessContext.Provider>;
}
