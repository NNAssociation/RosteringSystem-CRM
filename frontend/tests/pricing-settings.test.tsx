import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/lib/workflow-api", () => ({ useWorkflowApi: () => state.api }));
import { useCharterPricingSettings } from "../components/settings/useCharterPricingSettings";
import { PUNCHBOWL_DEFAULT_PRICING } from "../lib/charter-pricing";
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("loads and saves pricing through the authenticated API abstraction", async () => {
  state.api.mockResolvedValue(PUNCHBOWL_DEFAULT_PRICING);
  const { result } = renderHook(useCharterPricingSettings);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(state.api).toHaveBeenCalledWith(
    "settings/charter-pricing",
    "GET",
    undefined,
    false,
    expect.any(AbortSignal),
  );
  await act(async () => {
    await result.current.save();
  });
  expect(state.api).toHaveBeenCalledWith(
    "settings/charter-pricing",
    "PUT",
    PUNCHBOWL_DEFAULT_PRICING,
  );
});
it("exposes loading failures and retries without treating defaults as saved settings", async () => {
  state.api.mockRejectedValueOnce(new Error("Access denied"));
  const { result } = renderHook(useCharterPricingSettings);
  await waitFor(() => expect(result.current.error).toBe("Access denied"));
  state.api.mockResolvedValue(PUNCHBOWL_DEFAULT_PRICING);
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe("");
});
