# 대표 이미지 후보 단계 추적 — 2026-10-28.6

## 확인한 사실과 아직 모르는 사실

사용자가 제공한 img는 draggable=false, 임의 CSS 클래스, shop-phinf.pstatic.net의 PNG src와 type=m10000_10000_no_rotate 쿼리로 구성된다.
이 주소는 기존 commerceImageAddress 정책에서도 허용된다. 주소 허용 목록과 공유 주소 정책 파일은 이번에 수정하지 않았다.
추출에 사용자 제공 클래스명이나 상품 번호·이미지 주소를 하드코딩하지 않았다. 제공한 실제 HTML은 회귀 테스트의 입력으로만 사용했다.

기존 query는 img 전체를 찾고 currentSrc **property**를 읽는다. img[currentSrc]라는 CSS 속성 선택자를 사용하지 않았다.
currentSrc는 HTML 속성이 아니므로 해당 선택자 결과 0개가 currentSrc property 없음의 근거는 아니다.

코드에서 확정한 진단 결함은 다음과 같다.
버전 .5의 visibleImages와 imageChecks는 rendered/onScreen/complete/naturalWidth 검사를 모두 통과한 이미지만 대상으로 했다.
대표 이미지가 숨김·제외 문맥·화면 밖·로딩 단계에서 탈락하면 진단에서도 누락됐다.
따라서 visibleImages=2, supportedVisibleImages=0은 대표 이미지 주소가 거부되었다는 증거가 아니다.
진단에 남은 2개가 다른 이미지일 수 있다.

제공한 태그 한 줄에는 조상 스타일, 화면 좌표, 실행 시각 currentSrc, 로딩 상태가 없다.
**실제 운영 페이지에서 대표 이미지가 탈락한 정확한 조건은 아직 확정하지 못했다.**
합성 페이지 성공을 실제 브랜드스토어 성공으로 보고하지 않는다.

## 수정

- 후보 필터 전의 document img를 별도로 추적한다. 앱 자신의 UI 이미지는 제외한다.
- 최대 200개를 기록하며 src가 허용된 이미지를 우선한다. 원래 DOM 순서의 index도 기록한다. 전체 rawImages와 기록 한도 제외 개수를 함께 표시한다.
- src/currentSrc 존재, URL 정책 통과 여부·사유, 선택한 property, resize 쿼리를 제외한 주소 지문을 구분한다. 전체 URL·경로·쿼리 값은 진단에 넣지 않는다.
- 표시 여부와 정확한 숨김 검사 사유(hidden_attribute/display_none/visibility_hidden/opacity_zero/no_rect), 제외 문맥(nav/header/aside 등), 화면 교차 여부·위치(above/below/left/right/inside/zero), 표시 크기를 기록한다.
- complete, naturalWidth/Height, loading 속성(lazy/eager/auto), 지연 로딩용 속성의 존재 여부만 기록한다. data-src 값은 읽거나 요청하지 않는다.
- 후기 영역, 다른 상품/광고 링크, 상품/상세 영역 포함 여부와 최종 이미지 역할을 구분한다.
- firstFailure는 visibility/context/size/viewport/loading/address/content_exclusion/scope/image_limit/page_guard 또는 collected다. collected도 저장 완료나 사용 권한 확인을 뜻하지 않는다.
- 기존 visibleImages 등의 의미는 유지한다. 새 필터 전 trace와 혼동하지 않는다. 이전 파일에 trace가 없으면 새 검사가 완료된 것으로 표시하지 않는다.
- 화면 안의 정상 브라우저 이미지 로딩을 최대 10초 관찰한다. load 이벤트 후 자동 재검사한다. src를 강제 설정하거나 lazy 속성을 변경하거나 스크롤·별도 요청을 하지 않는다.
- 이미 수정·승인했거나 상품·선택 옵션이 바뀌었으면 자동 교체하지 않는다. 로딩 이벤트 후 안내만 표시한다. 닫으면 관찰 이벤트를 해제한다.
- currentSrc가 허용되지 않는 placeholder인데 src만 허용돼도 임의로 src를 가져오지 않는다. 실제 로딩 후 새 상태에서 다시 검사한다.
- viewport/숨김/추천/후기/광고 제외 규칙과 상품명·판매가 추출 경로를 유지한다. offscreen 이미지를 이번에 수집 허용한 것은 아니다.

## Windows 재시험

1. 앱 종료 → 기존 폴더·data·.env 백업 → 새 코드 적용.
2. 처음 설치하기.cmd로 다시 빌드하고 쇼핑클립 시작하기.cmd로 실행한다.
3. 기존 즐겨찾기를 삭제하고 앱에서 다시 등록한다. 팝업 버전 **2026-10-28.6**을 확인한다.
4. 상품 상단에서 대표 이미지가 보이는 상태로 실행한다. 직접 선택은 하지 않는다. 첫 수집과 정상 이미지 로딩 후 자동 갱신 결과를 구분해 본다.
5. '개인정보 없는 진단 파일 저장'을 누른다. 상단 화면과 상세/구매평으로 스크롤한 화면의 파일을 각각 보관하면 비교할 수 있다.
6. 제공한 대표 이미지의 srcKey는 **53c5fed9**다. 이는 해당 공개 주소의 크기 조절 쿼리를 제외해 계산한 진단용 지문이며 보안 식별자가 아니다. 런타임 추출 조건으로 하드코딩하지 않았다.
7. JSON의 imageStages에서 이 srcKey를 찾고 firstFailure, visibilityReason, contextReason, viewportPosition, complete, naturalWidth, chosen, srcReason/currentReason을 확인한다.
8. 지문이 있으면 그 항목으로 정확한 탈락 단계를 좁힐 수 있다. 지문이 없으면 rawImages와 imageStagesTruncated부터 확인한다. DOM 변경·다른 문서/Shadow DOM·주소 변경 등은 별도 확인이 필요하며 원인이라고 단정하지 않는다.
9. 실패하면 진단 파일을 전달한다. 상품 설명·구매평 원문이 들어가는 상품 자료 JSON이나 전체 HTML 대신 진단 파일을 사용한다.

스크롤 후 다시 읽기는 새 관찰로 교체한다. 이전 화면 자료 자동 누적은 이번 변경에 포함하지 않았다.
실제 브랜드스토어·쿠팡 운영 페이지와 Windows 실행은 아직 검증하지 못했다. 시즌 추천·상품 보관함·영상 제작·Windows 실행 파일과 기존 데이터는 변경하지 않았다.

## 실행한 검증

148개 테스트 파일 / 1,545개 테스트 통과(16개 추가), TypeScript·변경 파일 ESLint·프로덕션 빌드 통과. 제공한 실제 src를 입력한 합성 DOM에서 일반 수집, currentSrc property와 속성 구분, 화면 밖·숨김·크기 0·로딩 중·깨진 이미지·문맥 제외·placeholder·범위 제외와 진단 개인정보 차단을 확인했다. 지연 로딩 자동 갱신과 사용자 수정/승인 보호도 검증했다.

실제 Chromium에서 프로덕션 웹앱이 제공하는 북마클릿으로 3개 기존 합성 상품 회귀, 자료 가져오기 저장, 제공 src의 자동 수집 및 필터 전 추적, 화면 밖/숨김 진단, 네트워크 응답을 지연한 이미지의 정상 load 이후 자동 갱신을 확인했다. 직접 선택/수정은 0회였다. 페이지 자체는 합성 HTML이므로 실제 운영 사이트 성공을 뜻하지 않는다.
