import { describe, it, expect, vi, afterEach } from "vitest";
import { createHmac } from "crypto";
import { classifyCommerceLink, sameCommerceProduct, allowedCommerceImage, NAVER_DISCLOSURE, type CommerceProductDraft } from "../commerce-product";
import { collectCommerceProduct, coupangAuthorization, readBounded, robotsPermit } from "../commerce-collection";
import { reviewCommerceProduct } from "../commerce-review";

const naver = "https://smartstore.naver.com/test/products/123";
const coupang = "https://www.coupang.com/vp/products/456?itemId=7&vendorItemId=8";
export function draft(url = naver): CommerceProductDraft {
  return { id: "11111111-1111-4111-8111-111111111111", link: classifyCommerceLink(url), method: "manual", status: "needs_input", collectedAt: "2026-10-27T00:00:00Z", title: "", price: "", options: [], features: [], description: "", images: [], warnings: [], disclosure: { enabled: true, text: NAVER_DISCLOSURE, placement: "video_overlay" } };
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
afterEach(() => vi.restoreAllMocks());

describe("platform links and immutable affiliate originals", () => {
  it.each([naver, "https://m.smartstore.naver.com/test/products/123", "https://brand.naver.com/test/products/123", "https://naver.me/aB1", "https://shoppingconnect.naver.com/link/abc", "https://brandconnect.naver.com/a/abc", "https://link.naver.com/a/abc"])("identifies Naver %s", (url) => expect(classifyCommerceLink(url).platform).toBe("naver"));
  it.each([coupang, "https://m.coupang.com/vm/products/456", "https://link.coupang.com/a/aBc", "https://www.coupang.com/vp/products/456?lptag=affiliate"])("identifies Coupang %s", (url) => expect(classifyCommerceLink(url).platform).toBe("coupang"));
  it("preserves original parameter order, encoding and affiliate code", () => {
    const url = "https://link.coupang.com/a/ABC?tag=a%2Fb&x=1#original";
    expect(classifyCommerceLink(url).originalUrl).toBe(url);
  });
  it.each(["http://smartstore.naver.com/a/products/1", "https://smartstore.naver.com.evil.com/a/products/1", "https://evil.com/naver.me/a", "https://smartstore.naver.com@evil.com/a/products/1", "https://user:password@smartstore.naver.com/a/products/1", "https://127.0.0.1/", "https://www.coupang.com:8080/vp/products/1", "javascript:alert(1)", "https://naver.me/", "https://www.coupang.com/login"])("rejects unsafe/unsupported link %s", (url) => expect(() => classifyCommerceLink(url)).toThrow());
  it("matches exact store and item variants, never search catalog IDs alone", () => {
    expect(sameCommerceProduct(classifyCommerceLink(naver), naver)).toBe(true);
    expect(sameCommerceProduct(classifyCommerceLink(naver), "https://smartstore.naver.com/other/products/123")).toBe(false);
    expect(sameCommerceProduct(classifyCommerceLink(coupang), coupang.replace("itemId=7", "itemId=9"))).toBe(false);
    expect(sameCommerceProduct(classifyCommerceLink(coupang), "https://www.coupang.com/vp/products/456")).toBe(false);
  });
});

describe("retired Naver adapter", () => {
  it("never calls the retired API even with credentials and reviewed terms", async () => {
    const request = vi.fn();
    const result = await collectCommerceProduct(draft(), "물병", { naverPolicyReviewed: true, naverClientId: "test", naverClientSecret: "test" }, request);
    expect(request).not.toHaveBeenCalled(); expect(result.title).toBe("");
    expect(result.warnings.join(" ")).toContain("종료");
  });
});

describe("official Coupang adapter", () => {
  const config = { coupangPolicyReviewed: true, coupangAccessKey: "access", coupangSecretKey: "secret" };
  it("signs the exact GET path and query with UTC YYMMDD timestamp", () => {
    const path = "/products/search", query = "keyword=test";
    const expected = createHmac("sha256", "secret").update("261027T010203ZGET" + path + query).digest("hex");
    expect(coupangAuthorization(path, query, "access", "secret", new Date("2026-10-27T01:02:03Z"))).toBe(`CEA algorithm=HmacSHA256, access-key=access, signed-date=261027T010203Z, signature=${expected}`);
  });
  it("collects exact product/option and preserves affiliate original", async () => {
    const source = draft("https://link.coupang.com/a/ABC?tag=original"); source.resolvedUrl = coupang;
    const result = await collectCommerceProduct(source, "물병", config, async () => json({ rCode: "0", data: { productData: [{ productId: 456, productUrl: coupang, productName: "물병", productPrice: 12300, productImage: "https://thumbnail.coupangcdn.com/a.jpg" }] } }));
    expect(result.title).toBe("물병"); expect(result.link.originalUrl).toBe("https://link.coupang.com/a/ABC?tag=original"); expect(result.method).toBe("coupang_partners_api");
  });
  it("does not substitute a cheaper different option", async () => {
    const result = await collectCommerceProduct(draft(coupang), "물병", config, async () => json({ rCode: "0", data: { productData: [{ productId: 456, productUrl: coupang.replace("itemId=7", "itemId=9"), productName: "잘못된 옵션" }] } }));
    expect(result.title).toBe("");
  });
});

describe("access restrictions and public metadata", () => {
  it("makes no network calls without reviewed terms and credentials", async () => {
    const request = vi.fn();
    const result = await collectCommerceProduct(draft(), "물병", {}, request);
    expect(request).not.toHaveBeenCalled(); expect(result.status).toBe("needs_input");
  });
  it("stops before fetching a robots-disallowed product", async () => {
    const request = vi.fn(async () => new Response("User-agent: *\nDisallow: /", { status: 200 }));
    const result = await collectCommerceProduct(draft(), "", { publicMetadataReviewed: true }, request);
    expect(request).toHaveBeenCalledTimes(1); expect(result.title).toBe("");
  });
  it("does not retry a blocked page or treat a CAPTCHA title as a product", async () => {
    const request = vi.fn(async (url: string) => url.endsWith("robots.txt") ? new Response("User-agent: *\nAllow: /\n") : new Response("<title>CAPTCHA</title>", { headers: { "content-type": "text/html" } }));
    const result = await collectCommerceProduct(draft(), "", { publicMetadataReviewed: true }, request);
    expect(request).toHaveBeenCalledTimes(2); expect(result.title).toBe(""); expect(result.warnings.join()).toContain("우회");
  });
  it("blocks cross-platform/internal redirects without a follow-up request", async () => {
    const request = vi.fn(async (url: string) => url.endsWith("robots.txt") ? new Response("User-agent: *\nAllow: /\n") : new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } }));
    await collectCommerceProduct(draft(), "", { publicMetadataReviewed: true }, request);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("extracts explicit Product properties and variants without inventing facts", async () => {
    const product = { "@type": "Product", name: "물병", description: "판매자 설명", offers: { price: 29900, priceCurrency: "KRW" }, additionalProperty: [{ name: "용량", value: "500ml" }], hasVariant: [{ name: "블랙" }], image: ["https://shop-phinf.pstatic.net/a.jpg", "https://evil.com/a.jpg"] };
    const request = async (url: string) => url.endsWith("robots.txt") ? new Response("User-agent: *\nAllow: /\n") : new Response(`<script type="application/ld+json">${JSON.stringify(product)}</script>`, { headers: { "content-type": "text/html" } });
    const result = await collectCommerceProduct(draft(), "", { publicMetadataReviewed: true }, request);
    expect(result.title).toBe("물병"); expect(result.features).toEqual(["용량: 500ml"]); expect(result.options).toEqual(["블랙"]); expect(result.images).toHaveLength(1);
  });
  it("bounds chunked HTML and rejects oversized declared bodies", async () => {
    await expect(readBounded(new Response("12345"), 4)).rejects.toThrow("크기");
    await expect(readBounded(new Response("x", { headers: { "content-length": "999" } }), 4)).rejects.toThrow("크기");
  });
  it("conservatively denies unknown robot policies", () => {
    expect(robotsPermit("", "/products/1")).toBe(false);
    expect(robotsPermit("<html>error</html>", "/products/1")).toBe(false);
    expect(robotsPermit("User-agent: *\nDisallow: /products/*", "/products/1")).toBe(false);
  });
});

