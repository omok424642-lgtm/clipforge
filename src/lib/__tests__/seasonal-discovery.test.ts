import { describe, expect, it } from "vitest";
import { DISCOVERY_CATEGORIES, getSeasonRecommendations, koreanDateKey, SEASONAL_ITEMS } from "../seasonal-discovery";
import { commerceIdentity, historyForProduct, productMatchesSeason, productReference, referenceForLibrarySelection, referenceIdentity, validateProductReference, verifiedAffiliate, type DiscoveryHistoryEntry } from "../discovery-products";
import type { ProductItem } from "../stores/product-library-store";

const at = (date: string) => new Date(date + "T03:00:00Z");
const product = (id: string, name = "텀블러"): ProductItem => ({ id, name, category: "home", images: [], videoCount: 0, createdAt: at("2026-10-27") });
const record = (overrides: Partial<DiscoveryHistoryEntry> = {}): DiscoveryHistoryEntry => ({ projectId: "p1", productId: "a", identity: null, originalUrl: null, name: "프로젝트", completedCount: 0, activeCount: 0, failedCount: 0, updatedAt: null, ...overrides });

describe("Korean seasonal planning", () => {
  it("uses Korea midnight, independent of OS timezone", () => {
    expect(koreanDateKey(new Date("2026-12-31T14:59:59Z"))).toBe("2026-12-31");
    expect(koreanDateKey(new Date("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
    expect(koreanDateKey(new Date("2026-10-26T15:00:00Z"))).toBe("2026-10-27");
  });
  it("includes winter and Christmas preparation in late October", () => {
    const rows = getSeasonRecommendations({ now: at("2026-10-27") });
    expect(rows.map((r) => r.item.id)).toContain("winter-bedding");
    expect(rows.map((r) => r.item.id)).toContain("christmas");
    expect(rows.find((r) => r.item.id === "christmas")?.phase).toBe("prepare");
  });
  it("includes 14 and 56 days ahead and excludes 13 and 57", () => {
    const contains = (date: string) => getSeasonRecommendations({ now: at(date), view: "ahead" }).some((r) => r.item.id === "winter-bedding");
    expect(contains("2026-09-06")).toBe(true);
    expect(contains("2026-09-05")).toBe(false);
    expect(contains("2026-10-18")).toBe(true);
    expect(contains("2026-10-19")).toBe(false);
  });
  it("keeps a cross-year winter season connected to its actual start year", () => {
    const row = getSeasonRecommendations({ now: at("2027-01-15"), view: "this_month" }).find((r) => r.item.id === "winter-bedding")!;
    expect(row.demandStart).toBe("2026-11-01"); expect(row.demandEnd).toBe("2027-02-28"); expect(row.phase).toBe("season");
  });
  it("includes leap day and clamps February safely in non-leap years", () => {
    const leap = getSeasonRecommendations({ now: at("2028-02-29") }).find((r) => r.item.id === "winter-bedding")!;
    expect(leap.demandEnd).toBe("2028-02-29"); expect(leap.phase).toBe("season");
  });
  it("rolls December's next month into January", () => {
    const rows = getSeasonRecommendations({ now: at("2026-12-15"), view: "next_month" });
    expect(rows.find((r) => r.item.id === "new-year-storage")?.demandStart).toBe("2027-01-01");
    expect(rows.some((r) => r.item.id === "christmas")).toBe(false);
  });
  it("does not suggest a finished early-month event as a current opportunity", () => {
    expect(getSeasonRecommendations({ now: at("2026-05-20") }).some((r) => r.item.id === "childrens-day")).toBe(false);
    expect(getSeasonRecommendations({ now: at("2026-05-20"), view: "month", month: 5 }).some((r) => r.item.id === "childrens-day")).toBe(true);
    expect(getSeasonRecommendations({ now: at("2026-10-27") }).find((r) => r.item.id === "winter-bedding")?.phase).toBe("soon");
  });
  it.each(Array.from({ length: 12 }, (_, i) => i + 1))("supports explicit month %i", (month) => {
    const rows = getSeasonRecommendations({ now: at("2026-10-27"), view: "month", month, year: 2027 });
    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((r) => r.item.id)).size).toBe(rows.length);
    for (const r of rows) expect(Date.parse(r.demandEnd)).toBeGreaterThan(Date.parse(r.demandStart));
  });
  it.each(DISCOVERY_CATEGORIES)("filters category %s", (category) => {
    const rows = getSeasonRecommendations({ now: at("2026-10-27"), view: "month", month: 1, category });
    expect(rows.every((r) => r.item.category === category)).toBe(true);
    expect(SEASONAL_ITEMS.some((r) => r.category === category)).toBe(true);
  });
  it("marks variable-date holidays and weather as planning estimates", () => {
    for (const id of ["seollal-kitchen", "chuseok", "exam", "rain-gear"]) expect(SEASONAL_ITEMS.find((i) => i.id === id)?.timingNote).toBeTruthy();
  });
  it("does not invent sales, popularity ranks or performance data", () => {
    expect(JSON.stringify(SEASONAL_ITEMS)).not.toMatch(/판매량|검색량|인기\s*순위|베스트셀러|1위/);
    for (const i of SEASONAL_ITEMS) { expect(i.reason).toBeTruthy(); expect(i.filming).toBeTruthy(); expect(i.keywords.length).toBeGreaterThan(0); }
  });
  it("rejects invalid month, year and clock values", () => {
    expect(() => getSeasonRecommendations({ month: 13 })).toThrow();
    expect(() => getSeasonRecommendations({ year: 99999 })).toThrow();
    expect(() => koreanDateKey(new Date("invalid"))).toThrow();
  });
});

describe("library matching and production identity", () => {
  it("matches related words across spaces/case and allows manual search", () => {
    const season = SEASONAL_ITEMS.find((i) => i.id === "winter-kitchen")!;
    expect(productMatchesSeason(product("a", "스테인리스 보온 병"), season)).toBe(true);
    expect(productMatchesSeason(product("a", "THERMOS"), season)).toBe(true);
    expect(productMatchesSeason(product("a", "커튼"), season)).toBe(false);
    expect(productMatchesSeason(product("a", "커튼"), season, "커튼")).toBe(true);
  });
  it("ignores tracking codes but does not merge different stores", () => {
    const base = "https://smartstore.naver.com/store/products/123";
    expect(commerceIdentity(base + "?tag=one")).toBe(commerceIdentity(base + "?tag=two"));
    expect(commerceIdentity(base)).not.toBe(commerceIdentity(base.replace("/store/", "/other/")));
    expect(commerceIdentity("https://link.coupang.com/a/ABC")).toBeUndefined();
  });
  it("groups options for a conservative duplicate warning", () => {
    expect(commerceIdentity("https://www.coupang.com/vp/products/1?itemId=2")).toBe(commerceIdentity("https://www.coupang.com/vp/products/1?itemId=3"));
  });
  it("does not turn equal product names into certain duplicate matches", () => {
    expect(historyForProduct(product("b"), [record()], [product("a"), product("b")])).toEqual([]);
    expect(historyForProduct(product("a"), [record()], [product("a")])).toHaveLength(1);
  });
  it("uses a persistent canonical identity even after an old library item is removed", () => {
    const p = product("new-id");
    p.commerceImport = { link: { originalUrl: "https://naver.me/ABC" }, resolvedUrl: "https://smartstore.naver.com/store/products/123" } as ProductItem["commerceImport"];
    const identity = referenceIdentity(productReference(p));
    expect(historyForProduct(p, [record({ productId: "removed-id", identity })], [p])).toHaveLength(1);
  });
  it("links only a real selected library item and preserves original URLs", () => {
    expect(referenceForLibrarySelection([product("a")], "?productId=a")).toEqual({ libraryId: "a", originalUrl: undefined, resolvedUrl: undefined });
    expect(referenceForLibrarySelection([product("a")], "?productId=missing")).toBeUndefined();
    const ref = { libraryId: "a", originalUrl: "https://naver.me/ABC?x=a%2Fb&tag=1", resolvedUrl: "https://smartstore.naver.com/store/products/123" };
    expect(validateProductReference(ref)).toEqual(ref);
  });
  it.each([{ libraryId: "../private" }, { libraryId: "a", originalUrl: "http://127.0.0.1" }, { libraryId: "a", originalUrl: "https://naver.me/a", resolvedUrl: "https://www.coupang.com/vp/products/1" }])("rejects invalid references %j", (ref) => expect(() => validateProductReference(ref)).toThrow());
});

describe("affiliate evidence", () => {
  const v = { program: "naver_shopping_connect", available: true, checkedAt: "2026-10-27", sourceUrl: "https://brandconnect.naver.com/product/123", confirmedByUser: true };
  it("requires an explicit official-source record; a link or disclosure alone is not proof", () => {
    expect(verifiedAffiliate(v, at("2026-10-27"))).toEqual(v);
    expect(verifiedAffiliate(undefined)).toBeUndefined();
    expect(verifiedAffiliate({ disclosure: { enabled: true }, link: "https://naver.me/a" })).toBeUndefined();
  });
  it.each([{ confirmedByUser: false }, { sourceUrl: "https://brandconnect.naver.com.evil.com/product/1" }, { checkedAt: "2026-02-30" }, { checkedAt: "2026-10-28" }])("rejects unconfirmed/invalid/future evidence %j", (patch) => expect(verifiedAffiliate({ ...v, ...patch }, at("2026-10-27"))).toBeUndefined());
});
