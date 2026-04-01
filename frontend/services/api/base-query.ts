import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/";

export const baseQuery = fetchBaseQuery({
    baseUrl: API_BASE_URL,
    credentials: "include",
});
