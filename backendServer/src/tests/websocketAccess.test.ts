import { afterEach, expect, it, vi } from "vitest";
import { setupDispatchNamespace } from "../websocket/dispatchNamespace.js";
const state = vi.hoisted(() => ({ authenticate: vi.fn(), staff: vi.fn(), subscribe: vi.fn() }));
vi.mock("@clerk/express", () => ({ clerkClient: { authenticateRequest: state.authenticate } }));
vi.mock("../middleware/staffAuth.js", () => ({ staffIdentity: state.staff }));
vi.mock("../events/eventBus.js", () => ({ eventBus: { subscribe: state.subscribe } }));
afterEach(() => {
  vi.resetAllMocks();
});
it.each(["anonymous", "inactive", "driver", "office"])(
  "enforces dispatch access for %s",
  async (role) => {
    let authenticate: (socket: any, next: any) => Promise<void> = async () => {};
    const namespace = {
      use: (handler: typeof authenticate) => {
        authenticate = handler;
      },
      on: vi.fn(),
      emit: vi.fn(),
    };
    setupDispatchNamespace({ of: () => namespace } as any);
    state.authenticate.mockResolvedValue({
      toAuth: () => ({
        userId: "user",
        sessionClaims: { exp: Math.floor(Date.now() / 1000) + 60 },
      }),
    });
    if (role === "inactive") state.staff.mockRejectedValue(new Error("Inactive employee"));
    else state.staff.mockResolvedValue({ allowed: role === "office" });
    const next = vi.fn();
    await authenticate(
      { handshake: { auth: role === "anonymous" ? {} : { token: "test-token" } }, data: {} },
      next,
    );
    if (role === "office") expect(next).toHaveBeenCalledWith();
    else expect(next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  },
);
