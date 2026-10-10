import { describe, expect, it } from "vitest";
import { originAllowed, trustedOrigins } from "../config/trustedOrigins.js";

describe("trusted browser origins", () => {
  it("allows configured origins, not suffix lookalikes or null origins", () => {
    const origins = trustedOrigins({
      NODE_ENV: "production",
      PUBLIC_APP_URL: "https://crm.example.test/",
      ALLOWED_ORIGINS: "https://preview.example.test",
    });
    expect(originAllowed("https://crm.example.test", origins)).toBe(true);
    expect(originAllowed("https://preview.example.test", origins)).toBe(true);
    expect(originAllowed("https://crm.example.test.attacker.test", origins)).toBe(false);
    expect(originAllowed("null", origins)).toBe(false);
    expect(originAllowed(undefined, origins)).toBe(true);
    expect(originAllowed("http://localhost:3000", origins)).toBe(false);
  });
  it("requires production configuration and supports local development", () => {
    expect(() => trustedOrigins({ NODE_ENV: "production" })).toThrow();
    expect(trustedOrigins({ NODE_ENV: "development" }).has("http://localhost:3000")).toBe(true);
    expect(() =>
      trustedOrigins({ PUBLIC_APP_URL: "https://user:password@example.test" }),
    ).toThrow();
  });
});
