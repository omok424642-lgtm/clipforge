import { describe, expect, it, vi } from "vitest";
// @ts-expect-error The existing jsdom test runtime is installed without @types/jsdom.
import { JSDOM } from "jsdom";
import { parseBrowserProduct } from "../browser-product";
import { collectRenderedProductPage, productBookmarklet } from "../product-bookmarklet";

const sample = () => ({ version: 1, sourceUrl: "https://www.coupang.com/vp/products/123?itemId=4&vendorItemId=5", collectedAt: "2026-10-28T00:00:00Z", title: "컵", price: "1000원", images: ["https://thumbnail.coupangcdn.com/a.jpg"], options: ["블랙"], reviews: ["쓰기 편해요", "쓰기 편해요"], specifications: ["500ml"], videoPresent: true });

describe("browser import boundary", () => {
  it("deduplicates and keeps product variants and collection evidence", () => {
    const result = parseBrowserProduct(sample());
    expect(result.reviews).toEqual(["쓰기 편해요"]);
    expect(result.sourceUrl).toContain("itemId=4&vendorItemId=5");
    expect(result.collectedAt).toBe("2026-10-28T00:00:00.000Z");
  });
  it("discards unknown fields, author identities, HTML and permissions", () => {
    const result = parseBrowserProduct({ ...sample(), title: "<script>x</script>컵", cookies: "secret", author: "홍길동", token: "secret", videoUrl: "https://private/video", rights: true });
    expect(JSON.stringify(result)).not.toMatch(/secret|홍길동|videoUrl|<script>/);
    expect(result.rights.commercialReuse).toBe("unconfirmed");
  });
  it("redacts recognizable contact information", () => {
    expect(parseBrowserProduct({ ...sample(), reviews: ["문의 a@example.com / 010-1234-5678"] }).reviews[0]).not.toMatch(/example|1234/);
  });
  it("drops foreign, duplicate and credential-bearing images", () => {
    expect(parseBrowserProduct({ ...sample(), images: [...sample().images, ...sample().images, "https://evil.com/a.jpg", "https://user:pass@thumbnail.coupangcdn.com/a.jpg", "javascript:alert(1)"] }).images).toEqual(sample().images);
  });
  it.each(["https://evil.com/vp/products/123", "https://link.coupang.com/a/abc", "https://www.coupang.com/vp/products/123?access_token=secret", "https://www.coupang.com/vp/products/123#token"])("rejects unsafe or unresolved URL %s", sourceUrl => expect(() => parseBrowserProduct({ ...sample(), sourceUrl })).toThrow());
  it("does not invent missing data or accept future dates", () => {
    const r = parseBrowserProduct({ version: 1, sourceUrl: sample().sourceUrl, collectedAt: sample().collectedAt });
    expect(r.brand).toBe(""); expect(r.reviews).toEqual([]); expect(r.images).toEqual([]);
    expect(() => parseBrowserProduct({ ...sample(), collectedAt: "2099-01-01" })).toThrow();
  });
});

