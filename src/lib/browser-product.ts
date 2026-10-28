import { allowedCommerceImage, classifyCommerceLink, cleanProductText } from "./commerce-product";

/** A single rendered-page observation, never an authenticated API response. */
export interface BrowserProductMaterials {
  version: 1;
  sourceUrl: string;
  collectedAt: string;
  title: string;
  price: string;
  brand: string;
  options: string[];
  description: string;
  specifications: string[];
  images: string[];
  reviews: string[];
  rating: string;
  videoPresent: boolean;
  scope: "현재 페이지 · 현재 선택 옵션 · 표시된 자료만";
  reviewOptionMatch: "unconfirmed";
  rights: { commercialReuse: "unconfirmed"; aiUse: "unconfirmed"; videoDownload: "unconfirmed"; videoEditing: "unconfirmed" };
}

export function redactProductPersonalData(value: string): string {
  return value.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[이메일 제외]")
    .replace(/(?:\+82[- .]?)?0?1[016789][- .]?\d{3,4}[- .]?\d{4}/g, "[전화번호 제외]");
}

/** Explicit allowlist discards author IDs, cookies, scripts and unknown properties. */
export function parseBrowserProduct(input: unknown): BrowserProductMaterials {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("상품 자료 파일 형식이 올바르지 않습니다.");
  const b = input as Record<string, unknown>;
  if (b.version !== 1 || typeof b.sourceUrl !== "string") throw new Error("지원하지 않는 상품 자료 버전입니다.");
  const link = classifyCommerceLink(b.sourceUrl);
  const pageUrl = new URL(link.originalUrl);
  if (pageUrl.hash || [...pageUrl.searchParams.keys()].some(k => /token|auth|session|password|credential|signature/i.test(k))) throw new Error("인증 정보가 포함될 수 있는 주소는 가져올 수 없습니다. 상품 주소만 입력해 주세요.");
  if (!link.productId) throw new Error("제휴 링크의 도착 상품 페이지에서 다시 가져와 주세요.");
  if (typeof b.collectedAt !== "string" || !Number.isFinite(Date.parse(b.collectedAt)) || Date.parse(b.collectedAt) > Date.now() + 300000) throw new Error("수집 날짜를 확인해 주세요.");
  const t = (key: string, max = 500) => redactProductPersonalData(cleanProductText(b[key], max));
  const list = (key: string, max: number, length: number) => {
    if (!Array.isArray(b[key])) return [];
    return [...new Set((b[key] as unknown[]).slice(0, max).map(v => redactProductPersonalData(cleanProductText(v, length))).filter(Boolean))];
  };
  const images = Array.isArray(b.images) ? [...new Set(b.images.filter((v): v is string => {
    if (typeof v !== "string" || v.length > 2000 || !allowedCommerceImage(v, link.platform)) return false;
    const u = new URL(v);
    return !u.hash && ![...u.searchParams.keys()].some(k => /token|auth|session|password|credential|signature/i.test(k));
  }))].slice(0, 10) : [];
  return { version: 1, sourceUrl: link.originalUrl, collectedAt: new Date(b.collectedAt).toISOString(), title: t("title", 300), price: t("price", 100), brand: t("brand", 300), options: list("options", 30, 500), description: t("description", 4000), specifications: list("specifications", 30, 500), images, reviews: list("reviews", 30, 1500), rating: t("rating", 100), videoPresent: b.videoPresent === true, scope: "현재 페이지 · 현재 선택 옵션 · 표시된 자료만", reviewOptionMatch: "unconfirmed", rights: { commercialReuse: "unconfirmed", aiUse: "unconfirmed", videoDownload: "unconfirmed", videoEditing: "unconfirmed" } };
}
