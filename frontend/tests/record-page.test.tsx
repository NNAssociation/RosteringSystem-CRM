import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { useRecordPage } from "../hooks/use-record-page";

it("resets on filter changes and clamps after records are removed", () => {
  const { result, rerender } = renderHook(({ total, key }) => useRecordPage(total, key), {
    initialProps: { total: 5, key: "all" },
  });
  act(() => result.current[1](5));
  expect(result.current[0]).toBe(5);
  rerender({ total: 2, key: "all" });
  expect(result.current[0]).toBe(2);
  rerender({ total: 4, key: "active" });
  expect(result.current[0]).toBe(1);
  rerender({ total: 0, key: "active" });
  expect(result.current[0]).toBe(1);
});
