import { useMemo } from "react";

export function useFormattedDate(dateInput: Date | string | number) {
  return useMemo(() => {
    const date = new Date(dateInput);
    const today = new Date();

    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const startOfDate = new Date(date.setHours(0, 0, 0, 0));

    const diff =
      (startOfDate.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24);

    const formatted = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    if (diff === 0) return `Today ${formatted}`;
    if (diff === 1) return `Tomorrow ${formatted}`;
    if (diff === -1) return `Yesterday ${formatted}`;

    return formatted;
  }, [dateInput]);
}
