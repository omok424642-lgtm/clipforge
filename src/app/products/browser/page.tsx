"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { productBookmarklet } from "@/lib/product-bookmarklet";
import { parseBrowserProduct, type BrowserProductMaterials } from "@/lib/browser-product";

export default function BrowserImportPage() {
  const anchor = useRef<HTMLAnchorElement>(null);
  const [code, setCode] = useState("");
  const [raw, setRaw] = useState("");
  const [material, setMaterial] = useState<BrowserProductMaterials | null>(null);
  const [affiliate, setAffiliate] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    const value = productBookmarklet(); setCode(value);
    // React deliberately blocks javascript: JSX URLs; this bookmark is explicitly installed by the user.
    anchor.current?.setAttribute("href", value);
  }, []);
  const inspect = (value = raw) => {
    try { if (value.length > 190000) throw new Error("자료 파일은 190KB 이하만 지원합니다."); const parsed = parseBrowserProduct(JSON.parse(value)); setMaterial(parsed); setSelected(parsed.images); setError(""); setConfirmed(false); setPreview(false); }
    catch (e) { setMaterial(null); setError(e instanceof Error ? e.message : "파일 내용을 확인해 주세요."); }
  };
  const edit = (value: Partial<BrowserProductMaterials>) => {
    if (!material) return;
    const updated = { ...material, ...value }; setMaterial(updated); setRaw(JSON.stringify(updated, null, 2)); setConfirmed(false);
  };
  const send = async () => {
    if (!material || !confirmed) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/ingest/commerce", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "browser_import", material: { ...material, images: selected }, affiliateUrl: affiliate, confirmed }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "가져오지 못했습니다.");
      window.location.assign(`/products/import?draft=${encodeURIComponent(data.draft.id)}`);
    } catch (e) { setError(e instanceof Error ? e.message : "가져오지 못했습니다."); setBusy(false); }
  };
  return <main lang="ko" className="mx-auto max-w-4xl space-y-5 px-5 py-10">
    <Link href="/products" className="underline">상품 보관함으로</Link>
    <h1 className="text-2xl font-bold">즐겨찾기로 상품 가져오기</h1>
    <section className="space-y-3 rounded-xl border p-5">
      <h2 className="text-xl font-semibold">1. Windows 크롬에 버튼 등록</h2>
      <p>Ctrl + Shift + B로 즐겨찾기 모음을 표시하고, 아래 버튼을 즐겨찾기 모음으로 끌어 놓으세요.</p>
      <a ref={anchor} draggable className="inline-block rounded-lg border bg-muted p-3 font-bold">상품 가져오기</a>
      <p>끌어 놓기가 안 되면 Ctrl + Shift + O → 오른쪽 위 ⋮ → 새 북마크 추가에서 이름은 ‘상품 가져오기’, URL은 아래 코드 전체를 붙여넣으세요.</p>
      <details><summary>수동 등록용 코드</summary><textarea aria-label="북마클릿 코드" readOnly value={code} className="h-32 w-full border p-2" /></details>
      <p>네이버 스마트스토어·브랜드스토어 또는 쿠팡 상품 페이지에서 옵션을 선택하고 필요한 상세정보·구매평을 직접 펼친 뒤 버튼을 누르세요. 표시된 내용과 이미지를 확인하고 개인정보를 지운 후 자료 파일을 저장하세요.</p>
      <p className="text-sm">페이지 구조 변경·접근 제한·iframe·보안 정책으로 일부 항목이나 버튼이 작동하지 않을 수 있습니다. 제한은 우회하지 않습니다. 그때는 아래에 직접 자료를 입력하거나 기존 상품 가져오기 화면에서 보완하세요. 반복 실행·자동 스크롤·다른 리뷰 페이지 조회는 하지 않습니다.</p>
    </section>
    <section className="space-y-3 rounded-xl border p-5">
      <h2 className="text-xl font-semibold">2. 저장한 자료 확인</h2>
      <p>파일은 이 화면에서만 읽습니다. ‘확인한 자료 가져오기’를 누르기 전에는 ClipForge 서버로 전송하지 않습니다.</p>
      <input aria-label="상품 자료 파일" type="file" accept="application/json,.json" onChange={async e => {
        const file = e.target.files?.[0]; if (!file) return;
        setMaterial(null); setConfirmed(false);
        if (file.size > 190000) { setError("190KB 이하 자료 파일을 선택해 주세요."); return; }
        const value = await file.text(); setRaw(value); inspect(value);
      }} />
      <details><summary>고급: 자료 파일 내용 직접 수정</summary><label className="block">개인정보·다른 옵션·안내 문구 제거<textarea aria-label="상품 자료 내용" className="h-60 w-full rounded border p-2" value={raw} onChange={e => { setRaw(e.target.value); setMaterial(null); setConfirmed(false); }} /></label><button className="rounded border p-3" onClick={() => inspect()}>자료 내용 확인</button></details>
      {material && <div className="space-y-3">
        <p>출처: {material.sourceUrl}</p><p>수집 시각: {new Date(material.collectedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} (한국 시간)</p>
        <p>상품명: {material.title || "미확인"} / 가격: {material.price || "미확인"} / 브랜드: {material.brand || "미확인"}</p>
        {([['상품명', 'title'], ['가격', 'price'], ['브랜드', 'brand'], ['현재 선택 옵션 (한 줄에 하나)', 'options'], ['상품 상세설명', 'description'], ['제품 사양 (한 줄에 하나)', 'specifications'], ['구매평 (한 줄에 하나, 개인정보·안내 문구 제거)', 'reviews'], ['평점', 'rating']] as const).map(([label, key]) => <label className="block" key={key}>{label}<textarea aria-label={label} placeholder="미확인 — 직접 보완해 주세요" className="block min-h-16 w-full rounded border p-2" value={Array.isArray(material[key]) ? (material[key] as string[]).join("\n") : material[key]} onChange={e => edit({ [key]: Array.isArray(material[key]) ? e.target.value.split("\n") : e.target.value })} /></label>)}
        <p>현재 옵션: {material.options.join(" / ") || "미확인"} · 평점: {material.rating || "미확인"}</p>
        <p className="whitespace-pre-wrap">설명: {material.description || "미확인"}</p><p>사양: {material.specifications.join(" / ") || "미확인"}</p>
        <p>영상: {material.videoPresent ? "요소 있음 · 접근 가능 여부 및 사용 권한 미확인" : "미확인"}. 이 기능은 영상을 다운로드하지 않습니다. 권한이 확인된 영상 파일은 기존 제작 화면의 로컬 자료 추가를 이용하세요.</p>
        <p>구매평·평점은 상품 단위 자료이며 선택 옵션과 일치하는지 미확인입니다. 옵션별 제품 사양에 합치거나 광고 근거로 자동 사용하지 않습니다.</p>
        <details><summary>구매평 {material.reviews.length}개 (상품 전체 평판·판매량 근거가 아닙니다)</summary>{material.reviews.map((r, i) => <p key={i} className="my-2">{r}</p>)}</details>
        <button className="rounded border p-2" onClick={() => setPreview(true)}>이미지 미리보기 (원본 이미지 서버에 요청)</button>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{material.images.map(url => <label key={url} className="break-all rounded border p-2 text-xs">
          <input type="checkbox" checked={selected.includes(url)} onChange={e => { setSelected(e.target.checked ? [...selected, url] : selected.filter(x => x !== url)); setConfirmed(false); }} /> 가져올 이미지
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview && <img src={url} alt="상품 이미지 미리보기" referrerPolicy="no-referrer" className="h-32 w-full object-contain" />}
          <p>{url}</p>
        </label>)}</div>
        <label className="block">원본 제휴 링크 보존 (선택)<input type="url" value={affiliate} onChange={e => { setAffiliate(e.target.value); setConfirmed(false); }} className="block w-full rounded border p-2" /></label>
        <p>제휴 링크는 상품 페이지에서 역으로 알아낼 수 없습니다. 본인이 발급받은 원본을 입력하고 같은 상품인지 확인하세요. 모든 원본 항목은 위 출처·수집 시각을 공유하며 광고·AI 사용 권한은 미확인 상태로 보존됩니다.</p>
        <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />같은 상품·옵션인지 확인하고 개인정보·일반 안내 문구를 제거했습니다. 다음 화면에서 상품 정보와 이미지 사용 권한을 다시 확인하겠습니다.</label>
        <button disabled={!confirmed || busy} onClick={() => void send()} className="rounded border p-3 disabled:opacity-40">{busy ? "가져오는 중…" : "확인한 자료 가져오기"}</button>
      </div>}
    </section>
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </main>;
}
