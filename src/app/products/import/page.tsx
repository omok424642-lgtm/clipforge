"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useProductLibraryStore } from "@/lib/stores/product-library-store";
import { missingCommerceFields, type CommerceProductDraft } from "@/lib/commerce-product";

const methods = { manual: "직접 입력 필요", naver_search_api: "종료된 네이버 검색 API — 현재 사용 불가", coupang_partners_api: "쿠팡 파트너스 API", public_metadata: "공개 상품 정보", browser_page: "사용자가 확인한 브라우저 페이지 자료" };

export default function CommerceImportPage() {
  const [url, setUrl] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [keyword, setKeyword] = useState("");
  const [draft, setDraft] = useState<CommerceProductDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [facts, setFacts] = useState(false);
  const [rights, setRights] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search), id = params.get("draft");
    if (!id) return;
    const ctrl = new AbortController();
    setBusy(true);
    fetch(`/api/ingest/commerce?id=${encodeURIComponent(id)}${params.get("reviewed") === "1" ? "&reviewed=1" : ""}`, { signal: ctrl.signal })
      .then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(data.error); setDraft(data.draft); })
      .catch((e) => { if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "불러오지 못했습니다."); })
      .finally(() => { if (!ctrl.signal.aborted) setBusy(false); });
    return () => ctrl.abort();
  }, []);

  const patch = (value: Partial<CommerceProductDraft>) => {
    setDraft((d) => d && { ...d, ...value }); setFacts(false); setSaved(false);
    if (value.images) setRights(false);
  };
  const analyze = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setSaved(false); setDraft(null); setFacts(false); setRights(false);
    try {
      const res = await fetch("/api/ingest/commerce", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "analyze", url, productUrl, keyword }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      setDraft(data.draft); window.history.replaceState(null, "", `/products/import?draft=${data.draft.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "링크 분석에 실패했습니다."); }
    finally { setBusy(false); }
  };
  const upload = async (files: FileList | null) => {
    if (!draft || !files?.length) return;
    setBusy(true); setError("");
    try {
      const picked = Array.from(files);
      if (picked.length + draft.images.length > 10) throw new Error("이미지는 최대 10장까지 사용할 수 있습니다.");
      if (picked.some((f) => !["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"].includes(f.type) || f.size > 12 * 1024 * 1024)) throw new Error("12MB 이하 JPG·PNG·WebP·GIF·BMP 이미지를 선택해 주세요.");
      const form = new FormData(); form.set("productId", draft.id); picked.forEach((file) => form.append("files", file));
      const res = await fetch("/api/products/upload", { method: "POST", body: form });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      patch({ images: [...draft.images, ...data.paths.map((url: string) => ({ url, sourceUrl: "사용자 업로드", provenance: "user" as const }))] });
    } catch (e) { setError(e instanceof Error ? e.message : "이미지를 업로드하지 못했습니다."); }
    finally { setBusy(false); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!draft) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/ingest/commerce", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        action: "review", id: draft.id, title: draft.title, price: draft.price, description: draft.description, options: draft.options, features: draft.features,
        selectedImages: draft.images.map((i) => i.url), factsConfirmed: facts, imageRightsConfirmed: rights,
        disclosureEnabled: draft.disclosure.enabled, disclosureText: draft.disclosure.text,
      }) });
      const data = await res.json(); if (!res.ok) throw new Error([data.error, ...(data.warnings || []).slice(-2)].join(" "));
      const reviewed: CommerceProductDraft = data.draft;
      const store = useProductLibraryStore.getState();
      const product = { name: reviewed.title, price: reviewed.price, description: [reviewed.description, ...reviewed.features].filter(Boolean).join("\n"), images: reviewed.images.map((i) => i.url), commerceImport: reviewed };
      if (store.products.some((p) => p.id === reviewed.id)) store.updateProduct(reviewed.id, product);
      else store.addProduct({ ...product, id: reviewed.id, category: "other", videoCount: 0, createdAt: new Date() });
      setDraft(reviewed); setSaved(true); window.history.replaceState(null, "", `/products/import?draft=${reviewed.id}&reviewed=1`);
    } catch (e) { setError(e instanceof Error ? e.message : "상품을 저장하지 못했습니다."); }
    finally { setBusy(false); }
  };
  const missing = draft ? missingCommerceFields(draft) : [];

  return <main lang="ko" className="mx-auto max-w-4xl space-y-6 px-5 py-10">
    <div><Link href="/products" className="text-sm underline">상품 보관함으로</Link><h1 className="mt-3 text-2xl font-bold">네이버·쿠팡 상품 가져오기</h1>
      <p className="mt-2 text-muted-foreground">상품 정보를 확인하고 보완해 저장합니다. 이 단계에서는 영상 제작·업로드·쇼핑커넥트 태그 부착을 실행하지 않습니다.</p></div>
    <Link href="/products/browser" className="block underline">즐겨찾기 ‘상품 가져오기’ 버튼 설치 · 자료 파일 열기</Link>
    <form onSubmit={analyze} className="space-y-4 rounded-xl border p-5">
      <label className="block space-y-2"><span>상품 또는 제휴 링크</span><Input type="url" required maxLength={4096} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="네이버 쇼핑커넥트·스마트스토어 또는 쿠팡 링크" disabled={busy} /></label>
      <label className="block space-y-2"><span>실제 상품 링크 (선택)</span><Input type="url" maxLength={4096} value={productUrl} onChange={(e) => setProductUrl(e.target.value)} placeholder="제휴 링크를 열어 확인한 같은 상품의 주소" disabled={busy} /><span className="block text-xs text-muted-foreground">제휴 원본은 그대로 보존됩니다. 제휴 링크와 같은 상품인지 직접 확인해 주세요.</span></label>
      <label className="block space-y-2"><span>상품 검색어 (선택)</span><Input maxLength={100} value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="공식 조회 연결 시 사용할 정확한 상품명" disabled={busy} /></label>
      <Button disabled={busy || !url.trim()} type="submit">{busy ? "처리 중…" : "링크 분석 및 상품 정보 가져오기"}</Button>
    </form>
    {error && <p role="alert" className="rounded-lg border border-destructive p-4 text-destructive">{error}</p>}
    {draft && <form onSubmit={save} className="space-y-5 rounded-xl border p-5">
      <h2 className="text-xl font-semibold">{draft.link.platform === "naver" ? "네이버" : "쿠팡"} 상품 정보 확인</h2>
      <p className="text-sm">수집 방식: {methods[draft.method]} · 수집 시각: {new Date(draft.collectedAt).toLocaleString("ko-KR")}</p>
      <div className="space-y-2 break-all rounded-lg bg-muted p-3 text-sm">
        <p>원본 링크 (수정하지 않고 보존)</p><a href={draft.link.originalUrl} target="_blank" rel="noopener noreferrer" className="underline">{draft.link.originalUrl}</a>
        {draft.resolvedUrl && <p>확인용 상품 주소: <a href={draft.resolvedUrl} target="_blank" rel="noopener noreferrer" className="underline">{draft.resolvedUrl}</a></p>}
        {draft.link.itemId && <p>쿠팡 옵션 식별 번호: {draft.link.itemId} {draft.link.vendorItemId && `/ 판매 옵션: ${draft.link.vendorItemId}`}</p>}
      </div>
      <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">{draft.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>
      {draft.browserMaterials && <section className="space-y-2 rounded-lg border p-3">
        <h3 className="font-semibold">브라우저에서 확인한 원본 자료 (검증·AI 분석 전)</h3>
        <p>브랜드: {draft.browserMaterials.brand || "미확인"} · 평점: {draft.browserMaterials.rating || "미확인"}</p>
        <p>상품 소개 영상: {draft.browserMaterials.videoPresent ? "페이지에 영상 요소 있음 · 재생·다운로드·편집 권한 미확인" : "미확인"}</p>
        <p>이 범위만 수집: {draft.browserMaterials.scope}. 다른 옵션에서도 동일한 사양·리뷰인지는 미확인입니다.</p>
        <details><summary>표시된 구매평 {draft.browserMaterials.reviews.length}개 · 광고 전재 금지</summary>{draft.browserMaterials.reviews.map((r, i) => <p className="my-2 whitespace-pre-wrap" key={i}>{r}</p>)}</details>
        <p className="text-sm">원본 자료를 수정하려면 자료 파일을 다시 열어 내용을 수정하고 새로 가져오세요. 아래 상품명·설명·옵션·특징·이미지는 저장 전에 수정할 수 있습니다. AI 분석과 영상 다운로드는 이 단계에서 실행하지 않습니다.</p>
      </section>}
      <p className="text-sm">아래 내용은 모두 수정할 수 있습니다. 원본 판매 페이지와 가격·선택 옵션을 비교하고, 확인되지 않은 효능이나 특징은 추가하지 마세요.</p>
      <fieldset disabled={busy} className="space-y-4">
        <label className="block space-y-2"><span>상품명 *</span><Input required maxLength={300} value={draft.title} onChange={(e) => patch({ title: e.target.value })} /></label>
        <label className="block space-y-2"><span>확인한 가격 *</span><Input required maxLength={100} placeholder="예: 29,900원 (블랙 / 500ml, 배송비 별도)" value={draft.price} onChange={(e) => patch({ price: e.target.value })} /></label>
        <label className="block space-y-2"><span>선택 옵션 * (한 줄에 하나, 없으면 ‘옵션 없음’)</span><Textarea required value={draft.options.join("\n")} onChange={(e) => patch({ options: e.target.value.split("\n") })} /></label>
        <label className="block space-y-2"><span>판매 페이지에서 확인한 실제 상품 특징 * (한 줄에 하나)</span><Textarea required placeholder="예: 용량 500ml / 소재 스테인리스. 사진만 보고 추측한 내용은 제외해 주세요." value={draft.features.join("\n")} onChange={(e) => patch({ features: e.target.value.split("\n") })} /></label>
        <label className="block space-y-2"><span>상품 설명 (원문 참고·직접 보완)</span><Textarea maxLength={4000} value={draft.description} onChange={(e) => patch({ description: e.target.value })} /></label>
        <div className="space-y-3"><h3 className="font-medium">사용할 이미지 *</h3><p className="text-sm text-muted-foreground">자동 수집된 이미지는 사용 허가를 뜻하지 않습니다. 제외할 사진은 삭제하고, 사용 권한이 있는 사진을 업로드해 주세요.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{draft.images.map((image, i) => <div key={`${image.url}-${i}`} className="space-y-2 rounded-lg border p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={`상품 이미지 ${i + 1}`} referrerPolicy="no-referrer" className="aspect-square w-full object-contain" />
            <p className="text-xs">{image.provenance === "user" ? "직접 업로드" : "수집 이미지 · 권한 확인 필요"}</p>
            <p className="break-all text-xs text-muted-foreground">출처: {image.sourceUrl}</p>
            <Button variant="outline" type="button" onClick={() => patch({ images: draft.images.filter((_, index) => index !== i) })}>이 이미지 제외</Button>
          </div>)}</div>
          <label className="block space-y-2"><span>직접 이미지 추가 (최대 10장, 장당 12MB)</span><input aria-label="상품 이미지 업로드" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/bmp" multiple onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} /></label>
        </div>
        <div className="space-y-3 rounded-lg border p-4"><h3 className="font-medium">영상 제휴 고지 설정</h3>
          <label className="flex gap-2"><input type="checkbox" checked={draft.disclosure.enabled} onChange={(e) => patch({ disclosure: { ...draft.disclosure, enabled: e.target.checked } })} />완성 영상에 제휴 고지 표시 예정</label>
          <Textarea aria-label="제휴 고지 문구" maxLength={1000} value={draft.disclosure.text} onChange={(e) => patch({ disclosure: { ...draft.disclosure, text: e.target.value } })} />
          <p className="text-xs text-muted-foreground">문구는 편집 가능한 초안이며 최신 플랫폼 기준을 확인해야 합니다. 이번 단계에서는 표시 설정만 저장합니다. 영상에 실제로 넣는 기능과 클립 업로드·태그 부착은 후속 단계입니다.</p>
        </div>
        <label className="flex gap-2"><input type="checkbox" checked={facts} onChange={(e) => setFacts(e.target.checked)} />원본 상품 페이지에서 상품명·가격·선택 옵션·특징을 확인했습니다.</label>
        <label className="flex gap-2"><input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} />선택한 이미지의 영상 사용 권한을 확인했습니다.</label>
        {!!missing.length && <p className="text-sm text-muted-foreground">보완 필요: {missing.join(", ")}</p>}
        <Button type="submit" disabled={!facts || !rights || !!missing.length || saved}>확인한 상품 저장</Button>
      </fieldset>
      {saved && <div role="status" className="rounded-lg bg-muted p-4">상품과 원본 제휴 링크, 제휴 고지 설정을 저장했습니다. <Link className="underline" href="/products">상품 보관함에서 확인하기</Link></div>}
    </form>}
  </main>;
}
