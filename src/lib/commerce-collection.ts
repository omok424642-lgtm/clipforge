import { createHmac } from "crypto";
import { assertPublicUrl } from "./ssrf-guard";
import { extractJsonLdProduct, parseProductFromHtml } from "./product-ingest";
import { allowedCommerceImage, classifyCommerceLink, cleanProductText, sameCommerceProduct, type CommerceLink, type CommerceProductDraft } from "./commerce-product";

const UA = "ClipForgeProductImport/1.0";
const MAX_HTML = 3 * 1024 * 1024;
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export interface CollectionConfig {
  naverPolicyReviewed?: boolean;
  coupangPolicyReviewed?: boolean;
  publicMetadataReviewed?: boolean;
  naverClientId?: string;
  naverClientSecret?: string;
  coupangAccessKey?: string;
  coupangSecretKey?: string;
}
export function collectionConfig(): CollectionConfig {
  return {
    naverPolicyReviewed: process.env.NAVER_PRODUCT_API_TERMS_REVIEWED === "1",
    coupangPolicyReviewed: process.env.COUPANG_PRODUCT_API_TERMS_REVIEWED === "1",
    publicMetadataReviewed: process.env.COMMERCE_PUBLIC_METADATA_TERMS_REVIEWED === "1",
    naverClientId: process.env.NAVER_CLIENT_ID, naverClientSecret: process.env.NAVER_CLIENT_SECRET,
    coupangAccessKey: process.env.COUPANG_ACCESS_KEY, coupangSecretKey: process.env.COUPANG_SECRET_KEY,
  };
}

