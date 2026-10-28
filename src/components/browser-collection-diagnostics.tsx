import type { BrowserCollectionDiagnostics } from "@/lib/browser-product";

const names = { title: "상품명", price: "가격", brand: "브랜드", options: "옵션", description: "상세설명", specifications: "제품 사양", images: "이미지", reviews: "구매평", rating: "평점" };
const methods = { visible_dom: "표시된 상품 영역", public_metadata: "공개 메타데이터 참고", manual_selection: "화면 직접 선택으로 보완", user_edit: "사용자가 직접 수정", unconfirmed: "미확인" };

export function BrowserCollectionDiagnosticsView({ diagnostics: d }: { diagnostics?: BrowserCollectionDiagnostics }) {
  if (!d) return <p className="rounded border p-3 text-sm">이 자료에는 새 진단 정보가 없습니다. 기존 즐겨찾기를 삭제하고 버전 2026-10-28.2 버튼을 다시 등록해 주세요. 이전 파일도 직접 보완해 사용할 수 있습니다.</p>;
  return <section className="space-y-2 rounded border p-4">
    <h3 className="font-semibold">페이지 수집 진단 · {d.collectorVersion}</h3>
    <p className="text-sm">{d.platform === "naver" ? "네이버" : "쿠팡"} 상품 {d.productId} · 문서 {d.pageState} · 최상위 탭 {d.topFrame ? "예" : "아니요"}</p>
    <p className="text-sm">자동 추출 당시: 상품명 선택자 일치 {d.counts.titleMatches}개 / 가격 {d.counts.priceMatches}개 / 상세 영역 {d.counts.detailRoots}개 / 리뷰 후보 {d.counts.reviewMatches}개</p>
    <p className="text-sm">화면에 로드된 이미지 {d.counts.visibleImages}개 · 상품 이미지 후보 {d.counts.productImages}개 · 보이는 구매평 {d.counts.visibleReviews}개 · iframe {d.counts.frames}개 (DOM 접근 가능 {d.counts.readableFrames}개)</p>
    <ul className="list-disc pl-5 text-sm">{d.fields.map(f => <li key={f.name}>{names[f.name]}: {methods[f.method]}</li>)}</ul>
    {d.pageState !== "complete" && <p>페이지가 로딩 중이었습니다. 로딩 후 북마클릿에서 현재 페이지를 다시 읽으세요.</p>}
    <p className="text-sm">문서 complete도 동적 상품 영역의 준비 완료를 보장하지 않습니다. 상품 내용이 보인 뒤 다시 읽으세요.</p>
    {d.blockedPage && <p>접근 제한·보안 확인 문구 감지 결과입니다. 정상 상품 화면인지 확인하고, 제한은 우회하지 마세요.</p>}
    {d.metadataIdentity === "mismatch" && <p>페이지 주소와 메타데이터 상품이 다릅니다. 페이지 전환이 끝난 뒤 다시 읽으세요.</p>}
    {!d.counts.titleMatches && !d.counts.priceMatches && <p>기존 상품 선택자와 일치하는 영역이 없습니다. 구조 차이 또는 렌더링 지연일 수 있습니다. 공개 메타데이터 후보를 비교하고, 북마클릿의 화면 글자 직접 선택으로 보완하세요.</p>}
    {!d.counts.detailRoots && <p>상세정보를 펼치고 다시 읽으세요. 설명이 이미지 안에만 있으면 텍스트 추출은 지원하지 않습니다.</p>}
    {!d.counts.productImages && <p>상품 사진을 화면에 보이게 한 뒤 다시 읽거나 화면 이미지 직접 선택을 이용하세요. 미지원 호스트·배경 이미지·iframe 사진은 권한 있는 파일을 직접 업로드하세요.</p>}
    {!d.counts.visibleReviews && <p>구매평 탭에서 본문이 보이도록 펼치세요. 여전히 수집되지 않으면 본문 하나만 직접 선택하세요. 작성자·안내 문구는 제외해야 합니다.</p>}
    {!!d.counts.frames && <p>iframe 존재만으로 상품 자료 위치를 확정할 수 없습니다. 다른 출처 또는 아직 로드되지 않은 iframe 내부는 읽지 않습니다.</p>}
    <p className="text-xs text-muted-foreground">관찰 당시의 진단값이며 서버의 검증 완료 표시가 아닙니다. 공개 메타데이터 가격은 선택 옵션과 다를 수 있습니다. 상품 정보·실제 구매 여부·옵션 일치·미디어 권한은 별도로 확인하세요.</p>
  </section>;
}
