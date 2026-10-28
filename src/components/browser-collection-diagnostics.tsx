import type { BrowserCollectionDiagnostics } from "@/lib/browser-product";

const names = { title: "상품명", price: "가격", brand: "브랜드", options: "옵션", description: "상세설명", specifications: "제품 사양", images: "이미지", reviews: "구매평 본문", rating: "평점", reviewCount: "전체 리뷰 수" };
const methods = { visible_dom: "표시된 상품 영역", public_metadata: "공개 메타데이터 참고", manual_selection: "화면 직접 선택으로 보완", user_edit: "사용자가 직접 수정", unconfirmed: "미확인" };
const paths = { legacy_selector: "기존 상품 요소", metadata: "공개 메타데이터", caption_heading: "표시 제목/페이지 제목 비교", product_region: "상품 영역 복수 단서", sale_price: "판매가 문맥", product_summary: "상품 평점·리뷰 요약", review_tab: "열린 리뷰 영역", selected_control: "선택 상태 컨트롤", manual: "수동", unconfirmed: "경로 미확인" };
const confidence = { corroborated: "복수 단서 일치 · 원본 확인 필요", candidate: "후보 · 원본 비교 필요", user_provided: "사용자 보완 · 자동 수집 아님", unconfirmed: "미확인" };

export function BrowserCollectionDiagnosticsView({ diagnostics: d }: { diagnostics?: BrowserCollectionDiagnostics }) {
  if (!d) return <p className="rounded border p-3 text-sm">이 자료에는 새 진단 정보가 없습니다. 기존 즐겨찾기를 삭제하고 버전 2026-10-28.5 버튼을 다시 등록해 주세요. 이전 파일도 직접 보완해 사용할 수 있습니다.</p>;
  return <section className="space-y-2 rounded border p-4">
    <h3 className="font-semibold">페이지 수집 진단 · {d.collectorVersion}</h3>
    <p className="text-sm">{d.platform === "naver" ? "네이버" : "쿠팡"} 상품 {d.productId} · 문서 {d.pageState} · 최상위 탭 {d.topFrame ? "예" : "아니요"}</p>
    <p className="text-sm">자동 추출 당시: 상품명 선택자 일치 {d.counts.titleMatches}개 / 가격 {d.counts.priceMatches}개 / 상세 영역 {d.counts.detailRoots}개 / 리뷰 후보 {d.counts.reviewMatches}개</p>
    <p className="text-sm">화면에 로드된 이미지 {d.counts.visibleImages}개 · 상품 이미지 후보 {d.counts.productImages}개 · 보이는 구매평 {d.counts.visibleReviews}개 · iframe {d.counts.frames}개 (DOM 접근 가능 {d.counts.readableFrames}개)</p>
    {d.automaticAssessmentRecorded ? <p>자동 추출 당시(수동 보완 제외): 상품명 {d.counts.autoTitle ? "찾음" : "미확인"} / 가격 {d.counts.autoPrice ? "찾음" : "미확인"} / 대표 이미지 {d.counts.autoPrimaryImage ? "찾음" : "미확인"}</p> : <p>이전 자료에는 자동 추출 성과가 별도 기록되지 않았습니다. 새 버전으로 다시 읽어 주세요.</p>}
    <p className="text-sm">표시 제목 요소 {d.counts.rawHeadingElements} / 통화 표시 요소 {d.counts.visibleCurrencyNodes} (중복 포함 관찰값)</p>
    <p className="text-sm">제목 후보 {d.counts.headingCandidates} / 구매 버튼 {d.counts.purchaseControls} / 상품 영역 {d.counts.productRegions} / 영역 충돌 {d.counts.ambiguousRegions} / 혜택 금액 제외 {d.counts.excludedBenefitPrices}</p>
    <p className="text-sm">대표 {d.counts.primaryImages} / 추가 {d.counts.additionalImages} / 상세 {d.counts.detailImages} · 이미지 호스트 제외 {d.counts.imageHostRejected} / 범위 제외 {d.counts.imageScopeRejected} · 리뷰 탭 {d.counts.reviewTabOpen ? "열림 단서 있음" : "열림 미확인"}</p>
    {d.structure && <details className="text-sm"><summary>개인정보 없는 DOM 구조 진단</summary><p>화면 이미지 {d.structure.images.length}개의 조상 태그·이미지 수, 상세/리뷰 표지 {d.structure.controls.length}개의 연결 상태만 기록합니다. 원문·임의 클래스명·작성자·주소는 포함하지 않습니다. 고정 목록의 의미 있는 클래스, 속성 종류와 익명 노드 연결만 기록합니다.</p><pre className="max-h-64 overflow-auto">{JSON.stringify(d.structure, null, 2)}</pre></details>}
    {d.structure?.evidence && <p className="text-sm">이미지 주소 진단: {d.structure.evidence.imageChecks.map((v,i) => `${i+1}번 ${v.host} / ${v.reason} / 쿼리 ${v.query}`).join(' · ')}. 호스트 제외 수는 주소 검사 실패 전체의 호환용 합계입니다. 이 진단으로 실제 리다이렉트 이력을 알 수는 없습니다.</p>}
    <ul className="list-disc pl-5 text-sm">{d.fields.map(f => <li key={f.name}>{names[f.name]}: {methods[f.method]} · {paths[f.path] || "경로 미확인"} · {confidence[f.confidence] || "미확인"}</li>)}</ul>
    {d.pageState !== "complete" && <p>페이지가 로딩 중이었습니다. 로딩 후 북마클릿에서 현재 페이지를 다시 읽으세요.</p>}
    <p className="text-sm">문서 complete도 동적 상품 영역의 준비 완료를 보장하지 않습니다. 상품 내용이 보인 뒤 다시 읽으세요.</p>
    {d.blockedPage && <p>접근 제한·보안 확인 문구 감지 결과입니다. 정상 상품 화면인지 확인하고, 제한은 우회하지 마세요.</p>}
    {d.metadataIdentity === "mismatch" && <p>페이지 주소와 메타데이터 상품이 다릅니다. 페이지 전환이 끝난 뒤 다시 읽으세요.</p>}
    {!d.counts.autoTitle && !d.counts.autoPrice && <p>상품 영역 단서가 부족하거나 구조·렌더링 차이가 있을 수 있습니다. 진단 파일로 자동 탐색 실패를 확인하세요. 직접 선택은 보조 수단이며 자동 수집 성공을 뜻하지 않습니다.</p>}
    {!!(d.counts.ambiguousRegions || d.counts.ambiguousPrices) && <p>복수 상품·판매가 후보가 충돌해 자동 확정하지 않았습니다.</p>}
    {!d.counts.detailRoots && <p>상세정보를 펼치고 다시 읽으세요. 이미 펼쳤는데도 0이면 새 구조 진단 파일을 전달해 주세요. 설명이 이미지 안에만 있으면 텍스트 추출은 지원하지 않습니다.</p>}
    {!d.counts.productImages && <p>상품 사진을 화면에 보이게 한 뒤 다시 읽거나 화면 이미지 직접 선택을 이용하세요. 미지원 호스트·배경 이미지·iframe 사진은 권한 있는 파일을 직접 업로드하세요.</p>}
    {!d.counts.visibleReviews && <p>구매평 탭에서 본문이 보이도록 펼치세요. 여전히 수집되지 않으면 본문 하나만 직접 선택하세요. 작성자·안내 문구는 제외해야 합니다.</p>}
    {!!d.counts.frames && <p>iframe 존재만으로 상품 자료 위치를 확정할 수 없습니다. 다른 출처 또는 아직 로드되지 않은 iframe 내부는 읽지 않습니다.</p>}
    <p className="text-xs text-muted-foreground">관찰 당시의 진단값이며 플랫폼 검증 완료 표시가 아닙니다. 복수 단서 일치도 독립 검증을 뜻하지 않습니다. 전체 리뷰 수는 가져온 본문 수와 다릅니다. 상품 정보·실제 구매 여부·옵션 일치·미디어 권한은 별도로 확인하세요.</p>
  </section>;
}
