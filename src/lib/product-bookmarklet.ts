/** Standalone function: stringified into a bookmark, no imports or network operations. */
export function collectRenderedProductPage() {
  const h = location.hostname;
  const naver = /^(?:m\.)?smartstore\.naver\.com$|^brand\.naver\.com$/.test(h) && /^\/[^/]+\/products\/\d+\/?$/.test(location.pathname);
  const coupang = /^(?:www\.|m\.)?coupang\.com$/.test(h) && /^\/(?:vp|vm)\/products\/\d+\/?$/.test(location.pathname);
  if (!naver && !coupang) { alert("네이버 스마트스토어 또는 쿠팡의 실제 상품 페이지에서 실행해 주세요. 제휴 링크는 먼저 열어 주세요."); return; }
  if (document.getElementById("clipforge-product-import")) return;
  const visible = (e: Element) => {
    const style = getComputedStyle(e);
    return e.getClientRects().length > 0 && style.display !== "none" && style.visibility !== "hidden" && !e.closest('[hidden],[aria-hidden="true"]');
  };
  const clean = (s: string) => s.replace(/\s+/g, " ").trim().replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[이메일 제외]").replace(/(?:\+82[- .]?)?0?1[016789][- .]?\d{3,4}[- .]?\d{4}/g, "[전화번호 제외]");
  const text = (e: Element | null, max = 4000) => e && visible(e) ? clean((e as HTMLElement).innerText || "").slice(0, max) : "";
  const first = (selectors: string[], max = 500) => {
    for (const selector of selectors) { for (const e of document.querySelectorAll(selector)) { const value = text(e, max); if (value) return value; } }
    return "";
  };
  const many = (selectors: string[], max = 30, length = 500) => [...new Set(selectors.flatMap(selector => Array.from(document.querySelectorAll(selector)).map(e => text(e, length))).filter(Boolean))].slice(0, max);
  const currentOptions = (selector: string) => Array.from(document.querySelectorAll(selector)).filter(visible).flatMap(e => Array.from((e as HTMLSelectElement).selectedOptions).map(option => clean(option.textContent || ""))).filter(value => value && !/선택해|선택하세요|옵션을 선택/.test(value));
  // Only semantic product fields / known product sections. Never body text, state scripts or reviewer containers.
  const detail = naver ? '[data-shp-area="dtl"],#INTRODUCE,#product-detail' : '.product-detail,#productDetail';
  const imageScope = naver ? '[data-shp-area="top"] img,#INTRODUCE img,#product-detail img' : '.prod-image img,.product-image img,.product-detail img,#productDetail img';
  const urls = [...new Set(Array.from(document.querySelectorAll(imageScope)).filter(visible).map(e => (e as HTMLImageElement).currentSrc || (e as HTMLImageElement).src).filter(raw => {
    try { const u = new URL(raw); return u.protocol === "https:" && !u.username && !u.password && !u.port && !u.hash && ![...u.searchParams.keys()].some(k => /token|auth|session|password|credential|signature/i.test(k)) && (naver ? /^(?:shopping-phinf|shop-phinf)\.pstatic\.net$/.test(u.hostname) : /^(?:image|thumbnail\d*)\.coupangcdn\.com$/.test(u.hostname)); } catch { return false; }
  }))].slice(0, 10);
  const source = new URL(location.href); source.hash = "";
  for (const key of [...source.searchParams.keys()]) if (/token|auth|session|password|credential|signature/i.test(key)) source.searchParams.delete(key);
  const data = {
    version: 1, sourceUrl: source.href, collectedAt: new Date().toISOString(),
    title: first(naver ? ['[data-shp-area="top"] h3','[data-shp-area="top"] h2','h1[itemprop="name"]'] : ['h1.prod-buy-header__title','.product-title h1','h1.product-title']),
    price: first(naver ? ['[data-shp-area="top"] [itemprop="price"]','[data-shp-area="top"] [class*="price"]'] : ['.total-price strong','.prod-sale-price','.price-amount']),
    brand: first(['[itemprop="brand"]','.prod-brand-name']),
    options: [...new Set([...currentOptions(naver ? '[data-shp-area="top"] select' : '.prod-option select'), ...many(naver ? ['[data-shp-area="top"] [aria-selected="true"]'] : ['.prod-option [aria-selected="true"]'])])].slice(0, 30),
    description: first(detail.split(","), 4000),
    specifications: many(naver ? ['#DETAIL table tr','[data-shp-area="dtl"] table tr'] : ['.prod-attr-item','#productDetail table tr']),
    images: urls,
    reviews: many(naver ? ['[data-shp-area="review"] [data-review-content]','[data-shp-area="review"] [class*="review_text"]'] : ['.sdp-review__article__list__review__content','.review-content [data-review-content]'], 30, 1500),
    rating: first(naver ? ['[data-shp-area="review"] [itemprop="ratingValue"]'] : ['.prod-rating__number','[itemprop="ratingValue"]'], 100),
    videoPresent: Array.from(document.querySelectorAll(detail.split(",").map(s => s + ' video,' + s + ' iframe').join(","))).some(e => visible(e) && (e.tagName === "VIDEO" || /영상|video/i.test(e.getAttribute("title") || ""))),
    scope: "현재 페이지 · 현재 선택 옵션 · 표시된 자료만",
  };
  const host = document.createElement("div"); host.id = "clipforge-product-import";
  host.style.cssText = "position:fixed;inset:20px;z-index:2147483647;background:white;color:black;border:3px solid #333;overflow:auto;padding:20px;font:15px sans-serif;";
  const root = host.attachShadow({ mode: "closed" });
  const title = document.createElement("h2"); title.textContent = "ClipForge 상품 가져오기 — 저장 전 확인"; root.append(title);
  const note = document.createElement("p"); note.textContent = "현재 선택 옵션과 같은 상품인지 확인하세요. 빈 항목은 미확인입니다. 리뷰에 이름·주소·개인정보나 일반 안내 문구가 남아 있으면 지워 주세요. 수집은 광고 재사용 허락이 아닙니다. 영상은 존재 여부만 기록하며 다운로드하지 않습니다. 자동 전송·추가 페이지 조회는 없습니다."; root.append(note);
  const advanced = document.createElement("details"), summary = document.createElement("summary"); summary.textContent = "고급: 자료 파일 내용"; advanced.append(summary);
  const area = document.createElement("textarea"); area.value = JSON.stringify(data, null, 2); area.style.cssText = "width:95%;height:260px"; area.setAttribute("aria-label", "확인하고 수정할 상품 자료"); area.dataset.clipforgeSnapshot = "1"; advanced.append(area);
  const fields: [string, keyof typeof data][] = [["상품명", "title"], ["가격", "price"], ["브랜드", "brand"], ["현재 선택 옵션 (한 줄에 하나)", "options"], ["상세설명", "description"], ["제품 사양 (한 줄에 하나)", "specifications"], ["표시된 구매평 (한 줄에 하나, 개인정보 제거)", "reviews"], ["표시된 평점", "rating"]];
  for (const [name, key] of fields) {
    const label = document.createElement("label"), field = document.createElement("textarea");
    const current = data[key]; field.value = Array.isArray(current) ? current.join("\n") : String(current); field.placeholder = "미확인 — 직접 보완할 수 있습니다"; field.setAttribute("aria-label", name); field.style.cssText = "display:block;width:95%;min-height:45px;margin-bottom:10px";
    field.oninput = () => {
      const edited = JSON.parse(area.value); edited[key] = Array.isArray(current) ? field.value.split("\n").filter(Boolean) : field.value;
      area.value = JSON.stringify(edited, null, 2); check.checked = false; save.disabled = true;
    };
    label.append(name, field); root.append(label);
  }
  const evidence = document.createElement("p"); evidence.textContent = `출처: ${data.sourceUrl} / 수집: ${data.collectedAt} / 영상: ${data.videoPresent ? "요소 있음 · 사용 권한 미확인" : "미확인"}. 리뷰·평점은 상품 단위이며 현재 옵션과 일치하는지 미확인입니다.`; root.append(evidence, advanced);
  const gallery = document.createElement("div"); root.append(gallery);
  const selected = new Set(urls);
  for (const url of urls) {
    const label = document.createElement("label"), box = document.createElement("input"), image = document.createElement("img");
    box.type = "checkbox"; box.checked = true; box.onchange = () => { if (box.checked) selected.add(url); else selected.delete(url); check.checked = false; save.disabled = true; };
    image.src = url; image.referrerPolicy = "no-referrer"; image.style.cssText = "width:100px;height:100px;object-fit:contain"; image.alt = "가져올 이미지 선택";
    label.append(box, image); gallery.append(label);
  }
  const confirmation = document.createElement("label"), check = document.createElement("input"); check.type = "checkbox";
  confirmation.append(check, "자료 확인 및 개인정보 제거를 완료했습니다."); root.append(confirmation);
  const save = document.createElement("button"); save.textContent = "확인한 자료 파일 저장"; save.disabled = true; check.onchange = () => { save.disabled = !check.checked; }; area.oninput = () => { check.checked = false; save.disabled = true; };
  save.onclick = () => {
    try {
      const edited = JSON.parse(area.value); edited.images = Array.from(selected); edited.sourceUrl = data.sourceUrl; edited.collectedAt = data.collectedAt;
      const blob = new Blob([JSON.stringify(edited, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = "clipforge-product.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch { alert("자료 형식이 잘못되었습니다. JSON 형식을 확인해 주세요."); }
  };
  const close = document.createElement("button"); close.textContent = "닫기"; close.onclick = () => host.remove(); root.append(save, close); document.documentElement.append(host);
}

export function productBookmarklet(): string {
  return `javascript:void(${encodeURIComponent(`(${collectRenderedProductPage.toString()})()`)})`;
}
