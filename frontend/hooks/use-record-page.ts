import { useState } from "react";

export function useRecordPage(totalPages: number, resetKey: string) {
  const [selection, setSelection] = useState({ key: resetKey, page: 1 });
  const page = selection.key === resetKey ? Math.min(selection.page, Math.max(1, totalPages)) : 1;
  if (selection.key !== resetKey || selection.page !== page) setSelection({ key: resetKey, page });
  return [
    page,
    (next: number) => setSelection({ key: resetKey, page: Math.max(1, next) }),
  ] as const;
}
