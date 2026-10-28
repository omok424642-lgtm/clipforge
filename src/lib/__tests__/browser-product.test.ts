import { describe, expect, it, vi } from "vitest";
// @ts-expect-error The existing jsdom test runtime is installed without @types/jsdom.
import { JSDOM } from "jsdom";
import { parseBrowserDiagnostics, parseBrowserProduct } from "../browser-product";
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
  it("does not mistake a product ID for a phone number, but removes actual +82 contacts", () => {
    const value = parseBrowserProduct({ ...sample(), description: "상품번호 11424220493 문의 +82 10-1234-5678" });
    expect(value.description).toContain("11424220493"); expect(value.description).not.toContain("1234-5678");
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
  w.Element.prototype.getBoundingClientRect = function () {
    const top = this.hasAttribute("data-offscreen") ? 5000 : Number(this.getAttribute("data-y") || 20);
    const width = Number(this.getAttribute("data-width") || 200), height = Number(this.getAttribute("data-height") || 100), left = Number(this.getAttribute("data-x") || 20);
    return { x: left, y: top, top, bottom: top + height, left, right: left + width, width, height, toJSON() {} };
  };
  Object.defineProperty(w.HTMLImageElement.prototype, "complete", { get() { return !this.hasAttribute("data-pending"); } });
  Object.defineProperty(w.HTMLImageElement.prototype, "naturalWidth", { get() { return this.hasAttribute("data-pending") || this.hasAttribute("data-broken") ? 0 : 100; } });
  const attach = w.Element.prototype.attachShadow;
  w.Element.prototype.attachShadow = function () { return attach.call(this, { mode: "open" }); };
  w.alert = vi.fn();
  const fetch = vi.fn(); Object.assign(w, { fetch });
  Object.defineProperty(w, "__PRELOADED_STATE__", { get() { throw new Error("Private state must not be read"); } });
  Object.defineProperty(w.document, "cookie", { get() { throw new Error("Cookies must not be read"); } });
  w.eval(`(${collectRenderedProductPage.toString()})()`);
  return { dom, w, fetch, root: w.document.getElementById("clipforge-product-import")?.shadowRoot as ShadowRoot | undefined };
}

describe("independent rendered-page bookmarklet", () => {
  it("extracts Coupang fields without fetching, reading reviewer names or unrelated page text", () => {
    const p = page(sample().sourceUrl, `<h1 class="prod-buy-header__title">컵</h1><div class="total-price"><strong>1000원</strong></div><div class="prod-option"><select><option selected>블랙</option><option>화이트</option></select></div><div class="prod-image"><img src="https://thumbnail.coupangcdn.com/a.jpg"></div><div class="product-detail"><img src="https://thumbnail.coupangcdn.com/a.jpg"><video></video></div><button role="tab" aria-selected="true" aria-controls="reviews-cp">리뷰</button><section id="reviews-cp"><span class="review-author">홍길동</span><div class="sdp-review__article__list__review__content">쓰기 편해요</div><div class="sdp-review__article__list__review__content">쓰기 편해요</div><div hidden class="sdp-review__article__list__review__content">숨김 리뷰</div><p>배송 안내</p></section>`);
    const data = JSON.parse((p.root!.querySelector("textarea[data-clipforge-snapshot]") as HTMLTextAreaElement).value);
    expect(data.title).toBe("컵"); expect(data.price).toBe("1,000원"); expect(data.options).toEqual(["블랙"]);
    expect(data.images).toHaveLength(1); expect(data.reviews).toEqual(["쓰기 편해요"]); expect(data.videoPresent).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/홍길동|배송 안내|숨김 리뷰|화이트/);
    expect(p.fetch).not.toHaveBeenCalled();
    expect(Array.from(p.root!.querySelectorAll("button")).find(b => b.textContent === "확인한 자료 파일 저장")!.disabled).toBe(true);
    p.dom.window.close();
  });
  it("supports Naver independently and never fills missing fields from body text", () => {
    const p = page("https://smartstore.naver.com/shop/products/123", `<div data-shp-area="top"><h3>네이버 컵</h3><span itemprop="price">2000원</span></div><div id="INTRODUCE"><p>스테인리스</p><img src="https://shop-phinf.pstatic.net/1.jpg"></div><button role="tab" aria-selected="true" aria-controls="review-pane">리뷰</button><div id="review-pane" data-shp-area="review"><span data-review-content>가벼워요</span></div><div>별점 5점 브랜드 이름 로그인 이름</div>`);
    const data = JSON.parse((p.root!.querySelector("textarea[data-clipforge-snapshot]") as HTMLTextAreaElement).value);
    expect(data.title).toBe("네이버 컵"); expect(data.description).toBe("스테인리스"); expect(data.brand).toBe(""); expect(data.rating).toBe(""); expect(data.reviews).toEqual(["가벼워요"]);
    p.dom.window.close();
  });
  it("invalidates confirmation when a user edits collected fields", () => {
    const p = page(sample().sourceUrl, '<h1 class="prod-buy-header__title">컵</h1>');
    const check = p.root!.querySelector('label input[type="checkbox"]') as HTMLInputElement;
    check.checked = true; check.dispatchEvent(new p.w.Event("change"));
    const save = Array.from(p.root!.querySelectorAll("button")).find(b => b.textContent === "확인한 자료 파일 저장")!;
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

function snapshot(p: ReturnType<typeof page>) {
  return JSON.parse((p.root!.querySelector("textarea[data-clipforge-snapshot]") as HTMLTextAreaElement).value);
}
function button(p: ReturnType<typeof page>, name: string) {
  return Array.from(p.root!.querySelectorAll("button")).find(b => b.textContent === name)!;
}
const liveUrl = "https://smartstore.naver.com/sunnycook1/products/11424220493";
// Synthetic public metadata, NOT HTML retrieved from the user's live product.
const publicHead = `<head><title>예제 냄비 : 예제 상점</title><link rel="canonical" href="${liveUrl}"><meta property="og:type" content="product"><meta property="og:title" content="예제 냄비 : 예제 상점"><meta property="product:price:amount" content="12900"><meta property="product:price:currency" content="KRW"><meta property="product:brand" content="예제 브랜드"><meta property="og:image" content="https://shop-phinf.pstatic.net/example.jpg?type=m510"></head>`;

describe("diagnosing unsupported live-page structures without private state", () => {
  it("uses this page's public product metadata when legacy selectors do not match", () => {
    const p = page(liveUrl, publicHead + '<main><h3 class="unverified-hash">예제 냄비</h3><img src="https://shop-phinf.pstatic.net/example.jpg?type=m1200"></main>');
    const s = snapshot(p);
    expect(s.title).toBe("예제 냄비"); expect(s.price).toBe("12900원"); expect(s.brand).toBe("예제 브랜드");
    expect(s.images).toHaveLength(1); expect(s.diagnostics.counts.titleMatches).toBe(0);
    expect(s.diagnostics.fields.find((f: {name: string}) => f.name === "price").method).toBe("public_metadata");
    expect(s.diagnostics.fields.find((f: {name: string}) => f.name === "title").method).toBe("visible_dom");
    expect(s.options).toEqual([]); expect(s.reviews).toEqual([]); expect(p.fetch).not.toHaveBeenCalled(); p.dom.window.close();
  });
  it("does not treat a generic site title as an access block or product name", () => {
    const p = page(liveUrl, '<title>네이버 스마트스토어</title><div data-shp-area="top"><h3>실제 표시 이름</h3></div>');
    expect(snapshot(p).title).toBe("실제 표시 이름"); expect(snapshot(p).diagnostics.blockedPage).toBe(false); p.dom.window.close();
  });
  it("rejects stale metadata for another product/store instead of mixing SPA products", () => {
    for (const other of [liveUrl.replace("11424220493", "99"), liveUrl.replace("sunnycook1", "another-store")]) {
      const p = page(liveUrl, publicHead.replace(liveUrl, other) + '<h1 itemprop="name">오래된 상품</h1>');
      expect(snapshot(p).title).toBe(""); expect(snapshot(p).diagnostics.metadataIdentity).toBe("mismatch");
      expect(p.root!.textContent).toContain("상품이 다릅니다"); p.dom.window.close();
    }
  });
  it("does not read private bootstrap state, hidden reviews, or unloadable/offscreen images", () => {
    const p = page(liveUrl, publicHead + `<script>window.__PRELOADED_STATE__={title:'비공개 상품',cookie:'secret'}</script><main><img data-offscreen src="https://shop-phinf.pstatic.net/example.jpg?type=m100"><img data-pending src="https://shop-phinf.pstatic.net/example.jpg?type=m200"><img data-broken src="https://shop-phinf.pstatic.net/example.jpg?type=m300"></main><div data-shp-area="review"><p data-review-content data-offscreen>화면 밖 후기</p><p data-review-content hidden>숨김 후기</p><p data-review-content>리뷰 작성 안내</p></div>`);
    const s = snapshot(p); expect(s.images).toEqual([]); expect(s.reviews).toEqual([]);
    expect(JSON.stringify(s)).not.toMatch(/비공개 상품|secret|화면 밖 후기|숨김 후기/); expect(p.fetch).not.toHaveBeenCalled(); p.dom.window.close();
  });
  it("collects only explicit on-screen review bodies, not authors, guidance or recommendation cards", () => {
    const p = page(liveUrl, '<button role="tab" aria-selected="true" aria-controls="review-pane">리뷰</button><div id="review-pane" data-shp-area="review"><span>홍길동</span><p data-review-content>사용하기 편해요</p><p data-review-content>사용하기 편해요</p><aside><p data-review-content>다른 상품 광고</p></aside><p data-review-content style="opacity:0">투명 후기</p></div><div class="recommend"><h1 itemprop="name">추천 상품</h1></div>');
    const s = snapshot(p); expect(s.reviews).toEqual(["사용하기 편해요"]); expect(s.title).toBe("");
    expect(JSON.stringify(s)).not.toMatch(/홍길동|다른 상품 광고|투명 후기|추천 상품/); p.dom.window.close();
  });
  it("reports loading, missing selectors and frames with actions instead of success", () => {
    const p = page(liveUrl, '<h2>안내</h2><iframe></iframe>');
    expect(snapshot(p).title).toBe(""); expect(snapshot(p).diagnostics.counts.frames).toBe(1);
    expect(p.root!.textContent).toContain("상품 영역 단서"); expect(p.root!.textContent).toContain("로딩"); expect(p.root!.textContent).toContain("iframe");
    expect(p.root!.textContent).toContain("직접 선택"); p.dom.window.close();
  });
  it("does not turn an access-check page into a product", () => {
    const p = page(liveUrl, publicHead.replace('예제 냄비 : 예제 상점</title>', '접근이 제한되었습니다</title>') + '<h1>보안 문자 확인</h1>');
    expect(snapshot(p).title).toBe(""); expect(snapshot(p).price).toBe(""); expect(snapshot(p).diagnostics.blockedPage).toBe(true); expect(p.fetch).not.toHaveBeenCalled(); p.dom.window.close();
  });
  it("rereads explicitly after loading while leaving requests to the user", () => {
    const p = page(liveUrl, '<div id="product"></div>');
    p.w.document.getElementById('product')!.innerHTML = '<div data-shp-area="top"><h3>나중에 표시된 상품</h3></div>';
    expect(snapshot(p).title).toBe(""); button(p, "현재 페이지 다시 읽기").click();
    expect(snapshot(p).title).toBe("나중에 표시된 상품"); expect(p.fetch).not.toHaveBeenCalled(); p.dom.window.close();
  });
  it("reads specs only in a matching product table, not shipping or unrelated tables", () => {
    const p = page(liveUrl, '<main><table><tr><th>상품번호</th><td>11424220493</td></tr><tr><th>브랜드</th><td>표시 브랜드</td><th>소재</th><td>스테인리스</td></tr><tr><th>배송 안내</th><td>개인정보</td></tr></table><table><tr><th>브랜드</th><td>다른 브랜드</td></tr></table></main>');
    expect(snapshot(p).brand).toBe("표시 브랜드"); expect(snapshot(p).specifications).toEqual(["브랜드: 표시 브랜드", "소재: 스테인리스"]); p.dom.window.close();
  });
  it("supports explicit text selection for unknown classes without reading adjacent author data", () => {
    const p = page(liveUrl, '<main><div class="unknown"><span>홍길동</span><p id="chosen">선택한 후기 본문</p></div></main>');
    button(p, "화면 글자 직접 선택").click();
    (p.root!.querySelector('select[aria-label="직접 선택할 항목"]') as HTMLSelectElement).value = 'reviews';
    p.w.getSelection = () => ({ rangeCount: 1, getRangeAt: () => ({ commonAncestorContainer: p.w.document.getElementById('chosen')!.firstChild }), toString: () => '선택한 후기 본문' });
    button(p, "선택한 글자 적용").click();
    expect(snapshot(p).reviews).toEqual(["선택한 후기 본문"]); expect(JSON.stringify(snapshot(p))).not.toContain("홍길동");
    expect(snapshot(p).diagnostics.fields.find((f: {name: string}) => f.name === "reviews").method).toBe("manual_selection"); p.dom.window.close();
  });
  it("supports an explicitly chosen visible loaded image without guessing all page images", () => {
    const p = page(liveUrl, '<main><img id="chosen" src="https://shop-phinf.pstatic.net/manual.jpg"></main>');
    expect(snapshot(p).images).toEqual([]); button(p, "화면 이미지 직접 선택").click();
    p.w.document.getElementById('chosen')!.dispatchEvent(new p.w.MouseEvent('click', { bubbles: true }));
    expect(snapshot(p).images).toEqual(['https://shop-phinf.pstatic.net/manual.jpg']);
    expect(snapshot(p).diagnostics.fields.find((f: {name: string}) => f.name === "images").method).toBe("manual_selection"); p.dom.window.close();
  });
  it("rejects text selection from the whole page and after the product address changes", () => {
    const p = page(liveUrl, '<main><p id="text">상품 글자</p></main>');
    button(p, "화면 글자 직접 선택").click();
    p.w.getSelection = () => ({ rangeCount: 1, getRangeAt: () => ({ commonAncestorContainer: p.w.document.body }), toString: () => '전체 페이지' });
    button(p, "선택한 글자 적용").click(); expect(snapshot(p).title).toBe(""); expect(p.w.alert).toHaveBeenCalled();
    p.w.history.pushState(null, '', '/sunnycook1/products/999');
    p.w.getSelection = () => ({ rangeCount: 1, getRangeAt: () => ({ commonAncestorContainer: p.w.document.getElementById('text')!.firstChild }), toString: () => '다른 상품' });
    button(p, "선택한 글자 적용").click(); expect(snapshot(p).title).toBe(""); expect(p.w.alert).toHaveBeenLastCalledWith(expect.stringContaining("주소가 바뀌었습니다")); p.dom.window.close();
  });
  it("refuses to mix a different visible option even when its page URL is unchanged", () => {
    const p = page(sample().sourceUrl, '<div class="prod-option"><select><option selected>블랙</option><option>화이트</option></select></div><p id="text">선택한 상품명</p>');
    (p.w.document.querySelector('select') as HTMLSelectElement).selectedIndex = 1;
    button(p, "화면 글자 직접 선택").click(); p.w.getSelection = () => ({ rangeCount: 1, getRangeAt: () => ({ commonAncestorContainer: p.w.document.getElementById('text')!.firstChild }), toString: () => '선택한 상품명' });
    button(p, "선택한 글자 적용").click(); expect(snapshot(p).title).toBe("");
    expect(p.w.alert).toHaveBeenLastCalledWith(expect.stringContaining("선택 옵션이 변경")); p.dom.window.close();
  });
  it("preserves deselected image choices when manually adding text", () => {
    const p = page(liveUrl, '<div data-shp-area="top"><img src="https://shop-phinf.pstatic.net/1.jpg"></div><p id="text">직접 선택한 상품명</p>');
    const imageBox = Array.from(p.root!.querySelectorAll('label')).find(l => l.querySelector('img'))!.querySelector('input')!;
    imageBox.checked = false; imageBox.dispatchEvent(new p.w.Event('change'));
    button(p, "화면 글자 직접 선택").click(); p.w.getSelection = () => ({ rangeCount: 1, getRangeAt: () => ({ commonAncestorContainer: p.w.document.getElementById('text')!.firstChild }), toString: () => '직접 선택한 상품명' });
    button(p, "선택한 글자 적용").click();
    expect(Array.from(p.root!.querySelectorAll('label')).find(l => l.querySelector('img'))!.querySelector('input')!.checked).toBe(false); p.dom.window.close();
  });
  it("sanitizes diagnostic imports to counters/enums, without accepting HTML or cookies", () => {
    const p = page(liveUrl, publicHead);
    const safe = parseBrowserDiagnostics({ ...snapshot(p).diagnostics, html: '<div>개인정보</div>', cookie: 'secret', sourceUrl: 'https://private/token', counts: { ...snapshot(p).diagnostics.counts, private: 'secret', frames: -5 } });
    expect(JSON.stringify(safe)).not.toMatch(/개인정보|secret|private|token/); expect(safe!.counts.frames).toBe(0);
    const material = parseBrowserProduct(snapshot(p)); expect(material.diagnostics!.collectorVersion).toBe('2026-10-28.4');
    expect(parseBrowserDiagnostics({ collectorVersion: 'injected-private-text' })).toBeUndefined(); p.dom.window.close();
  });
  it("does not attach diagnostics from a different product to a material snapshot", () => {
    const p = page(liveUrl, publicHead);
    expect(parseBrowserProduct({ ...sample(), diagnostics: snapshot(p).diagnostics }).diagnostics).toBeUndefined(); p.dom.window.close();
  });
});

// Deliberately no main/#content, legacy product selectors, CSS names or metadata.
// Values differ from the user's live expectations; no live HTML was retrieved.
function automaticFixture(name = "테스트 무선 전기포트", price = "53,700", extra = "", caption = "예제 전문점") {
  return `<title>${caption}</title><div class="opaque-layout">
    <div class="opaque-gallery"><img id="hero" data-width="300" data-height="300" data-x="20" data-y="100" src="https://shop-phinf.pstatic.net/hero.jpg"><img data-width="60" data-height="60" data-y="450" src="https://shop-phinf.pstatic.net/side.jpg"></div>
    <div class="opaque-buy"><h3>${name}</h3><div>판매가 <strong>${price}원</strong></div><div>카드 혜택 <strong>41,200원</strong></div><div>쿠폰 적용 <strong>40,100원</strong></div><div>배송비 <strong>3,200원</strong></div><div>포인트 적립 <strong>2,000원</strong></div><p>평점 4.63점 <a role="tab">리뷰 1,278건</a></p><button>구매하기</button>${extra}</div>
  </div>`;
}

describe("automatic product-region extraction, with zero manual selection", () => {
  it.each([["테스트 무선 전기포트", "53,700"], ["예제 실리콘 주방 집게", "18,250"], ["테스트 카드 보관 지갑", "27,800"]])("automatically extracts %s from generic rendered structure", (name, price) => {
    const p = page(liveUrl, automaticFixture(name, price)); const s = snapshot(p);
    expect(s.title).toBe(name); expect(s.price).toBe(price + "원");
    expect(s.diagnostics.counts.titleMatches).toBe(0); expect(s.diagnostics.counts.priceMatches).toBe(0); expect(s.diagnostics.counts.metadataTags).toBe(0);
    expect(s.diagnostics.counts.productRegions).toBe(1); expect(s.diagnostics.counts.excludedBenefitPrices).toBeGreaterThan(0);
    expect(s.diagnostics.counts.autoTitle).toBe(1); expect(s.diagnostics.counts.autoPrice).toBe(1); expect(s.diagnostics.counts.autoPrimaryImage).toBe(1);
    expect(s.imageAssets.find((a: {role: string}) => a.role === 'primary').url).toContain('/hero.jpg');
    expect(s.imageAssets.find((a: {role: string}) => a.role === 'additional').url).toContain('/side.jpg');
    expect(s.options).toEqual([]); expect(s.reviews).toEqual([]); expect(p.fetch).not.toHaveBeenCalled(); p.dom.window.close();
  });
  it("separates overall rating and review count from actual review bodies", () => {
    const p = page(liveUrl, automaticFixture()); const s = snapshot(p);
    expect(s.rating).toBe('4.63'); expect(s.reviewCount).toBe('1,278건'); expect(s.reviews).toEqual([]);
    expect(s.diagnostics.counts.reviewTabOpen).toBe(0); expect(s.diagnostics.counts.visibleReviews).toBe(0); p.dom.window.close();
  });
  it("does not read a review body until the review tab is explicitly open", () => {
    const p = page(liveUrl, automaticFixture() + '<nav><button role="tab" aria-selected="false" aria-controls="open-reviews" id="review-tab">리뷰</button></nav><section id="open-reviews"><div data-shp-area="review"><p data-review-content>예제의 실제 리뷰 본문</p></div></section>');
    expect(snapshot(p).reviews).toEqual([]);
    p.w.document.getElementById('review-tab')!.setAttribute('aria-selected','true'); button(p,'현재 페이지 다시 읽기').click();
    expect(snapshot(p).reviews).toEqual(['예제의 실제 리뷰 본문']); expect(snapshot(p).diagnostics.counts.reviewTabOpen).toBe(1); p.dom.window.close();
  });
  it("handles styled product text even without a heading tag or named container", () => {
    const p = page(liveUrl, automaticFixture().replace('<h3>테스트 무선 전기포트</h3>', '<div style="font-size:24px;font-weight:700">테스트 무선 전기포트</div>'));
    expect(snapshot(p).title).toBe('테스트 무선 전기포트'); expect(snapshot(p).price).toBe('53,700원'); p.dom.window.close();
  });
  it("corroborates a displayed heading against the browser caption without OG metadata", () => {
    const p = page(liveUrl, automaticFixture('테스트 보온 물병','35,400','', '테스트 보온 물병 : 예제점').replace('<button>구매하기</button>',''));
    expect(snapshot(p).title).toBe('테스트 보온 물병'); expect(snapshot(p).diagnostics.counts.purchaseControls).toBe(0); expect(snapshot(p).price).toBe('35,400원'); p.dom.window.close();
  });
  it("uses the labelled price, photo and rating summary when even the purchase control is nonstandard", () => {
    const p = page(liveUrl, automaticFixture().replace('<button>구매하기</button>','<button>Npay로 주문</button>'));
    expect(snapshot(p).title).toBe('테스트 무선 전기포트'); expect(snapshot(p).price).toBe('53,700원'); expect(snapshot(p).diagnostics.counts.autoPrimaryImage).toBe(1); p.dom.window.close();
  });
  it("reads a visible emphasized number and sibling currency without a price class", () => {
    const p = page(liveUrl, automaticFixture().replace('<div>판매가 <strong>53,700원</strong></div>','<div><strong>53,700</strong><span>원</span></div>'));
    expect(snapshot(p).price).toBe('53,700원'); expect(snapshot(p).title).toBe('테스트 무선 전기포트'); p.dom.window.close();
  });
  it("rejects competing sale-price candidates instead of choosing the minimum", () => {
    const p = page(liveUrl, automaticFixture().replace('<div>카드 혜택 <strong>41,200원</strong></div>','<div>할인가 <strong>41,200원</strong></div>'));
    expect(snapshot(p).price).toBe(''); expect(snapshot(p).diagnostics.counts.ambiguousPrices).toBe(1); p.dom.window.close();
  });
  it("does not mistake recommendation links, ads, benefits or struck original prices for the product", () => {
    const other = '<a href="https://smartstore.naver.com/other/products/999"><h1>다른 추천 상품 이름</h1><strong>7,200원</strong><button>구매하기</button><img data-width="500" data-height="500" src="https://shop-phinf.pstatic.net/foreign.jpg"></a>';
    const p = page(liveUrl, other + automaticFixture('테스트 무선 전기포트','53,700','<del>원래 가격 80,000원</del>'));
    expect(snapshot(p).title).toBe('테스트 무선 전기포트'); expect(snapshot(p).price).toBe('53,700원'); expect(JSON.stringify(snapshot(p).imageAssets)).not.toContain('foreign.jpg'); p.dom.window.close();
  });
  it("classifies primary, gallery and visible detail images separately", () => {
    const p = page(liveUrl, automaticFixture() + '<section><h2>상품 상세설명</h2><img data-width="300" data-height="400" data-y="300" src="https://shop-phinf.pstatic.net/detail.jpg"></section>');
    expect(snapshot(p).imageAssets.map((a: {role: string}) => a.role)).toEqual(['primary','additional','detail']); p.dom.window.close();
  });
  it("does not relabel a large customer review photo as the representative product image", () => {
    const p = page(liveUrl, automaticFixture() + '<button role="tab" aria-selected="true" aria-controls="customer-review">리뷰</button><section id="customer-review"><img data-width="600" data-height="600" src="https://shop-phinf.pstatic.net/customer-photo.jpg"></section>');
    expect(snapshot(p).imageAssets.find((a: {role: string})=>a.role==='primary').url).toContain('/hero.jpg');
    expect(JSON.stringify(snapshot(p).imageAssets)).not.toContain('customer-photo.jpg'); p.dom.window.close();
  });
  it("does not choose a larger advertisement image linked to another destination", () => {
    const p = page(liveUrl, automaticFixture() + '<a href="https://ads.example.org/campaign"><img data-width="450" data-height="450" src="https://shop-phinf.pstatic.net/ad.jpg"></a>');
    expect(snapshot(p).imageAssets.find((a: {role: string})=>a.role==='primary').url).toContain('/hero.jpg'); expect(JSON.stringify(snapshot(p).imageAssets)).not.toContain('/ad.jpg'); p.dom.window.close();
  });
  it("separates Coupang summary counts from bodies while its review tab is closed", () => {
    const p = page(sample().sourceUrl, '<button id="tab" role="tab" aria-selected="false" aria-controls="cp-reviews">리뷰</button><section id="cp-reviews"><p class="sdp-review__article__list__review__content">공개된 예제 본문</p></section>');
    expect(snapshot(p).reviews).toEqual([]); p.w.document.getElementById('tab')!.setAttribute('aria-selected','true'); button(p,'현재 페이지 다시 읽기').click(); expect(snapshot(p).reviews).toEqual(['공개된 예제 본문']); p.dom.window.close();
  });
  it("leaves arbitrary option controls unconfirmed, reading only labelled selected product controls", () => {
    const p = page(liveUrl, automaticFixture('테스트 무선 전기포트','53,700','<select><option selected>추천순</option></select><button aria-selected="true">상세정보</button>'));
    expect(snapshot(p).options).toEqual([]); p.dom.window.close();
    const q = page(liveUrl, automaticFixture('테스트 무선 전기포트','53,700','<select aria-label="색상 옵션"><option selected>파랑</option><option>빨강</option></select>'));
    expect(snapshot(q).options).toEqual(['파랑']); expect(snapshot(q).diagnostics.fields.find((f: {name: string}) => f.name==='options').path).toBe('selected_control'); q.dom.window.close();
  });
  it("never marks manual supplementation as automatic success", () => {
    const p = page(liveUrl,'<p id="chosen">사용자가 보완한 상품명</p>');
    button(p,'화면 글자 직접 선택').click(); p.w.getSelection=()=>({rangeCount:1,getRangeAt:()=>({commonAncestorContainer:p.w.document.getElementById('chosen')!.firstChild}),toString:()=> '사용자가 보완한 상품명'}); button(p,'선택한 글자 적용').click();
    expect(snapshot(p).title).toBe('사용자가 보완한 상품명'); expect(snapshot(p).diagnostics.counts.autoTitle).toBe(0);
    expect(snapshot(p).diagnostics.fields.find((f: {name: string})=>f.name==='title').confidence).toBe('user_provided'); p.dom.window.close();
  });
  it("reads only the visible body of a dated rated review card after the tab is opened", () => {
    const body = '일상에서 사용하기 편하고 손잡이가 안정적으로 느껴졌습니다.';
    const p = page(liveUrl, automaticFixture() + `<button role="tab" aria-selected="true" aria-controls="plain-reviews">리뷰</button><section id="plain-reviews"><article><p>날짜 앞의 길게 표시된 작성자 소개는 리뷰 본문이 아닙니다.</p><span class="author">홍길동</span><time>2026.10.20.</time><span aria-label="평점 4점">별점</span><p>${body}</p><p>이 리뷰가 도움이 되셨나요? 상품 정보가 아닌 일반 안내입니다.</p><p class="option">선택한 옵션은 고객 개인 선택 정보이므로 본문과 분리합니다.</p></article></section>`);
    expect(snapshot(p).reviews).toEqual([body]); expect(JSON.stringify(snapshot(p))).not.toContain('홍길동'); p.dom.window.close();
  });
  it("recognizes an open review heading and sorting controls without review classes or tab attributes", () => {
    const body='실제로 사용해 본 예제 본문이며 손잡이와 크기가 편하게 느껴졌습니다.';
    const p=page(liveUrl,automaticFixture()+`<section><h2>전체 리뷰</h2><button>최신순</button><article><time>2026.10.20.</time><span aria-label="평점 4점">별점</span><p>${body}</p></article></section>`);
    expect(snapshot(p).reviews).toEqual([body]); expect(snapshot(p).diagnostics.counts.reviewTabOpen).toBe(1); p.dom.window.close();
  });
  it("does not collect account-header or editable draft text as a product title", () => {
    const p = page(liveUrl, '<header><h1>개인 계정 이름은 수집하지 않음</h1></header>' + automaticFixture() + '<div contenteditable="true" style="font-size:30px;font-weight:bold">전송 전 개인 리뷰 초안</div>');
    expect(snapshot(p).title).toBe('테스트 무선 전기포트'); expect(JSON.stringify(snapshot(p))).not.toMatch(/개인 계정|개인 리뷰 초안/); p.dom.window.close();
  });
  it("does not invent automatic-success counters for an old diagnostic", () => {
    const diagnostic = parseBrowserDiagnostics({ collectorVersion:'2026-10-28.2',platform:'naver',productId:'123',counts:{ titleMatches:1 },fields:[] });
    expect(diagnostic!.automaticAssessmentRecorded).toBe(false);
    expect(parseBrowserDiagnostics(diagnostic)!.automaticAssessmentRecorded).toBe(false);
  });
  it("ignores unattached image roles and invalid confidence claims", () => {
    const url = sample().images[0];
    const material = parseBrowserProduct({ ...sample(), imageAssets: [{url,role:'primary',confidence:'verified'},{url:'https://evil.test/private.jpg',role:'detail',confidence:'corroborated'}] });
    expect(material.imageAssets).toEqual([{url,role:'primary',confidence:'unconfirmed'}]);
  });
});

describe('brandstore material scope relationships (synthetic, not live validation)', () => {
  const url = 'https://brand.naver.com/fixture/products/556677';
  it('follows visible same-page detail and review links without relying on CSS names or selected ARIA tabs', () => {
    const body = '이 제품을 출근할 때 매일 사용했는데 손에 잡기 편하고 세척하기도 편했습니다.';
    const p = page(url, automaticFixture() + `<nav><a href="#spec-pane">상품정보</a><a href="#feedback-pane">리뷰(350)</a></nav>
      <div id="spec-pane"><p>공개 상품 설명과 소재 정보입니다.</p><img src="https://shop-phinf.pstatic.net/detail-long.jpg" data-height="400"></div>
      <div id="feedback-pane"><ul><li><span>작성자_개인정보</span><time>2026.10.20</time><span aria-label="평점 4점"></span><p>${body}</p><img data-width="700" data-height="400" src="https://shop-phinf.pstatic.net/customer.jpg"></li></ul></div>
      <aside><a href="#ad">상품정보</a><img src="https://shop-phinf.pstatic.net/ad.jpg"></aside>`);
    const s = snapshot(p);
    expect(s.title).toBe('테스트 무선 전기포트'); expect(s.price).toBe('53,700원');
    expect(s.imageAssets.find((v: {role: string}) => v.role === 'primary').url).toContain('/hero.jpg');
    expect(s.imageAssets.find((v: {role: string}) => v.role === 'detail').url).toContain('/detail-long.jpg');
    expect(s.description).toContain('공개 상품 설명'); expect(s.reviews).toEqual([body]);
    expect(s.diagnostics.counts.reviewTabOpen).toBe(1);
    expect(s.images.join(' ')).not.toMatch(/customer|ad.jpg/);
    expect(JSON.stringify(s.diagnostics)).not.toMatch(/작성자|소재|편했습니다|https:|spec-pane|feedback-pane|shop-phinf/);
    expect(p.fetch).not.toHaveBeenCalled(); p.dom.window.close();
  });
  it('never treats hidden panels, other-page fragments or a link wrapping the whole page as material scopes', () => {
    const p = page(url, automaticFixture() + `<nav><a href="#hidden">상품정보</a><a href="/other/products/44#foreign">리뷰(30)</a></nav><div id="hidden" hidden><p>숨긴 상세 자료</p><img src="https://shop-phinf.pstatic.net/hidden.jpg"></div><div id="foreign"><p>다른 상품 자료</p></div>`);
    const s = snapshot(p); expect(s.description).toBe(''); expect(s.reviews).toEqual([]); expect(s.diagnostics.counts.reviewTabOpen).toBe(0); expect(s.images.join()).not.toContain('hidden'); p.dom.window.close();
  });
  it('finds additional gallery images across presentation wrappers but stops before the product heading and recommendations', () => {
    const html = automaticFixture().replace('<img data-width="60"', '</div></div></div><img data-width="60"').replace('<div class="opaque-gallery">', '<div class="opaque-gallery"><div><div><div>');
    const p = page(url, html + `<div><h3>추천 상품</h3><a href="https://brand.naver.com/fixture/products/999"><img src="https://shop-phinf.pstatic.net/foreign.jpg"></a></div>`);
    const s = snapshot(p); expect(s.imageAssets.find((v: {role: string}) => v.role === 'additional').url).toContain('/side.jpg'); expect(s.images.join()).not.toContain('foreign'); p.dom.window.close();
  });
  it('keeps unlinked unrecognized material images unknown and exports only bounded structural evidence', () => {
    const p = page(url, automaticFixture() + `<div id="private-id"><img src="https://shop-phinf.pstatic.net/unresolved.jpg"></div><button>상품정보</button><button>리뷰(30)</button>`);
    const s = snapshot(p); expect(s.diagnostics.counts.imageScopeRejected).toBeGreaterThan(0); expect(s.images.join()).not.toContain('unresolved');
    expect(s.diagnostics.structure.images.length).toBeGreaterThan(0); expect(s.diagnostics.structure.controls.length).toBeGreaterThanOrEqual(2);
    const value = parseBrowserDiagnostics({ ...s.diagnostics, structure: { ...s.diagnostics.structure, cookie: 'secret', images: Array(100).fill({ supported: true, url: 'secret', ancestors: Array(10).fill({ tag: 'private-user-name', images: 999999, headings: -1, text: 'secret' }) }), controls: [{ kind: 'review', tag: 'A', ancestorTags: ['private-user-name'], text: 'secret' },{kind:'secret'}] } })!;
    expect(value.structure!.images).toHaveLength(24); expect(value.structure!.images[0].ancestors).toHaveLength(7); expect(value.structure!.images[0].ancestors[0]).toEqual({tag:'OTHER',images:1000,headings:0,detail:false,review:false}); expect(JSON.stringify(value)).not.toMatch(/secret|private-user-name|private-id|unresolved/);
    expect(parseBrowserDiagnostics({...s.diagnostics,structure:{version:22}})!.structure).toBeUndefined();
    p.dom.window.close();
  });
});
