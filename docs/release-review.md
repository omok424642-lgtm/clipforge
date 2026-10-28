# 상품 가져오기 기능: 변경 검토 및 전달 기록

기준일: 2026-10-28, 한국 시간. 대상 저장소: `omok424642-lgtm/clipforge`.

## 브랜치와 기존 작업 보존

- 기준 main: `1aab133dd75f4db57c3f62e6da2fdd121c5d509b`. 원격 main도 같은 커밋임을 읽기 확인했다.
- 검토 브랜치: `feat/reviewed-browser-product-import`.
- 원래 `/workspace/clipforge`의 `work` 브랜치에는 이전 상품 수집·시즌 추천과 이번 북마클릿 변경이 함께 미커밋 상태였다. 외부 작업으로 보이는 추가 변경이나 미해결 병합 충돌은 발견하지 않았다.
- 원본 파일을 덮어쓰거나 stash/reset하지 않고 `/workspace/clipforge-review` 별도 worktree에 복사해 정리했다. 최초 확인한 31개 변경 파일의 SHA-256을 대조해 원본 보존 여부를 확인한다.
- 북마클릿이 기존 상품 수집 계약과 보관함·검토 화면에 의존하므로 선행 상품 수집·시즌 추천을 첫 커밋, 북마클릿과 Windows 안내를 두 번째 커밋으로 구분한다. 기존 기능을 PR에서 빠뜨려 깨진 상태로 올리지 않는다.

## 무엇을 유지했고 무엇을 변경했는가

| 영역 | 점검 결과 |
| --- | --- |
| 영상 대본·AI 음성·자막·FFmpeg 합성 엔진 | 해당 엔진 파일 수정 없음. 실제 Windows 렌더링 보장이나 새 한국어 파이프라인 완성을 뜻하지 않음 |
| 기존 상품 보관함 | CRUD/기존 저장소 유지. 선택적 상품 출처·제휴 확인 메타데이터와 새 화면 링크 추가 |
| 시즌 추천 | 앞서 구현한 기능을 선행 커밋에 보존. 외부 검색량·판매량 생성 없음 |
| 기존 상품 링크 수집 API | **의도적 동작 변경 있음**: 네이버·쿠팡 주소는 자동 수집/제작 대신 409와 검토 화면 경로를 반환. 다른 플랫폼 경로를 삭제하지 않음 |
| 네이버 쇼핑 검색 API | **의도적 차단**: 종료된 API는 설정/인증 정보가 있어도 호출하지 않음. 저장된 과거 식별자는 호환성 유지 |
| 프로젝트 생성·제작 시작 화면 | 선택적 상품 참조와 제작 이력 연결 추가. DB 스키마 마이그레이션 없음. 상품 참조 없는 기존 요청도 지원 |
| 새 브라우저 가져오기 | 사용자 확인 후 파일로 내보내기, 한국어 수정, 출처·수집 시각, 원본 제휴 링크, 중복 제거, 이미지 선택·권한 확인 후 보관함 저장 |
| 영상·구매평 처리 | 영상 존재 여부만 기록. 영상 다운로드·자동 편집·구매평 AI 분석·광고 원문 전재 기능은 추가하지 않음 |
| 의존성·배포 | package.json/lockfile/기존 CI/Release workflow 변경 없음. 데이터·쿠키·API 비밀·node_modules·빌드 산출물은 커밋 대상 아님 |

따라서 “기존 기능을 전혀 변경하지 않았다”는 표현은 정확하지 않다. 위 호환성 연결과 접근 제한 보호 변경을 포함하며, 기존 영상 처리 엔진은 그대로 유지했다. 삭제된 파일은 없다.

## 검증 범위

