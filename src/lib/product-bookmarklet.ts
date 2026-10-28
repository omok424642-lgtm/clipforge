export const PRODUCT_BOOKMARKLET_VERSION = "2026-10-28.4";

/** Self-contained: stringified into a bookmark. No requests, private state or frame traversal. */
export function collectRenderedProductPage() {
  const version = "2026-10-28.4";
  const h = location.hostname;
  const naver = /^(?:m\.)?smartstore\.naver\.com$|^brand\.naver\.com$/.test(h) && /^\/[^/]+\/products\/\d+\/?$/.test(location.pathname);
  const coupang = /^(?:www\.|m\.)?coupang\.com$/.test(h) && /^\/(?:vp|vm)\/products\/\d+\/?$/.test(location.pathname);
  if (!naver && !coupang) { alert("실제 스마트스토어·브랜드스토어 또는 쿠팡 상품 탭에서 실행해 주세요. 제휴 링크는 먼저 직접 열어 주세요."); return; }
  if (document.getElementById("clipforge-product-import")) { alert("기존 상품 가져오기 창을 닫은 뒤 다시 실행해 주세요. 새 버전은 " + version + "입니다."); return; }
  const clean = (s: string) => s.replace(/\s+/g, " ").trim().replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[이메일 제외]").replace(/(?<!\d)(?:01[016789]|\+82[- .]?0?1[016789])[- .]?\d{3,4}[- .]?\d{4}(?!\d)/g, "[전화번호 제외]");
  const unrelated = 'aside,nav,footer,[role="banner"],[hidden],[aria-hidden="true"],input,textarea,[contenteditable="true"],[class*="recommend" i],[class*="related" i],[id*="recommend" i],[aria-label*="추천"]';
  const displayed = (e: Element) => {
    if (e.closest('#clipforge-product-import,[hidden],[aria-hidden="true"]')) return false;
    for (let p: Element | null = e; p; p = p.parentElement) {
      const style = getComputedStyle(p);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.opacity === "0") return false;
    }
    return e.getClientRects().length > 0;
  };
  const rendered = (e: Element) => {
    const header = e.closest('header');
    return !e.closest(unrelated) && (!header || !!header.closest('main,article,section,[role="main"],[itemtype*="Product"]')) && displayed(e);
  };
  const onScreen = (e: Element) => {
    if (!rendered(e)) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  };
  const query = (selectors: string[]) => [...new Set(selectors.flatMap(s => Array.from(document.querySelectorAll(s))))];
  const text = (e: Element, max = 4000) => rendered(e) && !e.querySelector('input[type="password"],textarea,[contenteditable="true"]') ? clean((e as HTMLElement).innerText || "").slice(0, max) : "";
  const first = (selectors: string[], max = 500) => query(selectors).filter(e => !foreignProduct(e)).map(e => text(e, max)).find(Boolean) || "";
  const many = (selectors: string[], screen = false, max = 30, length = 500) => [...new Set(query(selectors).filter(e => !screen || onScreen(e)).map(e => text(e, length)).filter(Boolean))].slice(0, max);
  const key = (raw: string) => {
    try {
      const u = new URL(raw, location.href);
      if (u.protocol !== "https:" || u.username || u.password || u.port) return "";
      const n = /^(?:m\.)?smartstore\.naver\.com$|^brand\.naver\.com$/.test(u.hostname) && u.pathname.match(/^\/([^/]+)\/products\/(\d+)\/?$/);
      if (n) return `naver:${u.hostname.replace(/^m\./, "")}:${n[1]}:${n[2]}`;
      const c = /^(?:www\.|m\.)?coupang\.com$/.test(u.hostname) && u.pathname.match(/^\/(?:vp|vm)\/products\/(\d+)\/?$/);
      return c ? `coupang:${c[1]}` : "";
    } catch { return ""; }
  };
  const variantKey = () => { const u = new URL(location.href); return key(u.href) + ":" + (u.searchParams.get("itemId") || "") + ":" + (u.searchParams.get("vendorItemId") || ""); };
  const sourceUrl = () => {
    const u = new URL(location.href); u.hash = "";
    for (const name of [...u.searchParams.keys()]) if (/token|auth|session|password|credential|signature/i.test(name)) u.searchParams.delete(name);
    return u.href;
  };
  const adapter = naver ? {
    title: ['[data-shp-area="top"] h3', '[data-shp-area="top"] h2', '[itemscope][itemtype*="Product"] [itemprop="name"]', 'h1[itemprop="name"]'],
    price: ['[data-shp-area="top"] [itemprop="price"]', '[data-shp-area="top"] [class*="price"]', '[itemscope][itemtype*="Product"] [itemprop="price"]'],
    brand: ['[itemscope][itemtype*="Product"] [itemprop="brand"]', '[data-shp-area="top"] [itemprop="brand"]'],
    details: ['[data-shp-area="dtl"]', '#INTRODUCE', '#product-detail'],
    images: ['[data-shp-area="top"] img', '#INTRODUCE img', '#product-detail img', '[data-shp-area="dtl"] img', '[itemscope][itemtype*="Product"] img[itemprop="image"]'],
    selects: '[data-shp-area="top"] select', selected: ['[data-shp-area="top"] [aria-selected="true"]'],
    reviews: ['[data-shp-area="review"] [data-review-content]', '[data-shp-area="review"] [class*="review_text"]', '[itemprop="review"] [itemprop="reviewBody"]'],
    rating: ['[data-shp-area="review"] [itemprop="ratingValue"]', '[itemprop="aggregateRating"] [itemprop="ratingValue"]'],
    specs: ['#DETAIL table', '[data-shp-area="dtl"] table'],
  } : {
    title: ['h1.prod-buy-header__title', '.product-title h1', 'h1.product-title', '[itemscope][itemtype*="Product"] [itemprop="name"]'],
    price: ['.total-price strong', '.prod-sale-price', '.price-amount'], brand: ['.prod-brand-name', '[itemscope][itemtype*="Product"] [itemprop="brand"]'],
    details: ['.product-detail', '#productDetail'], images: ['.prod-image img', '.product-image img', '.product-detail img', '#productDetail img'],
    selects: '.prod-option select', selected: ['.prod-option [aria-selected="true"]'],
    reviews: ['.sdp-review__article__list__review__content', '.review-content [data-review-content]', '[itemprop="review"] [itemprop="reviewBody"]'],
    rating: ['.prod-rating__number', '[itemprop="aggregateRating"] [itemprop="ratingValue"]'], specs: ['#productDetail table'],
  };
  let optionRoot: Element | null = null;
  const readOptions = () => {
    if (naver) {
      if (!optionRoot) return [];
      return Array.from(optionRoot.querySelectorAll('select')).filter(rendered).flatMap(e => {
        const label = [e.getAttribute('aria-label') || '', ...Array.from(e.labels || []).map(l => text(l, 100))].join(' ');
        if (!/옵션|색상|사이즈|종류|규격/.test(label)) return [];
        return Array.from(e.options).filter(o => o.selected && !o.disabled).map(o => clean(o.textContent || '')).filter(v => v && !/선택해|선택하세요|필수|옵션.*선택/.test(v));
      }).slice(0, 30);
    }
    return [...new Set([...query([adapter.selects]).filter(rendered).flatMap(e => Array.from((e as HTMLSelectElement).options).filter(o => o.selected).map(o => clean(o.textContent || ''))), ...many(adapter.selected)].filter(v => v && !/선택해|선택하세요|옵션을 선택/.test(v)))].slice(0, 30);
  };
  const imageUrl = (e: Element, screen = true) => {
    if (!(e instanceof HTMLImageElement) || !(screen ? onScreen(e) : rendered(e)) || !e.complete || e.naturalWidth <= 0) return "";
    try {
      const u = new URL(e.currentSrc || e.src);
      const allowed = naver ? /^(?:shopping-phinf|shop-phinf)\.pstatic\.net$/.test(u.hostname) : /^(?:image|thumbnail\d*)\.coupangcdn\.com$/.test(u.hostname);
      return allowed && u.protocol === "https:" && !u.username && !u.password && !u.port && !u.hash && ![...u.searchParams.keys()].some(k => /token|auth|session|password|credential|signature/i.test(k)) ? u.href : "";
    } catch { return ""; }
  };
  const imageKey = (raw: string) => { const u = new URL(raw); for (const p of ["type", "w", "h", "width", "height", "quality", "q"]) u.searchParams.delete(p); return u.href; };
  const dedupImages = (urls: string[]) => { const seen = new Set<string>(); return urls.filter(u => { const k = imageKey(u); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 10); };
  const meta = (name: string) => document.head?.querySelector(`meta[property="${name}"],meta[name="${name}"]`)?.getAttribute("content")?.trim() || "";
  const generic = /^(?:네이버|네이버\s*스마트스토어|스마트스토어|쿠팡|쿠팡!)$|접근.{0,8}제한|요청.{0,8}차단|보안\s*문자|자동입력\s*방지|access denied|captcha/i;
  const accessProblem = /접근.{0,8}제한|요청.{0,8}차단|보안\s*문자|자동입력\s*방지|access denied|captcha/i;
  const foreignProduct = (e: Element) => {
    const link = e.closest('a[href]');
    const other = link && key(link.getAttribute('href') || '');
    return !!other && other !== key(location.href);
  };
  const adLinkedImage = (e: Element) => {
    const link = e.closest('a[href]'); if (!link) return false;
    try {
      const u = new URL(link.getAttribute('href') || '', location.href);
      if (!/^https?:$/.test(u.protocol)) return false;
      if (key(u.href) === key(location.href)) return false;
      const image = imageUrl(e, false);
      if (image && imageKey(image) === imageKey(u.href)) return false; // A link to the same displayed photo.
      return u.origin !== location.origin || u.pathname !== location.pathname;
    } catch { return true; }
  };
  const money = (t: string) => [...new Set((t.match(/(?:₩\s*\d[\d,]*|\d[\d,]*\s*원)/g) || []).map(v => v.replace(/\D/g, '')).filter(v => v.length <= 12))];
  const badMoney = /카드|쿠폰|할부|혜택|적립|포인트|배송비|청구|최대|리뷰\s*작성|구매\s*확정/;
  const saleLabel = /판매\s*가|판매\s*가격|할인\s*가|상품\s*가격|할인판매/;
  function prices(scope: Element) {
    const nodes = Array.from(scope.querySelectorAll('span,strong,b,em,p,div,dd,td,[itemprop="price"]')).slice(0, 1600);
    const found = new Map<string, { value: string; score: number; labelled: boolean }>();
    let excluded = 0;
    for (const e of nodes) {
      if (!rendered(e) || foreignProduct(e) || e.closest('del,s,[data-shp-area="review"],[itemprop="review"]')) continue;
      const raw = text(e, 170); if (raw.length > 160) continue;
      const values = money(raw); if (values.length !== 1) continue;
      if (Array.from(e.querySelectorAll('del,s')).some(child => money(text(child, 100)).includes(values[0]))) continue;
      let context = raw, struck = false;
      for (let p: Element | null = e, i = 0; p && i < 4; p = p.parentElement, i++) {
        if (/line-through/.test(getComputedStyle(p).textDecorationLine) || /^(DEL|S)$/.test(p.tagName)) struck = true;
        const value = text(p, 170);
        if (value.length > 160 || money(value).length > 1) break;
        context = value;
        if (saleLabel.test(value) || badMoney.test(value) || p === scope) break;
      }
      if (/^(DD|TD)$/.test(e.tagName) && e.previousElementSibling) context = text(e.previousElementSibling, 80) + ' ' + raw;
      if (struck || badMoney.test(context)) { excluded++; continue; }
      const labelled = saleLabel.test(context), style = getComputedStyle(e);
      const emphasizedNumber = Array.from(e.querySelectorAll('strong,b,em')).some(child => text(child, 50).replace(/[,\s₩원]/g, '') === values[0]);
      const bold = emphasizedNumber || /^(STRONG|B|EM)$/.test(e.tagName) || style.fontWeight === 'bold' || Number(style.fontWeight) >= 600;
      const score = (labelled ? 12 : 0) + (e.getAttribute('itemprop') === 'price' ? 12 : 0) + (bold ? 3 : 0) + (parseFloat(style.fontSize) >= 20 ? 2 : 0);
      if (Number(values[0]) === 0 && !labelled) continue;
      const old = found.get(values[0]); if (!old || score > old.score) found.set(values[0], { value: values[0], score, labelled });
    }
    const candidates = [...found.values()].sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const ambiguous = !!best && !!candidates[1] && best.score - candidates[1].score < 4;
    return { value: best && best.score >= 3 && !ambiguous ? `${Number(best.value).toLocaleString('ko-KR')}원` : '', labelled: best?.labelled || false, count: candidates.length, excluded, ambiguous };
  }
  function findRegion(metaTitle: string) {
    const caption = clean(document.title);
    const largeImages = query(['img']).filter(e => { const r = e.getBoundingClientRect(); return !!imageUrl(e, false) && r.width >= 100 && r.height >= 100 && !foreignProduct(e) && !adLinkedImage(e); });
    const buy = query(['button','a','[role="button"]']).filter(e => rendered(e) && /^(?:N\s*Pay\s*)?(구매하기|바로\s*구매|구매|장바구니(?:\s*담기)?)$/.test(text(e, 60)) && !foreignProduct(e));
    const semantic = query(['h1','h2','h3','h4','[role="heading"]']);
    const styled = query(['strong','p','span','div']).slice(0, 2000).filter(e => { const st = getComputedStyle(e); return parseFloat(st.fontSize) >= 20 && (Number(st.fontWeight) >= 500 || st.fontWeight === 'bold'); }).slice(0, 100);
    const headings = [...new Set([...semantic, ...styled])].filter(e => {
      const t = text(e, 310);
      return t.length >= 6 && t.length <= 300 && /(?:[가-힣]{2}|[A-Za-z]{3})/.test(t) && !money(t).length && !generic.test(t) && !foreignProduct(e) && !/^(?:상품\s*(정보|상세|문의)|상세\s*(정보|설명)|제품\s*상세|전체\s*(리뷰|구매평)|리뷰|구매평|배송\s*안내|카드\s*혜택|쿠폰|추천\s*상품|최근\s*본|함께\s*구매|인기\s*상품|장바구니|구매하기)/.test(t);
    }).slice(0, 80);
    const regions = new Map<string, { root: Element; heading: Element; name: string; score: number; price: ReturnType<typeof prices>; corroborated: boolean }>();
    const cache = new Map<Element, ReturnType<typeof prices>>();
    let moneyCount = 0, excludedMoney = 0, ambiguousMoney = false;
    for (const heading of headings) {
      const name = text(heading, 300), matching = [caption, metaTitle].some(t => t === name || t.startsWith(name + ' : ') || t.startsWith(name + ' - ') || t.startsWith(name + ' | '));
      for (let p = heading.parentElement, depth = 0; p && !/^(BODY|HTML)$/.test(p.tagName) && depth < 7; p = p.parentElement, depth++) {
        const controls = buy.filter(b => p!.contains(b));
        if (Array.from(p.querySelectorAll('h1,h2,h3')).some(e => /^(추천\s*상품|함께\s*구매|최근\s*본|광고)/.test(text(e, 50)))) continue;
        if (!cache.has(p)) cache.set(p, prices(p));
        const price = cache.get(p)!;
        moneyCount = Math.max(moneyCount, price.count); excludedMoney = Math.max(excludedMoney, price.excluded); ambiguousMoney ||= price.ambiguous;
        if (!price.value) continue;
        const hr = heading.getBoundingClientRect();
        const photos = largeImages.filter(img => { const r = img.getBoundingClientRect(); return p!.contains(img) || (Math.abs(r.top - hr.top) < 450 && Math.abs(r.left - hr.left) < 1100); });
        if (!photos.length && !matching) continue;
        const aggregate = !controls.length && !matching ? productSummary(p) : null;
        if (!controls.length && !matching && (!price.labelled || !photos.length || !(aggregate?.rating || aggregate?.reviewCount))) continue;
        const score = (matching ? 12 : 0) + (controls.length ? 8 : 0) + (price.labelled ? 5 : 0) + (photos.length ? 4 : 0) + (/^H[123]$/.test(heading.tagName) ? 3 : 0) - depth;
        const old = regions.get(name);
        if (!old || score > old.score) regions.set(name, { root: p, heading, name, score, price, corroborated: matching || (price.labelled && !!photos.length && (!!controls.length || !!aggregate?.rating || !!aggregate?.reviewCount)) });
        break; // The smallest qualifying product scope, never the entire body.
      }
    }
    const sorted = [...regions.values()].sort((a, b) => b.score - a.score);
    const ambiguous = sorted.length > 1 && sorted[0].score - sorted[1].score < 3;
    return { region: ambiguous ? null : sorted[0] || null, headingCount: headings.length, buyCount: buy.length, ambiguous, moneyCount, excludedMoney, ambiguousMoney };
  }
  // Follow only explicit same-document relationships. Never click, scroll, fetch or guess hashed classes.
  const areaKind = (e: Element) => {
    const value = clean((e as HTMLElement).innerText || '').slice(0, 80).replace(/\s+/g, '');
    if (/^(?:상품상세(?:정보|설명)?|상세정보|상세설명|상품정보|제품상세)(?:[\d,()건개]*)$/.test(value)) return 'detail';
    if (/^(?:전체)?(?:리뷰|구매평|상품평)(?:[\d,()건개]*)$/.test(value)) return 'review';
    return '';
  };
  function linkedAreas(kind: 'detail' | 'review') {
    const result: Element[] = [];
    for (const control of query(['a[href]', '[aria-controls]', 'button', '[role="tab"]']).slice(0, 3000)) {
      if ((kind === 'review' && control.getAttribute('aria-selected') === 'false') || !displayed(control) || foreignProduct(control) || control.closest('aside,footer,[class*="recommend" i]') || areaKind(control) !== kind) continue;
      const ids = (control.getAttribute('aria-controls') || '').split(/\s+/).filter(Boolean);
      try {
        const raw = control.getAttribute('href');
        if (raw) { const u = new URL(raw, location.href); if (u.origin === location.origin && u.pathname === location.pathname && u.search === location.search && u.hash) ids.push(decodeURIComponent(u.hash.slice(1))); }
      } catch { /* Invalid fragments are diagnostic candidates only. */ }
      if (control.id) for (const pane of query(['[role="tabpanel"][aria-labelledby]'])) if ((pane.getAttribute('aria-labelledby') || '').split(/\s+/).includes(control.id)) ids.push(pane.id);
      for (const id of ids) {
        const pane = document.getElementById(id);
        // An unselected tab can link an already displayed section, but a hidden pane is never read.
        if (pane && !/^(BODY|HTML)$/.test(pane.tagName) && rendered(pane) && !foreignProduct(pane) && !pane.contains(control) && !pane.querySelector('input[type="password"],textarea,[contenteditable="true"]')) result.push(pane);
      }
    }
    return [...new Set(result)];
  }
  function reviewScopes() {
    const scopes: Element[] = linkedAreas('review');
    for (const tab of query(['[role="tab"][aria-selected="true"]','[aria-selected="true"][aria-controls]'])) {
      if (!displayed(tab) || foreignProduct(tab) || !/^(리뷰|구매평|상품평)/.test(clean((tab as HTMLElement).innerText || ''))) continue;
      const id = tab.getAttribute('aria-controls'), pane = id && document.getElementById(id);
      if (pane && rendered(pane)) scopes.push(pane);
      for (const pane of query(['[role="tabpanel"][aria-labelledby]'])) if (pane.getAttribute('aria-labelledby') === tab.id && rendered(pane)) scopes.push(pane);
    }
    for (const pane of query(['#REVIEW','[data-shp-area="review"]','.sdp-review'])) {
      if (!onScreen(pane)) continue;
      const heading = Array.from(pane.querySelectorAll('h2,h3,[role="heading"]')).some(e => /^(전체\s*)?(리뷰|구매평|상품평)/.test(text(e, 60)));
      const sorting = Array.from(pane.querySelectorAll('button,a,select,[role="button"]')).some(e => onScreen(e) && /최신순|추천순|랭킹순|평점.*순|리뷰\s*정렬/.test(text(e, 60) + (e.getAttribute('aria-label') || '')));
      if (heading && sorting) scopes.push(pane);
    }
    for (const heading of query(['h2','h3','[role="heading"]'])) {
      if (!onScreen(heading) || !/^(전체\s*)?(리뷰|구매평|상품평)(?:\s|\d|\(|$)/.test(text(heading, 60))) continue;
      for (let p = heading.parentElement, depth = 0; p && !/^(BODY|HTML)$/.test(p.tagName) && depth < 4; p = p.parentElement, depth++) {
        const sorting = Array.from(p.querySelectorAll('button,a,select,[role="button"]')).some(e => onScreen(e) && /최신순|추천순|랭킹순|평점.*순|리뷰\s*정렬/.test(text(e, 60) + (e.getAttribute('aria-label') || '')));
        if (sorting) { scopes.push(p); break; }
      }
    }
    return [...new Set(scopes)];
  }
  function productSummary(scope: Element | null) {
    const ratings = new Set<string>(), reviewCounts = new Set<string>();
    const roots = scope ? [scope] : [];
    const nodes = [...roots.flatMap(r => Array.from(r.querySelectorAll('span,strong,p,a,button,dt,dd,div'))), ...query(['[role="tab"]'])];
    for (const e of nodes) {
      const tab = e.getAttribute('role') === 'tab';
      if (!(tab ? displayed(e) : rendered(e)) || foreignProduct(e) || e.closest('[itemprop="review"],article[data-review], [data-review-content]') || e.querySelector('textarea,[contenteditable="true"]')) continue;
      const t = clean(((e as HTMLElement).innerText || '') + ' ' + (e.getAttribute('aria-label') || '')); if (t.length > 160 || /리뷰\s*작성|적립|포인트|혜택/.test(t)) continue;
      const r = t.match(/(?:총\s*)?평점\s*[:：]?\s*([0-5](?:\.\d{1,2})?)(?:\s*점|\s*\/\s*5|\s|$)/);
      const c = t.match(/(?:리뷰|구매평|상품평)(?:\s*수)?\s*[:：(]?\s*(약\s*)?((?:\d{1,3}(?:,\d{3})+|\d+))\s*(?:건|개|\)|$)/);
      if (r && Number(r[1]) <= 5) ratings.add(r[1]);
      if (c) reviewCounts.add(`${c[1] ? '약 ' : ''}${c[2]}건`);
    }
    return { rating: ratings.size === 1 ? [...ratings][0] : '', reviewCount: reviewCounts.size === 1 ? [...reviewCounts][0] : '' };
  }
  type Method = "visible_dom" | "public_metadata" | "manual_selection" | "user_edit" | "unconfirmed";
  type Path = "legacy_selector" | "metadata" | "caption_heading" | "product_region" | "sale_price" | "product_summary" | "review_tab" | "selected_control" | "manual" | "unconfirmed";
  type Confidence = "corroborated" | "candidate" | "user_provided" | "unconfirmed";
  type Asset = { url: string; role: "primary" | "additional" | "detail" | "unclassified"; confidence: Confidence };
  const fields = ["title", "price", "brand", "options", "description", "specifications", "reviews", "rating", "reviewCount", "images"] as const;
  type Field = typeof fields[number];
  function scan() {
    const productKey = key(location.href);
    const canonical = document.head?.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
    const identities = [canonical, meta("og:url")].filter(Boolean).map(key).filter(Boolean);
    const identity = identities.some(k => k !== productKey) ? "mismatch" : identities.some(k => k === productKey) ? "matched" : "no_identity";
    const blocked = accessProblem.test(document.title) || query(['h1', '[role="alert"]']).some(e => onScreen(e) && accessProblem.test(text(e, 160)));
    const usableMeta = !blocked && identity !== "mismatch" && (identity === "matched" || /^product(?::|$)/i.test(meta("og:type")));
    const methods = Object.fromEntries(fields.map(f => [f, "unconfirmed"])) as Record<Field, Method>;
    const evidence = Object.fromEntries(fields.map(f => [f, { path: "unconfirmed" as Path, confidence: "unconfirmed" as Confidence }]));
    const detected = naver && !blocked && identity !== 'mismatch' ? findRegion(usableMeta ? meta('og:title') : '') : { region: null, headingCount: 0, buyCount: 0, ambiguous: false, moneyCount: 0, excludedMoney: 0, ambiguousMoney: false };
    const region = detected.region;
    optionRoot = region?.root || null;
    const set = (f: Field, value: string | string[], method: Method, path: Path = method === 'public_metadata' ? 'metadata' : 'legacy_selector', confidence: Confidence = 'candidate') => { if (Array.isArray(value) ? value.length : value) { methods[f] = method; evidence[f] = { path, confidence }; } return value; };
    let name = region?.name || first(adapter.title, 300);
    const ogTitle = usableMeta ? clean(meta("og:title")).slice(0, 300) : "";
    // Hashed class names need no guessing when a rendered heading matches this page's product metadata.
    if (!name && ogTitle && !generic.test(ogTitle)) name = query(['main h1', 'main h2', 'main h3', '#content h1', '#content h2', '#content h3']).map(e => text(e, 300)).find(t => t.length > 1 && (ogTitle === t || ogTitle.startsWith(t + " : ") || ogTitle.startsWith(t + " - "))) || "";
    const options = readOptions();
    const imageMeta = usableMeta ? meta("og:image") : "";
    const matchingImages = imageMeta ? query(['img']).filter(e => {
      try { const a = new URL(imageMeta, location.href), b = new URL((e as HTMLImageElement).currentSrc || (e as HTMLImageElement).src); return a.hostname === b.hostname && a.pathname === b.pathname; } catch { return false; }
    }) : [];
    let images = dedupImages([...query(adapter.images), ...matchingImages].map(e => imageUrl(e)).filter(Boolean));
    const detailRoots = [...new Set([...query(adapter.details).filter(rendered), ...linkedAreas('detail')])];
    // An explicitly labelled detail tab is also a product scope; no arbitrary body text fallback.
    for (const pane of query(['[role="tabpanel"][aria-labelledby]'])) {
      const label = document.getElementById(pane.getAttribute("aria-labelledby") || "");
      if (label && displayed(label) && areaKind(label) === 'detail' && rendered(pane)) detailRoots.push(pane);
    }
    for (const heading of query(['h2','h3','[role="heading"]'])) {
      if (!/^(상품\s*상세(?:정보|설명)?|상품\s*정보|상세\s*(정보|설명)|제품\s*상세)$/.test(text(heading, 40))) continue;
      const section = heading.closest('section,article,[role="tabpanel"]') || heading.parentElement;
      if (section && !/^(BODY|HTML)$/.test(section.tagName) && section.querySelectorAll('h1,h2,h3').length <= 1) detailRoots.push(section);
    }
    const reviewRoots = reviewScopes();
    const usableImages = query(['img']).filter(e => !!imageUrl(e) && !reviewRoots.some(r => r.contains(e)) && !e.closest('[itemprop="review"],[data-shp-area="review"],.sdp-review') && !foreignProduct(e) && !adLinkedImage(e) && !/로고|쿠폰|배송|혜택|광고|배너|아바타/.test(e.getAttribute('alt') || ''));
    const gallery = [...query(adapter.images), ...matchingImages].filter(e => !detailRoots.some(r => r.contains(e)) && usableImages.includes(e));
    const nearImages = region ? usableImages.filter(e => {
      const a = e.getBoundingClientRect(), b = region.heading.getBoundingClientRect();
      return a.width >= 100 && a.height >= 100 && a.width / a.height < 2.2 && a.height / a.width < 2.2 && !detailRoots.some(r => r.contains(e)) && Math.abs(a.top - b.top) < 450 && Math.abs(a.left - b.left) < 1100;
    }).sort((a, b) => {
      const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
      return br.width * br.height - ar.width * ar.height;
    }) : [];
    const primary = nearImages[0] || gallery[0];
    const assets: Asset[] = [];
    if (primary) assets.push({ url: imageUrl(primary), role: 'primary', confidence: region?.corroborated && (region.root.contains(primary) || matchingImages.includes(primary)) ? 'corroborated' : 'candidate' });
    let galleryRoot = primary?.parentElement || null;
    for (let depth = 0; galleryRoot && galleryRoot.querySelectorAll('img').length < 2 && depth < 6; depth++) {
      const parent = galleryRoot.parentElement;
      if (!parent || /^(BODY|HTML)$/.test(parent.tagName) || (region && parent.contains(region.heading)) || parent.querySelector('h1,h2,h3,h4,[role="heading"],aside,nav,[class*="recommend" i],[class*="related" i]') || [...detailRoots, ...reviewRoots].some(r => parent.contains(r) || r.contains(parent)) || Array.from(parent.querySelectorAll('img')).some(e => foreignProduct(e) || adLinkedImage(e))) break;
      galleryRoot = parent;
    }
    const extras = [...gallery, ...(galleryRoot ? Array.from(galleryRoot.querySelectorAll('img')).filter(e => usableImages.includes(e)) : [])];
    for (const img of extras) if (img !== primary && imageUrl(img)) assets.push({ url: imageUrl(img), role: 'additional', confidence: 'candidate' });
    for (const img of usableImages) if (detailRoots.some(r => r.contains(img))) assets.push({ url: imageUrl(img), role: 'detail', confidence: 'candidate' });
    const seenAssets = new Set<string>();
    const imageAssets = assets.filter(a => { const k = imageKey(a.url); if (seenAssets.has(k)) return false; seenAssets.add(k); return true; }).slice(0, 10);
    images = imageAssets.map(a => a.url);
    const specKeys = /^(브랜드|제조사|모델명|품명|품명 및 모델명|제품명|원산지|제조국|소재|재질|용량|크기|색상|소비전력)$/;
    const specs: string[] = [];
    let brand = first(adapter.brand, 300);
    const tables = query([...adapter.specs, 'table']).slice(0, 100);
    for (const table of tables) {
      const rows = Array.from(table.querySelectorAll('tr')).filter(rendered);
      const hasId = rows.some(row => { const cells = Array.from(row.querySelectorAll('th,td')); return cells.some((c, i) => text(c) === "상품번호" && text(cells[i + 1] || c) === location.pathname.split('/').filter(Boolean).pop()); });
      const scoped = query(adapter.specs).includes(table);
      if (!hasId && !scoped) continue;
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('th,td'));
        for (let i = 0; i < cells.length - 1; i++) {
          const label = text(cells[i], 50), value = text(cells[i + 1], 450);
          if (specKeys.test(label) && value) { specs.push(`${label}: ${value}`); if (label === "브랜드") brand ||= value; }
        }
      }
    }
    // Keep old explicitly scoped attribute rows without reading shipping/returns tables.
    if (coupang) specs.push(...many(['.prod-attr-item']));
    const structuredBodies: string[] = [];
    for (const pane of reviewRoots) for (const card of Array.from(pane.querySelectorAll('article,li,[role="listitem"]')).slice(0, 60)) {
      const dates = Array.from(card.querySelectorAll('time,span')).filter(e => rendered(e) && /^\d{4}[.\/-]\s*\d{1,2}[.\/-]\s*\d{1,2}\.?$/.test(text(e, 30)));
      const rated = Array.from(card.querySelectorAll('[aria-label*="평점"],[itemprop="ratingValue"]')).some(rendered);
      if (!dates.length || !rated) continue;
      for (const p of Array.from(card.querySelectorAll('p')).filter(onScreen)) {
        if (p.closest('[class*="author" i],[class*="nickname" i],[class*="option" i],button,a,time')) continue;
        if (p.querySelector('button,a,input,[role="button"]') || !dates.some(d => !!(d.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING))) continue;
        const value = text(p, 1500);
        if (value.length >= 20 && !/^(옵션|배송안내|리뷰 작성|상품평 운영|구매평을 작성|도움이 되었|이 리뷰가|신고하기|이용약관)/.test(value)) structuredBodies.push(value);
      }
    }
    const reviews = [...new Set([...many(adapter.reviews, true, 30, 1500).filter(t => query(adapter.reviews).some(e => text(e, 1500) === t && reviewRoots.some(r => r.contains(e)))), ...structuredBodies])].filter(t => !/^(등록된 (리뷰|상품평)가 없|리뷰를 작성|상품평을 작성|구매평을 작성|리뷰 작성 안내|상품평 운영)/.test(t)).slice(0, 30);
    const allScreenImages = query(['img']).filter(e => onScreen(e) && (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0);
    const frames = query(['iframe']).filter(onScreen);
    const readableFrames = frames.filter(e => { try { return !!(e as HTMLIFrameElement).contentDocument; } catch { return false; } }).length;
    const structureTag = (e: Element) => /^(DIV|SECTION|ARTICLE|MAIN|UL|OL|LI|FIGURE|PICTURE|A|BUTTON|SPAN|P|H[1-6]|NAV|IMG|BODY|HTML)$/.test(e.tagName) ? e.tagName : 'OTHER';
    const structure = {
      version: 1,
      images: allScreenImages.slice(0, 24).map(img => {
        const ancestors = []; let node: Element | null = img.parentElement;
        for (let depth = 0; node && depth < 7; depth++, node = node.parentElement) ancestors.push({ tag: structureTag(node), images: Math.min(node.querySelectorAll('img').length, 1000), headings: Math.min(node.querySelectorAll('h1,h2,h3,h4,[role="heading"]').length, 1000), detail: detailRoots.some(r => r === node || r.contains(node!)), review: reviewRoots.some(r => r === node || r.contains(node!)) });
        return { supported: !!imageUrl(img), accepted: images.includes(imageUrl(img)), foreign: foreignProduct(img) || adLinkedImage(img), ancestors };
      }),
      controls: query(['a[href]','button','[role="tab"]','[aria-controls]','h1','h2','h3','h4','[role="heading"]']).filter(e => displayed(e) && areaKind(e)).slice(0, 30).map(e => ({ kind: areaKind(e), tag: structureTag(e), selected: e.getAttribute('aria-selected') === 'true', controls: !!e.getAttribute('aria-controls'), fragment: (e.getAttribute('href') || '').includes('#'), onScreen: onScreen(e), ancestorTags: [e.parentElement, e.parentElement?.parentElement, e.parentElement?.parentElement?.parentElement].filter((n): n is HTMLElement => !!n).map(structureTag) })),
    };
    const description = detailRoots.map(e => text(e)).find(Boolean) || "";
    let legacyPrice = '';
    for (const e of query(adapter.price).filter(rendered)) { const p = prices(e.parentElement || e); if (p.value) { legacyPrice = p.value; break; } }
    const priceDom = region?.price.value || legacyPrice;
    const aggregate = productSummary(region?.root || query(naver ? ['[data-shp-area="top"]'] : ['.prod-buy']).find(rendered) || null);
    const amount = usableMeta ? meta("product:price:amount") || meta("og:price:amount") : "";
    const priceMeta = /^\d+(?:\.\d+)?$/.test(amount) ? `${amount}${/^(KRW|원)$/i.test(meta("product:price:currency") || meta("og:price:currency")) ? "원" : " (통화·옵션 확인 필요)"}` : "";
    const diagnostics = {
      structure, automaticAssessmentRecorded: true, collectorVersion: version, platform: naver ? "naver" : "coupang", productId: location.pathname.split('/').filter(Boolean).pop() || "",
      pageState: document.readyState, topFrame: window.top === window, metadataIdentity: identity, blockedPage: blocked,
      counts: { metadataTags: query(['head meta[property^="og:"]', 'head meta[property^="product:"]']).length, titleMatches: query(adapter.title).length, priceMatches: query(adapter.price).length, detailRoots: detailRoots.length, reviewMatches: query(adapter.reviews).length, visibleReviews: reviews.length, visibleImages: allScreenImages.length, productImages: images.length, frames: frames.length, readableFrames, headingCandidates: 0, purchaseControls: 0, productRegions: 0, ambiguousRegions: 0, moneyCandidates: 0, excludedBenefitPrices: 0, ambiguousPrices: 0, supportedVisibleImages: 0, imageHostRejected: 0, imageScopeRejected: 0, primaryImages: 0, additionalImages: 0, detailImages: 0, reviewTabOpen: 0, autoTitle: 0, autoPrice: 0, autoPrimaryImage: 0, rawHeadingElements: 0, visibleCurrencyNodes: 0 },
      fields: [] as { name: Field; method: Method; path: Path; confidence: Confidence }[],
    };
    const data = {
      version: 1, sourceUrl: sourceUrl(), collectedAt: new Date().toISOString(),
      title: set("title", name || (!generic.test(ogTitle) ? ogTitle : ""), name ? "visible_dom" : "public_metadata", region ? "product_region" : name ? "caption_heading" : "metadata", region?.corroborated ? "corroborated" : "candidate") as string,
      price: set("price", priceDom || priceMeta, priceDom ? "visible_dom" : "public_metadata", region ? "sale_price" : priceDom ? "legacy_selector" : "metadata", region?.price.labelled ? "corroborated" : "candidate") as string,
      brand: set("brand", brand || (usableMeta ? clean(meta("product:brand")).slice(0, 300) : ""), brand ? "visible_dom" : "public_metadata") as string, options: set("options", options, "visible_dom", "selected_control", "corroborated") as string[],
      description: set("description", description, "visible_dom") as string,
      specifications: set("specifications", [...new Set(specs)].slice(0, 30), "visible_dom") as string[],
      images: set("images", images, "visible_dom") as string[], reviews: set("reviews", reviews, "visible_dom", "review_tab", "candidate") as string[], rating: set("rating", aggregate.rating || first(naver ? ['[itemprop="aggregateRating"] [itemprop="ratingValue"]'] : adapter.rating, 100), "visible_dom", "product_summary", "candidate") as string,
      reviewCount: set("reviewCount", aggregate.reviewCount, "visible_dom", "product_summary", "candidate") as string,
      imageAssets: [] as Asset[],
      videoPresent: detailRoots.some(r => Array.from(r.querySelectorAll('video,iframe')).some(e => onScreen(e) && (e.tagName === "VIDEO" || /영상|video/i.test(e.getAttribute('title') || "")))),
      scope: "현재 페이지 · 현재 선택 옵션 · 표시된 자료만", diagnostics,
    };
    data.imageAssets = imageAssets;
    if (imageAssets.length) evidence.images = { path: 'product_region', confidence: imageAssets.some(a => a.confidence === 'corroborated') ? 'corroborated' : 'candidate' };
    if (blocked || identity === "mismatch" || window.top !== window) {
      for (const f of fields) { if (Array.isArray(data[f])) (data[f] as string[]) = []; else (data[f] as string) = ""; methods[f] = "unconfirmed"; }
      data.videoPresent = false; data.imageAssets = [];
    }
    diagnostics.fields = fields.map(name => ({ name, method: methods[name], ...(methods[name] === "unconfirmed" ? { path: "unconfirmed" as Path, confidence: "unconfirmed" as Confidence } : evidence[name]) }));
    Object.assign(diagnostics.counts, {
      rawHeadingElements: query(['h1','h2','h3','h4','[role="heading"]']).filter(displayed).length,
      visibleCurrencyNodes: query(['span','strong','p','dd','td']).slice(0, 2000).filter(e => onScreen(e) && money(text(e, 100)).length > 0).length,
      headingCandidates: detected.headingCount, purchaseControls: detected.buyCount, productRegions: region ? 1 : 0, ambiguousRegions: detected.ambiguous ? 1 : 0,
      moneyCandidates: region?.price.count || detected.moneyCount, excludedBenefitPrices: region?.price.excluded || detected.excludedMoney, ambiguousPrices: detected.ambiguousMoney ? 1 : 0,
      supportedVisibleImages: usableImages.length, imageHostRejected: allScreenImages.filter(e => !imageUrl(e)).length, imageScopeRejected: usableImages.filter(e => !data.images.includes(imageUrl(e))).length,
      primaryImages: data.imageAssets.filter(a => a.role === 'primary').length, additionalImages: data.imageAssets.filter(a => a.role === 'additional').length, detailImages: data.imageAssets.filter(a => a.role === 'detail').length,
      reviewTabOpen: reviewRoots.length ? 1 : 0, autoTitle: data.title ? 1 : 0, autoPrice: data.price ? 1 : 0, autoPrimaryImage: data.imageAssets.some(a => a.role === 'primary') ? 1 : 0,
    });
    return data;
  }
  let data = scan();
  let snapshotKey = variantKey();
  let snapshotOptions = readOptions().join('\n');
  let edited = false;
  const host = document.createElement("div"); host.id = "clipforge-product-import"; host.dataset.clipforgeVersion = version;
  host.style.cssText = "position:fixed;inset:20px;z-index:2147483647;background:white;color:black;border:3px solid #333;overflow:auto;padding:20px;font:15px sans-serif;";
  const root = host.attachShadow({ mode: "closed" });
  const heading = document.createElement("h2"); heading.textContent = "ClipForge 상품 가져오기 — 저장 전 확인"; root.append(heading);
  const note = document.createElement("p"); note.textContent = `버전 ${version}. 미확인은 수집 성공이 아닙니다. 먼저 진단을 확인하세요. 리뷰·평점은 옵션 일치 미확인입니다. 개인정보·안내 문구는 제거하세요. 수집은 광고·AI 재사용 허락이 아닙니다. 영상은 존재 여부만 기록합니다.`; root.append(note);
  const diagnosticsBox = document.createElement("div"); diagnosticsBox.setAttribute("role", "status"); root.append(diagnosticsBox);
  const evidence = document.createElement("p"); root.append(evidence);
  const advanced = document.createElement("details"), summary = document.createElement("summary"); summary.textContent = "고급: 자료 파일 내용"; advanced.append(summary);
  const area = document.createElement("textarea"); area.style.cssText = "width:95%;height:220px"; area.dataset.clipforgeSnapshot = "1"; area.setAttribute("aria-label", "확인하고 수정할 상품 자료"); advanced.append(area);
  const labels: [string, Field][] = [["상품명", "title"], ["가격", "price"], ["브랜드", "brand"], ["현재 선택 옵션 (한 줄에 하나)", "options"], ["상세설명", "description"], ["제품 사양 (한 줄에 하나)", "specifications"], ["표시된 구매평 (한 줄에 하나, 개인정보 제거)", "reviews"], ["표시된 평점", "rating"], ["전체 리뷰 수 (구매평 본문 아님)", "reviewCount"]];
  const inputs = new Map<Field, HTMLTextAreaElement>();
  const sourceHints = new Map<Field, HTMLElement>();
  const confidenceNames = { corroborated: "복수 단서 일치 · 확인 필요", candidate: "후보 · 원본 비교 필요", user_provided: "사용자 보완 · 자동 수집 아님", unconfirmed: "미확인" };
  const roleNames = { primary: "대표 이미지", additional: "추가 이미지", detail: "상세페이지 이미지", unclassified: "구분 미확인" };
  const methodNames = { visible_dom: "표시된 상품 영역", public_metadata: "공개 메타데이터 참고 · 옵션 확인 필요", manual_selection: "화면 직접 선택으로 보완", user_edit: "사용자가 직접 수정", unconfirmed: "미확인" };
  const check = document.createElement("input"); check.type = "checkbox";
  const save = document.createElement("button"); save.textContent = "확인한 자료 파일 저장"; save.disabled = true;
  const invalidate = () => { edited = true; check.checked = false; save.disabled = true; };
  const syncArea = () => { area.value = JSON.stringify(data, null, 2); };
  for (const [name, f] of labels) {
    const label = document.createElement("label"), input = document.createElement("textarea"); inputs.set(f, input);
    input.placeholder = "미확인 — 진단을 확인하거나 직접 보완하세요"; input.setAttribute("aria-label", name); input.style.cssText = "display:block;width:95%;min-height:45px;margin-bottom:10px";
    const hint = document.createElement('small'); sourceHints.set(f, hint);
    input.oninput = () => { const value = Array.isArray(data[f]) ? input.value.split('\n').filter(Boolean) : input.value; Object.assign(data, { [f]: value }); Object.assign(data.diagnostics.fields.find(item => item.name === f)!, { method: "user_edit", path: "manual", confidence: "user_provided" }); hint.textContent = methodNames.user_edit; invalidate(); syncArea(); };
    label.append(name, hint, input); root.append(label);
  }
  const gallery = document.createElement("div"); root.append(gallery);
  const selected = new Set<string>();
  const diagnosticText = () => {
    const d = data.diagnostics, c = d.counts;
    const lines = [`진단 ${d.collectorVersion} · ${naver ? "네이버" : "쿠팡"} 상품 ${d.productId}`, `문서: ${d.pageState} / 최상위 탭: ${d.topFrame ? "예" : "아니요"} / 메타 상품 주소: ${d.metadataIdentity}`, `기존 상품명 영역 ${c.titleMatches}, 가격 영역 ${c.priceMatches}, 상세 영역 ${c.detailRoots}, 리뷰 후보 ${c.reviewMatches}`, `화면에 로드된 이미지 ${c.visibleImages}, 상품 이미지 ${data.images.length}, 표시된 구매평 ${data.reviews.length}, iframe ${c.frames} (DOM 접근 가능 ${c.readableFrames})`];
    if (d.blockedPage) lines.push("접근 제한·보안 확인·오류 화면일 가능성이 있습니다. 우회하지 말고 정상 상품 페이지에서만 실행하세요. 문구 감지 결과이며 차단을 확정한 것은 아닙니다.");
    if (d.metadataIdentity === "mismatch") lines.push("주소와 메타데이터의 상품이 다릅니다. 페이지 전환 중일 수 있습니다. 로딩 후 다시 읽거나 탭을 직접 새로고침하세요.");
    if (d.pageState !== "complete") lines.push("문서 로딩이 끝나지 않았습니다. 로딩이 끝난 후 '현재 페이지 다시 읽기'를 누르세요.");
    lines.push("문서 complete도 동적 상품 영역의 준비 완료를 보장하지 않습니다. 상품이 보인 후 다시 읽으세요.");
    lines.push(`자동 추출 당시(직접 선택 제외): 상품명 ${c.autoTitle ? '찾음' : '미확인'}, 가격 ${c.autoPrice ? '찾음' : '미확인'}, 대표 이미지 ${c.autoPrimaryImage ? '찾음' : '미확인'}`);
    lines.push(`표시 제목 요소 ${c.rawHeadingElements}, 통화 표시 요소 ${c.visibleCurrencyNodes}. 제목 후보 ${c.headingCandidates}, 구매 버튼 ${c.purchaseControls}, 상품 영역 ${c.productRegions}, 영역 충돌 ${c.ambiguousRegions}, 판매가 후보 ${c.moneyCandidates}, 혜택 금액 제외 ${c.excludedBenefitPrices}`);
    lines.push(`구조 진단: 이미지 조상 ${d.structure.images.length}개 / 상세·리뷰 표지 ${d.structure.controls.length}개. 텍스트·클래스명·주소·작성자 정보는 저장하지 않습니다.`);
    lines.push(`대표 ${c.primaryImages} / 추가 ${c.additionalImages} / 상세 ${c.detailImages}, 이미지 호스트 제외 ${c.imageHostRejected} / 상품 범위 제외 ${c.imageScopeRejected}. 리뷰 탭 ${c.reviewTabOpen ? '열림 단서 있음' : '열림 미확인'}. 리뷰 수와 본문 수는 별개입니다.`);
    if (c.ambiguousRegions || c.ambiguousPrices) lines.push('여러 상품 영역 또는 판매가 후보가 충돌해 자동 확정하지 않았습니다. 단일 상품 화면과 진단을 확인하세요.');
    if (!data.title && !data.price) lines.push("상품명·가격 영역을 찾지 못했습니다. 상품 영역 단서가 부족하거나 구조/렌더링이 다를 수 있습니다. 자동 결과는 미확인입니다. 진단 파일로 자동 탐색 실패를 확인하세요. 직접 선택은 보조 수단이며 자동 성공이 아닙니다.");
    if (!data.description) lines.push("상세정보를 직접 펼친 뒤 다시 읽으세요. 설명이 이미지로만 제공되면 텍스트는 자동 추출하지 않습니다. 펼쳤는데도 상세 영역이 0이면 구조 진단 파일을 전달해 주세요.");
    if (!data.images.length) lines.push("현재 화면의 상품 이미지가 없거나 아직 로드되지 않았거나 이미지 영역·호스트가 미지원입니다. 이미지를 화면에 보이게 한 뒤 다시 읽거나 '화면 이미지 직접 선택'을 이용하세요.");
    if (!data.reviews.length) lines.push("구매평 본문을 찾지 못했습니다. 구매평 탭을 열고 본문이 화면에 보이게 하세요. 별도 영역 구조라면 아래 글자 직접 선택을 이용하세요. 실제 구매 인증 여부는 확인하지 않습니다.");
    if (c.frames) lines.push("iframe이 보입니다. 다른 출처이거나 로딩 중인 iframe 내부는 읽지 않습니다. iframe 존재가 상품 정보가 그 안에 있다는 증거는 아닙니다.");
    lines.push("항목의 복수 단서 일치도 플랫폼 검증 완료가 아닙니다. 공개 메타데이터는 상품명·가격 참고 후보입니다. 선택 옵션·현재 표시 가격과 직접 비교하세요. 숨겨진 상태나 비공개 API는 읽지 않습니다.");
    return lines.join('\n');
  };
  const paint = () => {
    for (const [f, input] of inputs) { input.value = Array.isArray(data[f]) ? (data[f] as string[]).join('\n') : String(data[f]); const entry = data.diagnostics.fields.find(item => item.name === f)!; sourceHints.get(f)!.textContent = ' · ' + methodNames[entry.method] + ' · ' + confidenceNames[entry.confidence]; }
    const prior = new Set(selected), shown = new Set(Array.from(gallery.querySelectorAll('img')).map(e => e.src));
    gallery.replaceChildren(); selected.clear();
    for (const url of data.images) {
      const keep = !shown.has(url) || prior.has(url);
      if (keep) selected.add(url); const label = document.createElement("label"), box = document.createElement("input"), image = document.createElement("img");
      box.type = "checkbox"; box.checked = keep; box.onchange = () => { if (box.checked) selected.add(url); else selected.delete(url); invalidate(); };
      image.src = url; image.referrerPolicy = "no-referrer"; image.style.cssText = "width:100px;height:100px;object-fit:contain"; image.alt = "가져올 이미지 선택"; const badge = document.createElement('p'); const asset = data.imageAssets.find(a => a.url === url); badge.textContent = `${roleNames[asset?.role || 'unclassified']} · ${confidenceNames[asset?.confidence || 'unconfirmed']} · 옵션 일치 미확인`; label.append(box, image, badge); gallery.append(label);
    }
    diagnosticsBox.style.whiteSpace = "pre-wrap"; diagnosticsBox.textContent = diagnosticText();
    evidence.textContent = `출처: ${data.sourceUrl} / 수집: ${data.collectedAt} / 영상: ${data.videoPresent ? "요소 있음 · 접근·사용 권한 미확인" : "미확인"}`;
    syncArea(); check.checked = false; save.disabled = true;
  };
  const download = (value: unknown, name: string) => { const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); };
  const reRead = document.createElement('button'); reRead.textContent = "현재 페이지 다시 읽기";
  reRead.onclick = () => { if (edited && !confirm("수정한 입력값을 새 수집 결과로 바꿀까요? 유지하려면 취소하세요.")) return; data = scan(); snapshotKey = variantKey(); snapshotOptions = readOptions().join('\n'); edited = false; paint(); };
  const exportDiagnostic = document.createElement('button'); exportDiagnostic.textContent = "개인정보 없는 진단 파일 저장";
  exportDiagnostic.onclick = () => download(data.diagnostics, "clipforge-diagnostic.json");
  root.append(reRead, exportDiagnostic);
  // User-selected visible text is the fallback for changing/hashed DOM classes. Do not force selection or override copying restrictions.
  const picker = document.createElement('div'); picker.style.cssText = "position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:white;color:black;padding:12px;border:3px solid #333";
  const target = document.createElement('select'); target.setAttribute('aria-label', '직접 선택할 항목');
  for (const [name, f] of labels) { const option = document.createElement('option'); option.value = f; option.textContent = name; target.append(option); }
  const hint = document.createElement('p'); hint.textContent = "상품 글자만 마우스로 드래그해 선택하고 적용하세요. 구매평은 작성자·안내 없이 본문 하나만 선택하세요. Esc로 돌아갑니다.";
  const apply = document.createElement('button'); apply.textContent = "선택한 글자 적용";
  const back = document.createElement('button'); back.textContent = "확인창으로 돌아가기";
  picker.append(hint, target, apply, back); root.append(picker); picker.hidden = true;
  let imageMode = false;
  const validPage = () => { if (snapshotKey === variantKey() && snapshotOptions === readOptions().join('\n')) return true; alert("상품 또는 옵션 주소가 바뀌었습니다. 또는 표시된 선택 옵션이 변경됐습니다. 확인창에서 현재 페이지를 다시 읽으세요. 이전 상품과 섞지 않습니다."); return false; };
  const endPick = () => { imageMode = false; picker.hidden = true; for (const e of Array.from(root.children)) if (e !== picker) (e as HTMLElement).hidden = false; host.style.cssText = "position:fixed;inset:20px;z-index:2147483647;background:white;color:black;border:3px solid #333;overflow:auto;padding:20px;font:15px sans-serif;"; document.removeEventListener('click', imageClick, true); document.removeEventListener('keydown', escape); };
  const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') endPick(); };
  const begin = (images: boolean) => { imageMode = images; for (const e of Array.from(root.children)) (e as HTMLElement).hidden = e !== picker; picker.hidden = false; hint.textContent = images ? "화면에 로드된 상품 사진을 직접 클릭하세요. 다른 사진·리뷰 사진은 선택하지 마세요. Esc로 취소합니다." : "상품 글자만 드래그해 선택하고 적용하세요. 구매평은 작성자·안내 없이 본문 하나만 선택하세요. Esc로 돌아갑니다."; target.hidden = images; apply.hidden = images; host.style.cssText = "position:fixed;bottom:0;left:0;right:0;height:130px;z-index:2147483647;background:white;color:black;border:3px solid #333;padding:8px;font:15px sans-serif;"; document.addEventListener('keydown', escape); if (images) document.addEventListener('click', imageClick, true); };
  const imageClick = (event: MouseEvent) => {
    if (!imageMode || event.composedPath().includes(host) || !(event.target instanceof Element)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (!validPage()) return;
    const url = imageUrl(event.target);
    if (!url) { alert("화면에 로드된 지원 상품 이미지가 아닙니다. 배경 이미지·iframe·미지원 호스트는 직접 파일 업로드를 이용하세요."); return; }
    if (data.images.length >= 10) { alert("이미지는 최대 10장입니다. 확인창에서 정리해 주세요."); return; }
    data.images = dedupImages([...data.images, url]); if (!data.imageAssets.some(a => a.url === url)) data.imageAssets.push({ url, role: "unclassified", confidence: "user_provided" }); Object.assign(data.diagnostics.fields.find(f => f.name === 'images')!, { method: "manual_selection", path: "manual", confidence: "user_provided" }); endPick(); invalidate(); paint();
  };
  // Preserve the page selection while this button receives a pointer click.
  apply.onmousedown = event => event.preventDefault();
  apply.onclick = () => {
    if (!validPage()) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount !== 1) { alert("상품 글자를 먼저 마우스로 선택해 주세요."); return; }
    const range = selection.getRangeAt(0), node = range.commonAncestorContainer, element = node.nodeType === 1 ? node as Element : node.parentElement;
    if (!element || element.getRootNode() !== document || /^(BODY|HTML)$/.test(element.tagName) || !onScreen(element) || element.closest('iframe,input,textarea,[contenteditable="true"]')) { alert("현재 상품 화면의 글자 영역 하나만 선택해 주세요. 전체 페이지·입력창·iframe은 가져오지 않습니다."); return; }
    const value = clean(selection.toString()); const f = target.value as Field;
    if (!value || value.length > (f === 'description' ? 4000 : f === 'reviews' ? 1500 : 500)) { alert("선택한 글자가 없거나 너무 깁니다. 필요한 본문 하나만 선택하세요."); return; }
    Object.assign(data, { [f]: Array.isArray(data[f]) ? [...new Set([...(data[f] as string[]), value])].slice(0, 30) : value });
    Object.assign(data.diagnostics.fields.find(item => item.name === f)!, { method: "manual_selection", path: "manual", confidence: "user_provided" }); endPick(); invalidate(); paint();
  };
  back.onclick = endPick;
  const pickText = document.createElement('button'); pickText.textContent = "화면 글자 직접 선택"; pickText.onclick = () => begin(false);
  const pickImage = document.createElement('button'); pickImage.textContent = "화면 이미지 직접 선택"; pickImage.onclick = () => begin(true);
  root.append(pickText, pickImage, advanced);
  const confirmation = document.createElement('label'); confirmation.append(check, "자료 확인 및 개인정보 제거를 완료했습니다."); root.append(confirmation);
  check.onchange = () => { save.disabled = !check.checked; };
  area.oninput = () => invalidate();
  save.onclick = () => {
    if (!validPage()) return;
    try {
      const raw = JSON.parse(area.value), limits = { title: 300, price: 100, brand: 300, options: 500, description: 4000, specifications: 500, reviews: 1500, rating: 100, reviewCount: 100, images: 2000 };
      const value = { imageAssets: data.imageAssets.filter(a => selected.has(a.url)), version: 1, sourceUrl: data.sourceUrl, collectedAt: data.collectedAt, scope: data.scope, videoPresent: data.videoPresent, diagnostics: data.diagnostics, images: Array.from(selected) };
      for (const f of fields.filter(f => f !== 'images')) {
        const incoming = raw[f];
        if (JSON.stringify(incoming) !== JSON.stringify(data[f])) Object.assign(data.diagnostics.fields.find(item => item.name === f)!, { method: 'user_edit', path: 'manual', confidence: 'user_provided' });
        Object.assign(value, { [f]: Array.isArray(data[f]) ? [...new Set((Array.isArray(incoming) ? incoming : []).filter(v => typeof v === 'string').slice(0, 30).map(v => clean(v).slice(0, limits[f])))].filter(Boolean) : typeof incoming === 'string' ? clean(incoming).slice(0, limits[f]) : '' });
      }
      download(value, "clipforge-product.json");
    }
    catch { alert("자료 형식이 잘못되었습니다. JSON 내용을 확인해 주세요."); }
  };
  const close = document.createElement('button'); close.textContent = "닫기"; close.onclick = () => { endPick(); host.remove(); }; root.append(save, close);
  const controls = document.createElement('div'); controls.append(reRead, pickText, pickImage, exportDiagnostic); root.insertBefore(controls, evidence);
  paint(); document.documentElement.append(host);
}

export function productBookmarklet(): string {
  return `javascript:void(${encodeURIComponent(`(${collectRenderedProductPage.toString()})()`)})`;
}
