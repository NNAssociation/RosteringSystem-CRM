import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL } from "@/config/api";
export { API_BASE_URL } from "@/config/api";

export const baseQuery = fetchBaseQuery({
    baseUrl: API_BASE_URL,
    credentials: "include",
    prepareHeaders: async (headers) => {
        const token = typeof window === "undefined" ? null : await (window as any).Clerk?.session?.getToken();
        if (token) headers.set("authorization", `Bearer ${token}`);
        return headers;
    },
});
