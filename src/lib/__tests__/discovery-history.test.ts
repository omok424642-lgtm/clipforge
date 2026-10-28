// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { NextRequest } from "next/server";
import * as schema from "../db/schema";
import { initializeSqlite } from "../db/initialize";

const state = vi.hoisted(() => ({ db: undefined as unknown as BetterSQLite3Database<typeof schema> }));
vi.mock("@/lib/db", () => ({ getDb: () => state.db }));
import { POST as createProject } from "@/app/api/project/route";
import { GET as getHistory } from "@/app/api/discovery/history/route";

let sqlite: InstanceType<typeof Database>;
beforeAll(() => {
  sqlite = new Database(":memory:"); initializeSqlite(sqlite, process.cwd() + "/drizzle"); state.db = drizzle(sqlite, { schema });
});
beforeEach(() => { state.db.delete(schema.compositions).run(); state.db.delete(schema.projects).run(); state.db.delete(schema.settings).run(); });
afterAll(() => sqlite.close());
const request = (body: unknown) => new NextRequest("http://localhost/api/project", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

describe("production history integration", () => {
  it("preserves the existing project creation contract without a library reference", async () => {
    const res = await createProject(request({ name: "원래 방식", productName: "수납함", productImages: [], videoMode: "graphic_montage" }));
    expect(res.status).toBe(201); const p = await res.json();
    expect(p.name).toBe("원래 방식"); expect(p.videoMode).toBe("graphic_montage"); expect(p.productId).toBeNull();
    expect(state.db.select().from(schema.settings).all()).toEqual([]);
  });
  it("persists library/canonical identity and raw affiliate URL atomically", async () => {
    const originalUrl = "https://naver.me/ABC?tag=a%2Fb&x=1";
    const res = await createProject(request({ name: "상품 영상", productName: "보온병", productReference: { libraryId: "library-a", originalUrl, resolvedUrl: "https://smartstore.naver.com/store/products/123" } }));
    expect(res.status).toBe(201); const p = await res.json(); expect(p.shopUrl).toBe(originalUrl); expect(p.productId).toBe("library-a");
    const out = await (await getHistory()).json();
    expect(out.history[0].identity).toBe("naver:smartstore.naver.com:store:123"); expect(out.history[0].completedCount).toBe(0);
    expect(out.history[0].originalUrl).toBe(originalUrl);
  });
  it("counts completed renders, active and failed jobs separately; a click/draft is not a video", async () => {
    const p = await (await createProject(request({ name: "이력", productReference: { libraryId: "a" } }))).json();
    for (const [status, outputPath] of [["done", "/tmp/final.mp4"], ["done", null], ["composing", null], ["pending", null], ["failed", null]] as const) state.db.insert(schema.compositions).values({ projectId: p.id, status, outputPath }).run();
    const res = await getHistory(); expect(res.status).toBe(200); expect(res.headers.get("cache-control")).toBe("no-store");
    const entry = (await res.json()).history[0]; expect(entry.completedCount).toBe(1); expect(entry.activeCount).toBe(2); expect(entry.failedCount).toBe(1);
    expect(JSON.stringify(entry)).not.toContain("/tmp/final.mp4");
  });
  it("rejects invalid identity input without leaving a project behind", async () => {
    const res = await createProject(request({ name: "invalid", productReference: { libraryId: "../bad" } }));
    expect(res.status).toBe(400); expect(state.db.select().from(schema.projects).all()).toEqual([]);
  });
  it("rolls back project creation if recording its identity fails", async () => {
    sqlite.exec("CREATE TRIGGER fail_discovery_identity BEFORE INSERT ON settings BEGIN SELECT RAISE(ABORT, 'test identity failure'); END");
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await createProject(request({ name: "rollback", productReference: { libraryId: "a" } }));
      expect(res.status).toBe(500); expect(state.db.select().from(schema.projects).all()).toEqual([]);
    } finally { sqlite.exec("DROP TRIGGER fail_discovery_identity"); quiet.mockRestore(); }
  });
  it("reports unavailable history instead of claiming no production exists", async () => {
    const real = state.db;
    state.db = { select() { throw new Error("unavailable"); } } as unknown as typeof real;
    try { const res = await getHistory(); expect(res.status).toBe(503); expect((await res.json()).error).toContain("불러오지"); }
    finally { state.db = real; }
  });
});