describe("review gate", () => {
  const review = { title: "물병", price: "29,900원", options: ["블랙 500ml"], features: ["소재: 스테인리스"], description: "판매 페이지 확인", factsConfirmed: true, imageRightsConfirmed: true, disclosureEnabled: true, disclosureText: NAVER_DISCLOSURE };
  it("retains original affiliate URL and source snapshot while tracking edits", () => {
    const source = draft("https://naver.me/aBc?tag=original");
    const result = reviewCommerceProduct(source, { ...review, selectedImages: [`/api/files/products/${source.id}/photo.png`], link: { originalUrl: "https://evil.com" } });
    expect(result.link.originalUrl).toBe(source.link.originalUrl); expect(source.title).toBe(""); expect(result.review?.editedFields).toContain("title"); expect(result.status).toBe("reviewed");
  });
  it.each([{ factsConfirmed: false }, { imageRightsConfirmed: false }, { title: "" }, { options: [] }, { features: [] }, { disclosureText: "" }])("refuses incomplete or unconfirmed review %j", (override) => {
    const source = draft();
    expect(() => reviewCommerceProduct(source, { ...review, selectedImages: [`/api/files/products/${source.id}/photo.png`], ...override })).toThrow();
  });
  it("rejects arbitrary URLs, other imports, path traversal and executable SVG", () => {
    for (const image of ["https://127.0.0.1/a.jpg", "/api/files/products/other/photo.jpg", `/api/files/products/${draft().id}/../../secret.png`, `/api/files/products/${draft().id}/image.svg`]) {
      expect(() => reviewCommerceProduct(draft(), { ...review, selectedImages: [image] })).toThrow();
    }
  });
  it("restricts platform image hostnames exactly", () => {
    expect(allowedCommerceImage("https://shop-phinf.pstatic.net/a.jpg", "naver")).toBe(true);
    expect(allowedCommerceImage("https://thumbnail.coupangcdn.com/a.jpg", "coupang")).toBe(true);
    expect(allowedCommerceImage("https://thumbnail.coupangcdn.com.evil.com/a.jpg", "coupang")).toBe(false);
    expect(allowedCommerceImage("http://shop-phinf.pstatic.net/a.jpg", "naver")).toBe(false);
  });
});