- 앞선 최종 실행: 전체 **145개 파일 / 1,431개 테스트 통과**. TypeScript와 프로덕션 빌드 통과, 전체 lint 오류 0개/기존 경고 20개.
- 이번 정리 중 선행 커밋: TypeScript 및 상품 수집·이미지·시즌·이력 테스트 **100개 통과**.
- 최종 브랜치 재실행: **145개 파일 / 1,431개 테스트 통과**, TypeScript 통과, lint 오류 0개/기존 경고 20개. 프로덕션 빌드도 다시 통과했다. 빌드는 이미 의존성을 설치한 원래 실행 폴더에서 수행했고, 브랜치의 모든 변경 `src` 파일과 원래 실행 폴더가 바이트 단위로 동일함을 확인했다.
- 앞선 Chromium 검증 9개 흐름: 프로덕션 북마클릿 실행, 쿠팡 예제 자료 추출·리뷰 중복 제거, 자동 자료 전송 없음, 확인 후 파일 저장, 한국어 수정·제휴 링크 보존, 권한 확인·로컬 이미지 업로드·저장, 보관함·서버 원본 저장, 다시 열기, 네이버 예제 자료 추출.
- 네이버·쿠팡 DOM은 **예제 HTML**이었다. 실제 쇼핑커넥트 링크 도착 화면, 실제 운영 상품 페이지의 선택자 호환성·사진 다운로드, 실제 구매 인증/옵션별 리뷰, 플랫폼 현재 이용 조건·미디어 재사용 권한, Windows 설치·실행·실제 렌더링은 **미검증**이다. 테스트 통과로 이를 검증 완료라고 표시하지 않는다.
- 이미지 미리보기는 해당 이미지 서버에 요청할 수 있다. 자유 서술의 모든 이름·주소를 자동 제거할 수 없으므로 사용자 확인이 필수다. 리뷰 작성자 요소·쿠키·인증 저장소는 수집하지 않는다.

## Windows 전달

[처음 설치부터 보관함 저장까지](windows-browser-import-test.md)에 Node 22/pnpm 10.33.0/FFmpeg·FFprobe, ZIP 또는 Git 브랜치 받기, 실행 명령, 즐겨찾기 등록, 실제 플랫폼별 미검증 체크리스트를 정리했다. 북마클릿 자체에는 확장 프로그램·API 인증이 필요 없다. 기존 `.exe` 자동 업데이트는 없으며 새 Windows 설치 파일은 제작하지 않았다.

## GitHub 전달 상태

현재 제공된 `GH_TOKEN`은 `gh auth status`에서 유효하지 않다고 보고되었다. 토큰은 출력하거나 파일에 저장하지 않았다. 로컬 브랜치·커밋을 준비한 뒤 푸시를 시도하며, 실제 성공/실패는 마지막 작업 보고와 원격 조회 결과를 기준으로 판단한다. 이 문서 자체는 PR 생성이나 GitHub 반영의 증거가 아니다. PR이 생성되지 않았으면 주소를 만들어 기재하지 않는다.


## 변경 파일 전체 목록 (33개)

```text
docs/browser-product-import.md
docs/korean-commerce-import.md
docs/release-review.md
docs/seasonal-discovery.md
docs/windows-browser-import-test.md
src/app/api/discovery/history/route.ts
src/app/api/ingest/commerce/route.ts
src/app/api/ingest/product/route.ts
src/app/api/project/route.ts
src/app/discover/page.tsx
src/app/products/browser/page.tsx
src/app/products/import/page.tsx
src/app/products/page.tsx
src/app/project/new/page.tsx
src/app/start/page.tsx
src/components/app-shell.tsx
src/components/season-discovery.tsx
src/lib/__tests__/browser-product-route.test.ts
src/lib/__tests__/browser-product.test.ts
src/lib/__tests__/commerce-images.test.ts
src/lib/__tests__/commerce-product.test.ts
src/lib/__tests__/discovery-history.test.ts
src/lib/__tests__/seasonal-discovery.test.ts
src/lib/browser-product.ts
src/lib/commerce-collection.ts
src/lib/commerce-images.ts
src/lib/commerce-product.ts
src/lib/commerce-review.ts
src/lib/commerce-storage.ts
src/lib/discovery-products.ts
src/lib/product-bookmarklet.ts
src/lib/seasonal-discovery.ts
src/lib/stores/product-library-store.ts
```