function page(url: string, html: string) {
  const dom = new JSDOM(html, { url, runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  Object.defineProperty(w.HTMLElement.prototype, "innerText", { get() { return this.textContent; } });
  w.Element.prototype.getClientRects = function () { return (this.tagName === "OPTION" || this.closest('[hidden],[style="display:none"]') ? [] : [{}]) as unknown as DOMRectList; };
  const attach = w.Element.prototype.attachShadow;
  w.Element.prototype.attachShadow = function () { return attach.call(this, { mode: "open" }); };
  w.alert = vi.fn();
  const fetch = vi.fn(); Object.assign(w, { fetch });
  w.eval(`(${collectRenderedProductPage.toString()})()`);
  return { dom, w, fetch, root: w.document.getElementById("clipforge-product-import")?.shadowRoot };
}

describe("independent rendered-page bookmarklet", () => {
  it("extracts Coupang fields without fetching, reading reviewer names or unrelated page text", () => {
    const p = page(sample().sourceUrl, `<h1 class="prod-buy-header__title">컵</h1><div class="total-price"><strong>1000원</strong></div><div class="prod-option"><select><option selected>블랙</option><option>화이트</option></select></div><div class="prod-image"><img src="https://thumbnail.coupangcdn.com/a.jpg"></div><div class="product-detail"><img src="https://thumbnail.coupangcdn.com/a.jpg"><video></video></div><span class="review-author">홍길동</span><div class="sdp-review__article__list__review__content">쓰기 편해요</div><div class="sdp-review__article__list__review__content">쓰기 편해요</div><div hidden class="sdp-review__article__list__review__content">숨김 리뷰</div><p>배송 안내</p>`);
    const data = JSON.parse((p.root!.querySelector("textarea[data-clipforge-snapshot]") as HTMLTextAreaElement).value);
    expect(data.title).toBe("컵"); expect(data.price).toBe("1000원"); expect(data.options).toEqual(["블랙"]);
    expect(data.images).toHaveLength(1); expect(data.reviews).toEqual(["쓰기 편해요"]); expect(data.videoPresent).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/홍길동|배송 안내|숨김 리뷰|화이트/);
    expect(p.fetch).not.toHaveBeenCalled();
    expect(p.root!.querySelector("button")!.disabled).toBe(true);
    p.dom.window.close();
  });
  it("supports Naver independently and never fills missing fields from body text", () => {
    const p = page("https://smartstore.naver.com/shop/products/123", `<div data-shp-area="top"><h3>네이버 컵</h3><span itemprop="price">2000원</span></div><div id="INTRODUCE"><p>스테인리스</p><img src="https://shop-phinf.pstatic.net/1.jpg"></div><div data-shp-area="review"><span data-review-content>가벼워요</span></div><div>별점 5점 브랜드 이름 로그인 이름</div>`);
    const data = JSON.parse((p.root!.querySelector("textarea[data-clipforge-snapshot]") as HTMLTextAreaElement).value);
    expect(data.title).toBe("네이버 컵"); expect(data.description).toBe("스테인리스"); expect(data.brand).toBe(""); expect(data.rating).toBe(""); expect(data.reviews).toEqual(["가벼워요"]);
    p.dom.window.close();
  });
  it("invalidates confirmation when a user edits collected fields", () => {
    const p = page(sample().sourceUrl, '<h1 class="prod-buy-header__title">컵</h1>');
    const check = p.root!.querySelector('label input[type="checkbox"]') as HTMLInputElement;
    check.checked = true; check.dispatchEvent(new p.w.Event("change"));
    const save = p.root!.querySelector("button")!;
    expect(save.disabled).toBe(false);
    const title = p.root!.querySelector('textarea[aria-label="상품명"]') as HTMLTextAreaElement;
    title.value = "수정한 상품"; title.dispatchEvent(new p.w.Event("input"));
    expect(check.checked).toBe(false); expect(save.disabled).toBe(true);
    expect(JSON.parse((p.root!.querySelector("textarea[data-clipforge-snapshot]") as HTMLTextAreaElement).value).title).toBe("수정한 상품");
    p.dom.window.close();
  });
  it("refuses unsupported and affiliate landing hosts", () => {
    const p = page("https://www.coupang.com.evil.com/vp/products/123", "<h1>상품</h1>");
    expect(p.root).toBeUndefined(); expect(p.w.alert).toHaveBeenCalled(); expect(p.fetch).not.toHaveBeenCalled(); p.dom.window.close();
  });
  it("produces executable standalone bookmark code", () => {
    const p = page(sample().sourceUrl, ""); p.w.document.getElementById("clipforge-product-import")!.remove();
    const code = decodeURIComponent(productBookmarklet().slice("javascript:".length));
    expect(() => p.w.eval(code)).not.toThrow(); expect(p.w.document.getElementById("clipforge-product-import")).not.toBeNull(); p.dom.window.close();
  });
});