/** Bounded reads, including chunked responses; abort before buffering an oversized body. */
export async function readBounded(res: Response, max: number): Promise<Uint8Array> {
  if (Number(res.headers.get("content-length")) > max) { await res.body?.cancel(); throw new Error("응답 크기 제한을 초과했습니다."); }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("빈 응답입니다.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > max) throw new Error("응답 크기 제한을 초과했습니다.");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const result = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

/** Never follows redirects with credentials. All destinations must be public. */
export const publicRequest: Fetcher = async (url, init = {}) => {
  await assertPublicUrl(url);
  return fetch(url, { ...init, redirect: "manual", signal: init.signal ?? AbortSignal.timeout(12000), cache: "no-store" });
};

/** Conservative robots handling: matching Disallow in any group denies access. Unknown policy denies access. */
export function robotsPermit(text: string, path: string): boolean {
  if (!text.trim() || /<html/i.test(text)) return false;
  return !text.split(/\r?\n/).some((line) => {
    const rule = line.replace(/#.*$/, "").match(/^\s*Disallow:\s*(\S+)/i)?.[1];
    if (!rule) return false;
    const pattern = rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$");
    return new RegExp(`^${pattern}`).test(path);
  });
}

async function robotsCheck(url: string, request: Fetcher) {
  const u = new URL(url);
  const res = await request(`${u.origin}/robots.txt`, { headers: { "User-Agent": UA } });
  // A verified 404 means there are no published robots rules; other failures are not permission.
  if (res.status === 404) return;
  if (!res.ok || !robotsPermit(new TextDecoder().decode(await readBounded(res, 256 * 1024)), u.pathname + u.search)) {
    throw new Error("자동 접근 정책을 확인할 수 없거나 robots 정책이 수집을 제한합니다. 직접 입력해 주세요.");
  }
}

async function resolveAndRead(link: CommerceLink, request: Fetcher): Promise<{ url: string; html: string }> {
  let current = link.originalUrl;
  for (let hop = 0; hop <= 4; hop++) {
    const nextLink = classifyCommerceLink(current);
    if (nextLink.platform !== link.platform) throw new Error("다른 플랫폼으로 이동하는 링크는 자동 수집하지 않습니다.");
    await robotsCheck(current, request);
    const res = await request(current, { headers: { "User-Agent": UA, Accept: "text/html" } });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("이동할 상품 주소가 없습니다.");
      await res.body?.cancel();
      current = new URL(location, current).href; continue;
    }
    if (!res.ok) throw new Error(`상품 페이지 접근 제한 또는 오류(HTTP ${res.status}). 재시도 우회 없이 직접 입력으로 전환합니다.`);
    if (!/text\/html|application\/xhtml/i.test(res.headers.get("content-type") || "")) throw new Error("상품 HTML 페이지가 아닙니다.");
    if (!nextLink.productId) throw new Error("제휴 링크의 실제 상품 주소를 확인하지 못했습니다. 상품 주소를 별도로 입력해 주세요.");
    const html = new TextDecoder().decode(await readBounded(res, MAX_HTML));
    if (/captcha|access denied|robot verification|비정상적인 접근|접근이 제한|로그인이 필요/i.test(html)) throw new Error("인증·접근 제한 페이지입니다. 제한을 우회하지 않고 직접 입력으로 전환합니다.");
    return { url: current, html };
  }
  throw new Error("링크 이동 횟수가 많습니다. 실제 상품 주소를 직접 입력해 주세요.");
}

function imageUrls(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((v): v is string => typeof v === "string" && /^https:\/\//.test(v)))].slice(0, 10);
}
function applyPublicMetadata(draft: CommerceProductDraft, html: string, url: string) {
  const parsed = parseProductFromHtml(html, url);
  const node = extractJsonLdProduct(html);
  // OG/title alone can describe a login/error page. Require a Product node or explicit product OG type.
  if (!node && !/<meta[^>]+(?:property|name)=["']og:type["'][^>]+content=["'](?:product|product\.item)["']/i.test(html)) throw new Error("상품 페이지임을 확인할 표준 정보가 부족합니다. 직접 확인해 주세요.");
  draft.title = cleanProductText(parsed.title, 300);
  draft.price = cleanProductText(parsed.priceText, 100);
  draft.description = cleanProductText(parsed.description);
  // Attributes are source claims, never AI-inferred benefits. Description is not promoted to verified facts.
  const properties = node?.additionalProperty;
  if (Array.isArray(properties)) draft.features = properties.slice(0, 30).flatMap((p: { name?: unknown; value?: unknown }) => {
    const name = cleanProductText(p?.name, 100), value = cleanProductText(p?.value, 300);
    return name && value ? [`${name}: ${value}`] : [];
  });
  const variants = node?.hasVariant;
  if (Array.isArray(variants)) draft.options = variants.slice(0, 30).map((p: { name?: unknown }) => cleanProductText(p?.name, 300)).filter(Boolean);
  draft.images = imageUrls(parsed.images).filter((image) => allowedCommerceImage(image, draft.link.platform)).map((image) => ({ url: image, sourceUrl: url, provenance: "public_metadata" }));
  draft.method = "public_metadata";
  draft.resolvedUrl = url;
}

/** Separate official API adapters. Search hits are accepted ONLY after exact product/variant matching. */
export async function collectNaver(draft: CommerceProductDraft, _keyword: string, _config: CollectionConfig, _request: Fetcher) {
  void _keyword; void _config; void _request;
  // Shopping search ended 2026-07-31. Retain the call signature only for saved integrations.
  draft.warnings.push("네이버 쇼핑 검색 API는 종료되어 사용할 수 없습니다. 브라우저에서 확인한 자료 또는 직접 입력을 이용해 주세요.");
}

export function coupangAuthorization(path: string, query: string, access: string, secret: string, now = new Date()): string {
  const datetime = now.toISOString().slice(2, 19).replace(/[-:]/g, "") + "Z";
  const signature = createHmac("sha256", secret).update(datetime + "GET" + path + query).digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${access}, signed-date=${datetime}, signature=${signature}`;
}
export async function collectCoupang(draft: CommerceProductDraft, keyword: string, config: CollectionConfig, request: Fetcher) {
  if (!config.coupangPolicyReviewed || !config.coupangAccessKey || !config.coupangSecretKey || !keyword) {
    draft.warnings.push("쿠팡 파트너스 API는 이용 조건 검토·승인된 서버 인증 정보·상품 검색어가 필요합니다. 판매자용 Open API를 임의의 전체 상품 조회 용도로 사용하지 않습니다."); return;
  }
  const path = "/v2/providers/affiliate_open_api/apis/openapi/products/search";
  const query = new URLSearchParams({ keyword, limit: "10" }).toString();
  const res = await request(`https://api-gateway.coupang.com${path}?${query}`, { headers: { Authorization: coupangAuthorization(path, query, config.coupangAccessKey, config.coupangSecretKey) } });
  if (!res.ok) throw new Error(`쿠팡 공식 API 응답 오류(HTTP ${res.status}).`);
  const data = JSON.parse(new TextDecoder().decode(await readBounded(res, MAX_HTML)));
  if (data.rCode !== "0") throw new Error("쿠팡 공식 API가 상품 조회를 승인하지 않았습니다.");
  const expected = draft.resolvedUrl ? classifyCommerceLink(draft.resolvedUrl) : draft.link;
  const matches = Array.isArray(data.data?.productData) ? data.data.productData.filter((p: { productId?: unknown; productUrl?: string }) => String(p.productId) === expected.productId && typeof p.productUrl === "string" && sameCommerceProduct(expected, p.productUrl)) : [];
  if (matches.length !== 1) { draft.warnings.push("검색 결과에서 동일 상품·선택 옵션을 유일하게 확인하지 못했습니다. 유사 상품이나 다른 옵션을 대신 사용하지 않습니다."); return; }
  const item = matches[0];
  draft.title = cleanProductText(item.productName, 300);
  draft.price = Number(item.productPrice) > 0 && Number.isFinite(Number(item.productPrice)) ? `₩${item.productPrice}` : "";
  draft.images = imageUrls([item.productImage]).filter((url) => allowedCommerceImage(url, "coupang")).map((url) => ({ url, sourceUrl: item.productUrl, provenance: "coupang_partners_api" }));
  draft.method = "coupang_partners_api"; draft.resolvedUrl = item.productUrl;
  draft.warnings.push("API 조회 가격입니다. 옵션·회원가·쿠폰·배송비·상품 특징은 판매 페이지에서 확인해 주세요.");
}

export async function collectCommerceProduct(draft: CommerceProductDraft, keyword: string, config = collectionConfig(), request = publicRequest) {
  if (config.publicMetadataReviewed) {
    try { const page = await resolveAndRead(draft.resolvedUrl ? classifyCommerceLink(draft.resolvedUrl) : draft.link, request); applyPublicMetadata(draft, page.html, page.url); }
    catch (e) { draft.warnings.push(e instanceof Error ? e.message : "상품 페이지를 수집하지 못했습니다."); }
  } else draft.warnings.push("공개 페이지 자동 수집은 플랫폼 이용 조건 확인 전까지 비활성화되어 있습니다. 로그인·CAPTCHA·차단을 우회하지 않습니다.");
  try {
    if (draft.link.platform === "naver") await collectNaver(draft, keyword, config, request);
    else await collectCoupang(draft, keyword, config, request);
  } catch { draft.warnings.push("공식 API 접근 또는 응답 처리에 실패했습니다. 인증 정보는 표시하지 않으며 직접 입력으로 보완할 수 있습니다."); }
  draft.status = draft.title || draft.images.length ? "needs_review" : "needs_input";
  draft.warnings.push("수집된 정보는 판매자·API의 표시 내용이며 검증된 효능을 뜻하지 않습니다. 이미지 다운로드 가능 여부와 영상 사용 권한은 별도입니다.");
  return draft;
}
