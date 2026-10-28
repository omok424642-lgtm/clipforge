// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("../commerce-storage", () => ({ saveCommerceDraft: vi.fn(), readCommerceDraft: vi.fn(), validCommerceDraftId: vi.fn() }));
vi.mock("../commerce-collection", () => ({ collectCommerceProduct: vi.fn() }));
vi.mock("../commerce-images", () => ({ retainCommerceImages: vi.fn() }));
import { POST } from "@/app/api/ingest/commerce/route";
import { saveCommerceDraft } from "../commerce-storage";
import { collectCommerceProduct } from "../commerce-collection";

const material = { version: 1, sourceUrl: "https://www.coupang.com/vp/products/1?itemId=2", collectedAt: "2026-10-28T00:00:00Z", title: "컵", reviews: ["좋아요"] };
const request = (body: unknown) => new NextRequest("http://localhost/api/ingest/commerce", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => vi.clearAllMocks());
describe("confirmed browser import API", () => {
  it("requires explicit review before persistence", async () => {
    expect((await POST(request({ action: "browser_import", material }))).status).toBe(400);
    expect(saveCommerceDraft).not.toHaveBeenCalled();
  });
  it("preserves the affiliate original and immutable source without any remote collection", async () => {
    const r = await POST(request({ action: "browser_import", material, confirmed: true, affiliateUrl: "https://link.coupang.com/a/ORIGINAL?tag=a%2Fb" }));
    const { draft } = await r.json();
    expect(r.status).toBe(200); expect(draft.link.originalUrl).toBe("https://link.coupang.com/a/ORIGINAL?tag=a%2Fb");
    expect(draft.resolvedUrl).toBe(material.sourceUrl); expect(draft.browserMaterials.reviews).toEqual(["좋아요"]);
    expect(draft.status).toBe("needs_review"); expect(collectCommerceProduct).not.toHaveBeenCalled(); expect(saveCommerceDraft).toHaveBeenCalledOnce();
  });
  it.each(["https://smartstore.naver.com/test/products/1", "https://www.coupang.com/vp/products/9?itemId=2", "https://www.coupang.com/vp/products/1?itemId=3"])("rejects another platform/product/option %s", async affiliateUrl => {
    expect((await POST(request({ action: "browser_import", material, confirmed: true, affiliateUrl }))).status).toBe(400);
    expect(saveCommerceDraft).not.toHaveBeenCalled();
  });
  it("rejects over-size payloads", async () => {
    expect((await POST(request({ action: "browser_import", x: "a".repeat(200001) }))).status).toBe(413);
  });
});
