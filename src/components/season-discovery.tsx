"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DISCOVERY_CATEGORIES, getSeasonRecommendations, koreanDateKey, SEASONAL_REVISION, SEASONAL_SOURCE, type SeasonalItem, type SeasonView } from "@/lib/seasonal-discovery";
import { historyForProduct, productMatchesSeason, verifiedAffiliate, type DiscoveryHistoryEntry } from "@/lib/discovery-products";
import { useProductLibraryStore, type ProductItem } from "@/lib/stores/product-library-store";
import { useSettingsStore } from "@/lib/stores/settings-store";

const TABS = ["시즌 상품", "급상승 상품", "판매 인기 상품", "쇼핑클립 추천 상품"] as const;
const formatDay = (key: string) => key.replaceAll("-", ".");

function AffiliateStatus({ product, today }: { product: ProductItem; today: string }) {
  const verification = verifiedAffiliate(product.affiliateVerification);
  const update = useProductLibraryStore((s) => s.updateProduct);
  const [source, setSource] = useState(verification?.sourceUrl ?? "");
  const [available, setAvailable] = useState("yes");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const save = () => {
    const record = verifiedAffiliate({ program: "naver_shopping_connect", available: available === "yes", checkedAt: today, sourceUrl: source, confirmedByUser: confirmed });
    if (!record) { setError("공식 쇼핑커넥트·브랜드커넥트 확인 주소와 확인 체크가 필요합니다."); return; }
    update(product.id, { affiliateVerification: record }); setError(""); setConfirmed(false);
  };
  if (product.commerceImport?.link.platform === "coupang") return <p className="text-sm text-muted-foreground">네이버 쇼핑커넥트 제휴: 미확인 (쿠팡 상품)</p>;
  return <div className="space-y-2 text-sm">
    <p>네이버 쇼핑커넥트 제휴: {verification ? `${verification.available ? "가능" : "불가"} (사용자 확인 · ${formatDay(verification.checkedAt)})` : "미확인"}</p>
    {verification && <a className="underline" href={verification.sourceUrl} target="_blank" rel="noopener noreferrer">확인 출처 열기</a>}
    <details className="rounded-lg border p-3"><summary className="cursor-pointer">직접 확인한 제휴 상태 기록</summary>
      <div className="mt-3 space-y-3">
        <p className="text-muted-foreground">공식 화면에서 이 상품의 제휴 조건을 확인한 경우에만 기록하세요. 자동 인증이 아니며, 조건은 바뀔 수 있어 제작 전에 다시 확인해야 합니다.</p>
        <label className="block">확인한 상태<select aria-label={`${product.name} 제휴 상태`} className="ml-2 rounded border bg-background p-2" value={available} onChange={(e) => setAvailable(e.target.value)}><option value="yes">제휴 가능</option><option value="no">제휴 불가</option></select></label>
        <label className="block space-y-1"><span>공식 확인 주소</span><Input aria-label={`${product.name} 제휴 확인 주소`} type="url" value={source} onChange={(e) => setSource(e.target.value)} placeholder="https://brandconnect.naver.com/…" maxLength={4096} /></label>
        <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />이 상품의 조건을 공식 화면에서 직접 확인했습니다.</label>
        <Button size="sm" type="button" variant="outline" disabled={!confirmed} onClick={save}>확인 기록 저장</Button>
        {verification && <Button size="sm" variant="ghost" onClick={() => update(product.id, { affiliateVerification: undefined })}>미확인으로 되돌리기</Button>}
        {error && <p role="alert" className="text-destructive">{error}</p>}
      </div>
    </details>
  </div>;
}

