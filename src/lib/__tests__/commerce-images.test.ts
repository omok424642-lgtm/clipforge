import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { retainCommerceImages } from "../commerce-images";
import { classifyCommerceLink, NAVER_DISCLOSURE, type CommerceProductDraft } from "../commerce-product";
import { readCommerceDraft, saveCommerceDraft } from "../commerce-storage";

const state = vi.hoisted(() => ({ root: "" }));
vi.mock("../paths", () => ({ getDataDir: () => state.root, getUploadsDir: () => join(state.root, "uploads") }));
afterEach(async () => { if (state.root) await rm(state.root, { recursive: true, force: true }); vi.restoreAllMocks(); });
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
async function source(): Promise<CommerceProductDraft> {
  state.root = await mkdtemp(join(tmpdir(), "clipforge-commerce-"));
  return { id: "11111111-1111-4111-8111-111111111111", link: classifyCommerceLink("https://naver.me/ABC?original=1"), method: "public_metadata", collectedAt: new Date().toISOString(), status: "needs_review", title: "물병", price: "₩1000", options: ["옵션 없음"], features: ["용량 500ml"], description: "", warnings: [], images: [{ url: "https://shop-phinf.pstatic.net/a.png", sourceUrl: "https://smartstore.naver.com/test/products/1", provenance: "public_metadata" }], disclosure: { enabled: true, text: NAVER_DISCLOSURE, placement: "video_overlay" } };
}
describe("retained product images", () => {
  it("retains validated bytes locally and keeps their original provenance", async () => {
    const input = await source();
    const output = await retainCommerceImages(input, async () => new Response(png, { headers: { "content-type": "image/png" } }));
    const image = output.images[0];
    expect(image.url).toMatch(/^\/api\/files\/products\/.+\.png$/);
    expect(image.sourceUrl).toBe(input.images[0].sourceUrl);
    expect(await readFile(join(state.root, "uploads", "products", input.id, image.url.split("/").pop()!))).toEqual(png);
    expect(input.images[0].url).toBe("https://shop-phinf.pstatic.net/a.png");
  });
  it.each([403, 429, 302])("does not bypass restricted image responses (%s)", async (status) => {
    const input = await source();
    const request = vi.fn(async () => new Response(null, { status, headers: { location: "https://evil.com/" } }));
    const result = await retainCommerceImages(input, request);
    expect(request).toHaveBeenCalledTimes(1); expect(result.images).toEqual([]); expect(result.warnings.length).toBeGreaterThan(0);
  });
  it("rejects an HTML error page mislabeled as a PNG", async () => {
    const result = await retainCommerceImages(await source(), async () => new Response("<html>login</html>", { headers: { "content-type": "image/png" } }));
    expect(result.images).toEqual([]);
  });
  it("never fetches arbitrary image hosts", async () => {
    const input = await source(); input.images[0].url = "https://127.0.0.1/a.png";
    const request = vi.fn(); const output = await retainCommerceImages(input, request);
    expect(request).not.toHaveBeenCalled(); expect(output.images).toEqual([]);
  });
  it("checks that uploaded files exist and contain images", async () => {
    const input = await source();
    const dir = join(state.root, "uploads", "products", input.id); await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "good.png"), png); await writeFile(join(dir, "bad.png"), "not an image");
    input.images = ["good.png", "bad.png", "missing.png"].map((name) => ({ url: `/api/files/products/${input.id}/${name}`, sourceUrl: "사용자 업로드", provenance: "user" }));
    const result = await retainCommerceImages(input);
    expect(result.images).toHaveLength(1); expect(result.images[0].url).toContain("good.png");
  });
});
describe("source/review persistence", () => {
  it("stores reviewed edits separately without overwriting the collected original", async () => {
    const input = await source(); await saveCommerceDraft(input);
    const reviewed: CommerceProductDraft = { ...input, title: "사용자가 보완한 상품명", status: "reviewed" };
    await saveCommerceDraft(reviewed, true);
    expect((await readCommerceDraft(input.id)).title).toBe("물병");
    expect((await readCommerceDraft(input.id, true)).title).toBe("사용자가 보완한 상품명");
    expect((await readCommerceDraft(input.id, true)).link.originalUrl).toBe(input.link.originalUrl);
  });
  it("rejects traversal and arbitrary filenames", async () => {
    const input = await source();
    await expect(saveCommerceDraft({ ...input, id: "../../private" })).rejects.toThrow();
    await expect(readCommerceDraft("../../private")).rejects.toThrow();
  });
});
