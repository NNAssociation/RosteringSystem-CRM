"use client";
import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { bookingsApi } from "@/services/api/bookings.api";
export { API_BASE_URL as workflowBase } from "@/config/api";
import { API_BASE_URL as workflowBase } from "@/config/api";
export function useWorkflowApi() {
  const { getToken } = useAuth();
  const dispatch = useDispatch();
  return useCallback(async (path: string, method = "GET", body?: unknown, pdf = false) => {
    const token = await getToken();
    const res = await fetch(`${workflowBase}/${path}`, { method, credentials: "include", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store" });
    if (!res.ok) { const error = await res.json().catch(() => ({})); throw new Error(res.status === 404 && path === "quotations/config" ? "The connected API does not support quotations yet. Rebuild and restart the backend, then retry." : error.error || "Request failed. Please try again."); }
    const result = pdf ? await res.blob() : await res.json();
    if (method !== "GET") dispatch({ type: "records/workflowChanged", payload: { id: result.id, createdResource: method === "POST" && path === "bookings" ? "bookings" : undefined } });
    return result;
  }, [getToken, dispatch]);
}
export function downloadPdf(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const formatMoney = (minor: number, currency = "AUD") => new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(minor / 100);
export const formatTripDate = (iso: string, zone = "Australia/Sydney") => new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: zone }).format(new Date(iso));
export function dateParts(iso: string, zone = "Australia/Sydney") {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}