export function SeasonDiscovery({ initialNow }: { initialNow: string }) {
  const router = useRouter();
  const products = useProductLibraryStore((s) => s.products);
  const uiMode = useSettingsStore((s) => s.uiMode);
  const [now, setNow] = useState(() => new Date(initialNow));
  const today = koreanDateKey(now);
  const [tab, setTab] = useState(0);
  const [view, setView] = useState<SeasonView>("now_next");
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [category, setCategory] = useState("전체");
  const [selected, setSelected] = useState<SeasonalItem | null>(null);
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<DiscoveryHistoryEntry[]>([]);
  const [historyState, setHistoryState] = useState<"loading" | "ready" | "error">("loading");
  const [historyError, setHistoryError] = useState("");
  const [starting, setStarting] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ product: ProductItem; records: DiscoveryHistoryEntry[] } | null>(null);
  const requestId = useRef(0);
  const selectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update(); const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, []);
  const refreshHistory = useCallback(async () => {
    const id = ++requestId.current; setHistoryState("loading"); setHistoryError("");
    try {
      const res = await fetch("/api/discovery/history", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.history)) throw new Error(data.error || "제작 이력을 확인하지 못했습니다.");
      if (id === requestId.current) { setHistory(data.history); setHistoryState("ready"); }
      return data.history as DiscoveryHistoryEntry[];
    } catch (e) {
      if (id === requestId.current) { setHistoryState("error"); setHistoryError(e instanceof Error ? e.message : "제작 이력을 확인하지 못했습니다."); }
      return null;
    }
  }, []);
  useEffect(() => {
    void refreshHistory();
    const refresh = () => { void refreshHistory(); };
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("focus", refresh); };
  }, [refreshHistory]);
  const recommendations = getSeasonRecommendations({ now, view, month, year, category });
  const relatedProducts = selected ? products.filter((p) => productMatchesSeason(p, selected, query)) : [];
  const clipProducts = products.filter((p) => recommendations.some((r) => productMatchesSeason(p, r.item)));
  const choose = (item: SeasonalItem) => {
    setSelected(item); setQuery("");
    requestAnimationFrame(() => selectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const navigateToCreation = (product: ProductItem) => router.push(`${uiMode === "pro" ? "/project/new" : "/start"}?productId=${encodeURIComponent(product.id)}`);
  const begin = async (product: ProductItem) => {
    if (starting) return;
    setStarting(product.id);
    const latest = await refreshHistory(); setStarting(null);
    if (!latest) return;
    const records = historyForProduct(product, latest, products);
    if (records.length) setDuplicate({ product, records });
    else navigateToCreation(product);
  };
  const renderProduct = (product: ProductItem) => {
    const records = historyForProduct(product, history, products);
    const completed = records.reduce((n, r) => n + r.completedCount, 0), active = records.reduce((n, r) => n + r.activeCount, 0);
    return <article key={product.id} aria-label={`보관 상품 ${product.name}`} className="space-y-3 rounded-xl border bg-background p-4">
      <div className="flex gap-3">
        {product.images[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.images[0]} alt={product.name} className="h-20 w-20 rounded object-contain" />
        )}
        <div><h3 className="font-semibold">{product.name}</h3>{product.price && <p className="text-sm">{product.price}</p>}<p className="text-xs text-muted-foreground">출처: 기존 상품 보관함</p></div>
      </div>
      <p className="text-sm">상품 사진: {product.images.length ? `${product.images.length}장 보관됨 · 사용 권한 재확인` : "없음 · 자료 추가 필요"}</p>
      <AffiliateStatus key={product.id} product={product} today={today} />
      <div className="rounded-lg bg-muted p-3 text-sm">
        <p aria-live="polite">{historyState === "loading" ? "제작 이력 확인 중…" : historyState === "error" ? "이력 확인 실패 · 제작 전에 다시 확인하세요." : completed ? `제작 완료 영상 ${completed}개${active ? ` · 제작 중 ${active}개` : ""}` : active ? `제작 중 ${active}개` : records.length ? "연결된 프로젝트가 있습니다. 완료 영상은 아직 없습니다." : "연결된 제작 이력 없음"}</p>
        {records.map((record) => <p key={record.projectId} className="mt-2"><Link className="underline" href={`/project/${record.projectId}/${record.completedCount ? "export" : "script"}`}>{record.completedCount ? "기존 영상 확인" : "기존 프로젝트 확인"}: {record.name}</Link></p>)}
      </div>
      <div className="flex flex-wrap gap-2"><Button onClick={() => void begin(product)} disabled={!!starting || historyState !== "ready" || !product.images.length}>{starting === product.id ? "이력 확인 중…" : "이 상품으로 제작하기"}</Button><Link href="/products"><Button variant="outline">상품·자료 관리</Button></Link></div>
      {!product.images.length && <p className="text-sm text-muted-foreground">상품 보관함에서 사용 가능한 사진을 추가하면 제작 화면으로 연결할 수 있습니다.</p>}
    </article>;
  };

  return <main lang="ko" className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
    <header className="space-y-3"><h1 className="text-2xl font-bold">상품 발굴</h1><p>계절과 일정을 보고 쇼핑클립을 준비할 상품군을 찾아보세요.</p>
      <p className="text-sm text-muted-foreground">한국 날짜: {formatDay(today)} · 출처: {SEASONAL_SOURCE} · 기획표 기준일: {SEASONAL_REVISION}</p>
      <p className="rounded-lg bg-muted p-3 text-sm">계절별 활용을 위한 기획 추천입니다. 실제 판매량·검색량·인기 순위 자료를 사용하지 않습니다. 준비 기간은 활용 예상 시기의 2~8주 전이며, 실제 수요 증가를 확인한 기간은 아닙니다.</p>
    </header>
    <nav aria-label="상품 발굴 분류" className="flex flex-wrap gap-2">{TABS.map((label, i) => <Button key={label} aria-pressed={tab === i} variant={tab === i ? "default" : "outline"} onClick={() => { setTab(i); setSelected(null); }}>{label}</Button>)}</nav>
    {(tab === 1 || tab === 2) ? <section className="space-y-3 rounded-xl border p-6"><h2 className="text-xl font-semibold">{TABS[tab]}: 데이터 연동 대기</h2><p>{tab === 1 ? "허용된 관심도 데이터를 연결한 뒤 7일·30일 변화를 표시합니다. 현재 급상승 상품을 판단하지 않습니다." : "출처와 집계 기간이 있는 실제 판매 데이터를 연결한 뒤 표시합니다. 검색 관심도를 판매량으로 대신하지 않습니다."}</p><p className="text-sm text-muted-foreground">데이터가 없어 순위·판매량·상승률을 표시하지 않습니다.</p></section> : <>
      <section aria-label="시즌 추천 조건" className="flex flex-wrap items-end gap-4 rounded-xl border p-4">
        <label className="space-y-1"><span className="block text-sm">추천 시기</span><select className="rounded border bg-background p-2" value={view} onChange={(e) => { setView(e.target.value as SeasonView); setSelected(null); }}><option value="now_next">이번 달과 다음 달</option><option value="this_month">이번 달</option><option value="next_month">다음 달</option><option value="ahead">2~8주 미리 준비</option><option value="month">월별 목록 보기</option></select></label>
        {view === "month" && <><label><span className="block text-sm">연도</span><select className="rounded border bg-background p-2" value={year} onChange={(e) => { setYear(Number(e.target.value)); setSelected(null); }}>{[Number(today.slice(0,4))-1, Number(today.slice(0,4)), Number(today.slice(0,4))+1].map((y) => <option key={y} value={y}>{y}년</option>)}</select></label><label><span className="block text-sm">월</span><select className="rounded border bg-background p-2" value={month} onChange={(e) => { setMonth(Number(e.target.value)); setSelected(null); }}>{Array.from({ length: 12 }, (_, i) => <option key={i+1} value={i+1}>{i+1}월</option>)}</select></label></>}
        <label><span className="block text-sm">카테고리</span><select className="rounded border bg-background p-2" value={category} onChange={(e) => { setCategory(e.target.value); setSelected(null); }}>{["전체", ...DISCOVERY_CATEGORIES].map((c) => <option key={c}>{c}</option>)}</select></label>
        <Link href="/products"><Button variant="outline">상품 보관함</Button></Link>
      </section>
      {historyError && <div role="alert" className="rounded-lg border border-destructive p-3 text-sm"><p>{historyError}</p><Button variant="outline" onClick={() => void refreshHistory()}>제작 이력 다시 확인</Button></div>}
      {tab === 3 ? <section className="space-y-4"><h2 className="text-xl font-semibold">시즌에 관련된 보관 상품</h2><p className="text-sm text-muted-foreground">현재 추천 조건과 상품 이름·설명에 관련 단어가 있는 후보입니다. 인기나 제휴가 확인된 추천 순위가 아니며, 사진과 상품 내용을 직접 확인하세요.</p>
        {clipProducts.length ? <div className="grid gap-4 md:grid-cols-2">{clipProducts.map(renderProduct)}</div> : <div className="rounded-xl border p-5"><p>조건에 맞는 실제 상품이 아직 없습니다. 시즌 상품 탭에서 품목을 고른 뒤 상품 링크나 자료를 추가해 주세요.</p><Button className="mt-3" onClick={() => setTab(0)}>시즌 상품 보기</Button></div>}
      </section> : <>
        {selected && <section ref={selectionRef} aria-label="관련 상품 찾기" className="scroll-mt-6 space-y-4 rounded-xl border-2 border-primary/40 p-5"><h2 className="text-xl font-semibold">관련 상품 찾기: {selected.name}</h2>
          <p className="text-sm">보관함의 이름·설명에서 관련 단어를 찾습니다. 다른 표현으로 저장했다면 직접 검색어를 입력하세요.</p>
          <label className="block space-y-2"><span>보관함 검색어</span><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`자동 관련 검색: ${selected.keywords.slice(0,3).join(", ")}`} maxLength={100} /></label>
          {relatedProducts.length ? <div className="grid gap-4 md:grid-cols-2">{relatedProducts.map(renderProduct)}</div> : <p className="rounded-lg bg-muted p-4">관련된 실제 상품이 없습니다. 상품 링크를 등록하거나, 사용 권한이 있는 상품 정보와 사진을 보관함에 추가해 주세요.</p>}
          <div className="flex flex-wrap gap-2"><Link href="/products/import"><Button variant="outline">상품 링크 추가</Button></Link><Link href="/products"><Button variant="outline">상품 정보·사진 직접 추가</Button></Link><Button variant="ghost" onClick={() => setSelected(null)}>선택 닫기</Button></div>
        </section>}
        <section aria-label="시즌 상품군 목록" className="grid gap-4 md:grid-cols-2">{recommendations.map((r) => <article key={r.item.id} className="space-y-3 rounded-xl border p-5">
          <div className="flex flex-wrap items-center gap-2"><span className="rounded bg-muted px-2 py-1 text-xs">{r.item.category}</span><span className="text-xs text-muted-foreground">{r.phase === "season" ? "활용 시즌" : r.phase === "prepare" ? "미리 준비할 시기" : r.phase === "soon" ? "곧 시작할 시즌" : "월별 기획 후보"}</span></div>
          <h2 className="text-lg font-semibold">{r.item.name}</h2><p className="text-sm">{r.item.reason}</p>
          <dl className="space-y-1 text-sm"><div><dt className="inline font-medium">활용 예상 시기: </dt><dd className="inline">{formatDay(r.demandStart)} ~ {formatDay(r.demandEnd)}</dd></div><div><dt className="inline font-medium">미리 제작 준비: </dt><dd className="inline">{formatDay(r.prepStart)} ~ {formatDay(r.prepEnd)}</dd></div></dl>
          {r.item.timingNote && <p className="text-xs text-muted-foreground">{r.item.timingNote}</p>}
          <p className="text-sm"><span className="font-medium">영상 소재: </span>{r.item.filming}</p>
          <p className="text-xs text-muted-foreground">추천 근거: 계절·행사 기획 · {SEASONAL_SOURCE} ({SEASONAL_REVISION})<br />제휴 여부: 실제 상품 선택 후 확인</p>
          <Button variant="outline" onClick={() => choose(r.item)}>보관함에서 관련 상품 찾기</Button>
        </article>)}</section>
        {!recommendations.length && <p role="status" className="rounded-xl border p-6">선택한 조건의 시즌 품목이 없습니다. 카테고리나 월을 바꿔 보세요.</p>}
      </>}
      <p className="text-xs text-muted-foreground">제작 이력은 상품 번호와 연결된 서버 기록을 기준으로 합니다. 연결 정보가 없는 이전 프로젝트나 서로 다른 번호로 직접 등록한 상품은 동일 상품으로 확인하지 못할 수 있습니다. 직접 확인하지 않은 제휴 여부는 미확인으로 표시합니다.</p>
    </>}
    <Dialog open={!!duplicate} onOpenChange={(open) => { if (!open) setDuplicate(null); }}>{duplicate && <DialogContent showCloseButton={false} className="max-h-[90vh] overflow-auto sm:max-w-lg">
      <DialogTitle className="text-xl font-semibold">같은 상품의 제작 이력이 있습니다</DialogTitle><DialogDescription>{duplicate.product.name}의 기존 프로젝트를 먼저 확인하세요. 다른 옵션의 제작 이력도 함께 표시될 수 있습니다.</DialogDescription>
      {duplicate.records.map((record) => <div key={record.projectId} className="rounded border p-3"><p>{record.name}</p><p className="text-sm">완료 {record.completedCount}개 · 제작 중 {record.activeCount}개{record.failedCount ? ` · 실패 ${record.failedCount}개` : ""}</p><Link className="text-sm underline" href={`/project/${record.projectId}/${record.completedCount ? "export" : "script"}`}>기존 프로젝트 열기</Link></div>)}
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setDuplicate(null)}>돌아가기</Button><Button onClick={() => { const product = duplicate.product; setDuplicate(null); navigateToCreation(product); }}>확인했고 새 영상으로 계속</Button></div>
    </DialogContent>}</Dialog>
  </main>;
}
