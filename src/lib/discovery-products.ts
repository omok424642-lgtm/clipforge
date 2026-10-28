import type { ProductItem } from "./stores/product-library-store";
import type { SeasonalItem } from "./seasonal-discovery";
import { koreanDateKey } from "./seasonal-discovery";
import { classifyCommerceLink, sameCommerceProduct } from "./commerce-product";

export interface ProductReference { libraryId: string; originalUrl?: string; resolvedUrl?: string }
const normalize = (text: string) => text.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[\s_\-·/]+/g, "");
export function productMatchesSeason(product: Pick<ProductItem, "name" | "description">, item: Pick<SeasonalItem, "keywords">, query = "") {
  const text = normalize(`${product.name} ${product.description || ""}`);
  return query.trim() ? text.includes(normalize(query)) : item.keywords.some((word) => text.includes(normalize(word)));
}
export function productReference(product: ProductItem): ProductReference {
  return { libraryId: product.id, originalUrl: product.commerceImport?.link.originalUrl, resolvedUrl: product.commerceImport?.resolvedUrl };
}
export function referenceForLibrarySelection(library: ProductItem[], search: string): ProductReference | undefined {
  const id = new URLSearchParams(search).get("productId");
  const product = library.find((p) => p.id === id);
  return product ? productReference(product) : undefined;
}
/** Stable identity ignores tracking parameters and groups options conservatively. Never matches names. */
export function commerceIdentity(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const link = classifyCommerceLink(url);
    if (!link.productId) return undefined;
    if (link.platform === "naver") {
      const u = new URL(url);
      return `naver:${u.hostname.replace(/^m\./, "")}:${u.pathname.split("/")[1]}:${link.productId}`;
    }
    return `coupang:${link.productId}`;
  } catch { return undefined; }
}
export function referenceIdentity(ref: ProductReference): string {
  return commerceIdentity(ref.resolvedUrl) ?? commerceIdentity(ref.originalUrl) ?? `library:${ref.libraryId}`;
}
export function validateProductReference(raw: unknown): ProductReference | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) throw new Error("상품 연결 정보를 확인해 주세요.");
  const ref = raw as Record<string, unknown>;
  if (typeof ref.libraryId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(ref.libraryId)) throw new Error("상품 번호를 확인해 주세요.");
  const result: ProductReference = { libraryId: ref.libraryId };
  for (const key of ["originalUrl", "resolvedUrl"] as const) {
    if (ref[key] === undefined) continue;
    if (typeof ref[key] !== "string") throw new Error("상품 주소를 확인해 주세요.");
    classifyCommerceLink(ref[key]); result[key] = ref[key];
  }
  if (result.originalUrl && result.resolvedUrl && classifyCommerceLink(result.originalUrl).platform !== classifyCommerceLink(result.resolvedUrl).platform) throw new Error("상품 주소의 플랫폼이 다릅니다.");
  if (result.originalUrl && result.resolvedUrl) {
    const original = classifyCommerceLink(result.originalUrl);
    if (original.productId && !sameCommerceProduct(original, result.resolvedUrl)) throw new Error("원본과 연결된 상품이 다릅니다.");
  }
  return result;
}

export interface DiscoveryHistoryEntry {
  projectId: string; productId: string | null; identity: string | null; originalUrl: string | null; name: string;
  completedCount: number; activeCount: number; failedCount: number; updatedAt: string | null;
}
export function historyForProduct(product: ProductItem, entries: DiscoveryHistoryEntry[], library: ProductItem[]): DiscoveryHistoryEntry[] {
  const key = referenceIdentity(productReference(product));
  const aliases = new Set(library.filter((p) => referenceIdentity(productReference(p)) === key).map((p) => p.id));
  aliases.add(product.id);
  return entries.filter((entry) => (entry.productId && aliases.has(entry.productId)) || entry.identity === key || (entry.originalUrl && commerceIdentity(entry.originalUrl) === key));
}

export interface AffiliateVerification {
  program: "naver_shopping_connect"; available: boolean; checkedAt: string; sourceUrl: string; confirmedByUser: true;
}
export function verifiedAffiliate(value: unknown, now = new Date()): AffiliateVerification | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as AffiliateVerification;
  if (v.program !== "naver_shopping_connect" || typeof v.available !== "boolean" || v.confirmedByUser !== true || !/^\d{4}-\d{2}-\d{2}$/.test(v.checkedAt)) return undefined;
  const time = Date.parse(`${v.checkedAt}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== v.checkedAt || v.checkedAt > koreanDateKey(now)) return undefined;
  try {
    const u = new URL(v.sourceUrl);
    if (u.protocol !== "https:" || u.username || u.password || u.port || !["brandconnect.naver.com", "shoppingconnect.naver.com"].includes(u.hostname)) return undefined;
  } catch { return undefined; }
  return v;
}
