// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/local-launcher/route";
afterEach(() => vi.unstubAllEnvs());
it("is disabled outside a launcher-created server", async () => {
  vi.stubEnv("CLIPFORGE_LOCAL_ROOT", ""); vi.stubEnv("CLIPFORGE_LOCAL_INSTANCE", "");
  expect((await GET()).status).toBe(404);
});
it("returns an uncached instance marker without filesystem paths, credentials or data access", async () => {
  vi.stubEnv("CLIPFORGE_LOCAL_ROOT", "hashed-root"); vi.stubEnv("CLIPFORGE_LOCAL_INSTANCE", "instance");
  const response = await GET();
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ app: "clipforge-local", rootId: "hashed-root", instanceId: "instance" });
});
