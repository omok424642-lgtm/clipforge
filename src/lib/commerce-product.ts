/** Shared, client-safe contract for reviewed Korean commerce imports. No video side effects. */
export type CommercePlatform = "naver" | "coupang";
export type CollectionMethod = "naver_search_api" | "coupang_partners_api" | "public_metadata" | "manual" | "browser_page";
export interface CommerceLink {
  platform: CommercePlatform;
  originalUrl: string;
  kind: "product" | "affiliate_or_share";
  productId?: string;
  itemId?: string;
  vendorItemId?: string;
}
export interface CommerceImage {
  url: string;
  sourceUrl: string;
  /** Preserve browser-image role attribution after the retained URL becomes local. */
  originImageUrl?: string;
  provenance: CollectionMethod | "user";
}
export interface CommerceProductDraft {
  id: string;
  link: CommerceLink;
  resolvedUrl?: string;
  collectedAt: string;
  method: CollectionMethod;
  status: "needs_input" | "needs_review" | "reviewed";
  title: string;
  price: string;
  options: string[];
  features: string[];
  description: string;
  images: CommerceImage[];
  warnings: string[];
  /** Immutable single-page source; user edits live in the reviewed product fields. No media license is implied. */
  browserMaterials?: import("./browser-product").BrowserProductMaterials;
  disclosure: { enabled: boolean; text: string; placement: "video_overlay" };
  review?: {
    confirmedAt: string;
    factsConfirmed: boolean;
    imageRightsConfirmed: boolean;
    editedFields: string[];
    selectedImages: string[];
  };
}

export const NAVER_DISCLOSURE = "이 콘텐츠에는 네이버 쇼핑커넥트 제휴 링크가 포함되어 있으며, 구매 시 수수료를 받을 수 있습니다.";
export const COUPANG_DISCLOSURE = "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";

/** Exact host/path checks: no substring matching, arbitrary ports, credentials or HTTP. */
export function classifyCommerceLink(raw: string): CommerceLink {
  const originalUrl = raw.trim();
  if (originalUrl.length > 4096) throw new Error("링크가 너무 깁니다.");
  let u: URL;
  try { u = new URL(originalUrl); } catch { throw new Error("올바른 상품 링크를 입력해 주세요."); }
  if (u.protocol !== "https:" || u.username || u.password || u.port) throw new Error("로그인 정보나 별도 포트가 없는 HTTPS 링크만 지원합니다.");
  const h = u.hostname.toLowerCase();
  const naverProduct = ["smartstore.naver.com", "m.smartstore.naver.com", "brand.naver.com"].includes(h)
    ? u.pathname.match(/^\/[^/]+\/products\/(\d+)\/?$/)?.[1] : undefined;
  if (naverProduct) return { platform: "naver", originalUrl, kind: "product", productId: naverProduct };
  if (["naver.me", "shoppingconnect.naver.com", "brandconnect.naver.com", "link.naver.com"].includes(h) && u.pathname !== "/") {
    return { platform: "naver", originalUrl, kind: "affiliate_or_share" };
  }
  const coupangProduct = ["www.coupang.com", "coupang.com", "m.coupang.com"].includes(h)
    ? u.pathname.match(/^\/(?:vp\/products|vm\/products)\/(\d+)\/?$/)?.[1] : undefined;
  if (coupangProduct) return {
    platform: "coupang", originalUrl, kind: u.searchParams.has("lptag") || u.searchParams.has("coupangSource") ? "affiliate_or_share" : "product",
    productId: coupangProduct, itemId: u.searchParams.get("itemId") || undefined, vendorItemId: u.searchParams.get("vendorItemId") || undefined,
  };
  if (h === "link.coupang.com" && /^\/a\/[^/]+\/?$/.test(u.pathname)) return { platform: "coupang", originalUrl, kind: "affiliate_or_share" };
  throw new Error("네이버 스마트스토어·쇼핑커넥트 또는 쿠팡 상품·제휴 링크를 입력해 주세요.");
}

export function sameCommerceProduct(expected: CommerceLink, candidate: string): boolean {
  try {
    const actual = classifyCommerceLink(candidate);
    if (!expected.productId || expected.platform !== actual.platform || expected.productId !== actual.productId) return false;
    if (expected.platform === "naver") {
      const a = new URL(expected.originalUrl), b = new URL(candidate);
      return a.hostname.replace(/^m\./, "") === b.hostname.replace(/^m\./, "") && a.pathname.split("/")[1] === b.pathname.split("/")[1];
    }
    return (!expected.itemId || expected.itemId === actual.itemId) && (!expected.vendorItemId || expected.vendorItemId === actual.vendorItemId);
  } catch { return false; }
}

export function cleanProductText(value: unknown, max = 4000): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Report gaps rather than inventing product facts, options or permission to use images. */
export function missingCommerceFields(draft: Pick<CommerceProductDraft, "title" | "price" | "options" | "features" | "images">): string[] {
  return [!draft.title.trim() && "상품명", !draft.price.trim() && "가격", !draft.options.some((x) => x.trim()) && "옵션(없으면 ‘옵션 없음’ 입력)", !draft.features.some((x) => x.trim()) && "확인 가능한 상품 특징", !draft.images.length && "사용할 이미지"].filter((x): x is string => !!x);
}

export function allowedCommerceImage(url: string, platform: CommercePlatform) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
    return platform === "naver"
      ? /^(?:shopping-phinf|shop-phinf)\.pstatic\.net$/.test(u.hostname)
      : /^(?:image|thumbnail(?:\d+)?)\.coupangcdn\.com$/.test(u.hostname);
  } catch { return false; }
}
