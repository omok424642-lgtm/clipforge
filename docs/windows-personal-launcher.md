# Windows 개인용 웹앱 실행기

사용 안내는 루트의 [윈도우 실행 안내.txt](../윈도우%20실행%20안내.txt)를 참고한다. 최신 main `89d8655`에서 시작한 추가 기능이며 기존 미커밋 작업 폴더는 건드리지 않았다.

브랜치 소스 ZIP: https://github.com/omok424642-lgtm/clipforge/archive/refs/heads/feat/windows-personal-launcher.zip

PR 생성 화면: https://github.com/omok424642-lgtm/clipforge/compare/main...feat/windows-personal-launcher?expand=1

새 실행기는 이 기능 브랜치에 있으며 main에 자동 병합하지 않는다. 위 주소는 PR 생성 화면이며 실제 PR 번호가 발급된 주소가 아니다.

## 실행 구조

- `처음 설치하기.cmd`: Node 확인 → 도구 점검 → 고정 pnpm 버전으로 frozen install → Node ABI SQLite 검사/필요 시 재빌드 → production build → standalone 정적 파일 복사 → 설치 상태 저장.
- `쇼핑클립 시작하기.cmd`: 사전 조건·소스/Node/빌드 상태 확인 → 기존 동일 앱 재사용 또는 고정 loopback 서버 시작 → 응답의 폴더 해시/실행 UUID 일치 확인 → Chrome 열기 → 서버 종료까지 콘솔 유지.
- Next standalone을 **일반 Node**로 실행한다. 기존 Electron 패키징 스크립트는 Electron ABI로 SQLite를 교체하므로 이 실행기에서 호출하지 않는다.
- `HOSTNAME=127.0.0.1`, `PORT=3100`을 자식 프로세스에 명시해 외부 바인딩 환경 변수를 덮어쓴다. 자동 포트 변경은 보관함의 origin을 바꾸므로 하지 않는다. 다른 프로세스를 종료하지 않는다.
- 이미 실행 중인 동일 폴더의 앱은 재사용한다. 다른 폴더/다른 프로그램의 리스너와 겹치거나 설치·시작 작업이 진행 중이면 안내하고 중단한다. 설치 중에는 실행 서버와 같은 작업 잠금을 사용한다.
- 기존 `APP_DATA_DIR`/`APP_MIGRATIONS_DIR`을 존중하고 미설정이면 각각 프로젝트 루트의 `data`/`drizzle`을 전달한다. standalone 서버의 작업 디렉터리 변경이 자료 경로를 바꾸지 않도록 한다. 자료나 기존 프로젝트 파일을 삭제하지 않는다.
- 기존 데이터 환경 변수의 상대 경로는 원래 프로젝트 루트에서 절대 경로로 고정한다. 설치된 Next의 표준 production `.env` 우선순위도 사용하며 설정 값을 로그에 출력하지 않는다.
- 설치 상태·진단 로그·잠금은 Git에서 제외한 `.clipforge-launcher`에만 기록한다. 상태 비교는 `src`, `public`, `drizzle`, 의존성·Next/TypeScript 설정 파일을 대상으로 하며 사용자 자료/로그는 제외한다. 코드/Node 주 버전/빌드 변경 시 재설치를 안내한다.
- Windows 경로를 쉘 문자열로 합치지 않는다. pnpm npm/Corepack CLI는 Node에 인수 배열로 전달하고, 독립 실행형 pnpm.exe도 지원한다. 한국어·공백·괄호·`&`·`!`가 있는 경로를 고려한다. CMD는 UTF-8/CRLF이며 지연 확장을 끈다.
- 준비 확인용 `/api/local-launcher`는 실행기가 전달한 환경 값이 있을 때만 응답한다. 사용자 데이터·DB·API 키·실제 경로를 반환하지 않는다. 일반 기존 서버에서는 404이다. 실행 UUID는 준비 확인 표식이며 로그인/보안 인증 토큰이 아니다.

## 검증과 한계

자동 테스트는 도구 검색·Node 버전·원본 자료 보존·소스 변경 감지·빌드 누락·잠금·포트 충돌·준비 확인을 검증한다. Linux 환경의 실제 standalone 서버 검증은 Windows의 설치·CMD 해석·크롬 프로세스 실행·Ctrl+C 동작을 대신하지 않는다.

2026-10-28 최종 결과:

- 전체 **147개 테스트 파일 / 1,460개 테스트 통과**. 신규 실행기·준비 확인 테스트 29개 포함.
- TypeScript 통과, production build 통과, Node 시작 스크립트 문법 검사 통과. 전체 lint 오류 0개/기존 경고 20개. 기존 lint 설정상 scripts는 앱 lint 대상 밖이므로 문법 검사와 전용 테스트로 검증했다.
- 실제 Node standalone 서버와 Chromium에서 준비 확인, `127.0.0.1` 전용 바인딩, 외부 네트워크 주소 접속 거절, 고정 3100 origin, 시즌 추천 화면, 상품 가져오기 화면/북마클릿 URL, 예제 보관함 새로고침 유지, 기존 예제 자료 파일의 바이트 보존, 브라우저 오류 없음 확인.
- 테스트 자료는 사용자 자료와 분리한 임시 폴더를 사용했다. 기존 앱·상품 보관함·시즌 추천·영상 엔진·의존성·DB 스키마·기존 CI 파일은 수정하지 않았다. 기존 파일 변경은 실행기 산출물 제외용 `.gitignore`뿐이며 새 준비 확인 API를 추가했다. 삭제 파일은 없다.
- 처음 빌드 시 테스트 환경에서 공유한 node_modules 심볼릭 링크가 Next의 폴더 경계 제약으로 실패했다. 별도 작업 폴더에 의존성을 복사한 최종 빌드는 정상 통과했다. 앱 설정이나 기존 소스를 우회 수정하지 않았다.

Windows 10/11에서 직접 확인해야 할 항목:

- [ ] Node 없는 PC의 한국어 안내 및 Node 22.x 설치 후 재실행
- [ ] pnpm·FFmpeg·FFprobe·Chrome 누락/경로 안내
- [ ] 한국어/공백/특수문자 경로에서 CMD 더블클릭
- [ ] 최초 frozen install, Windows 네이티브 SQLite 설치, production build
- [ ] 서버 준비 후 크롬 자동 열기와 같은 창의 상품 보관함 유지
- [ ] 시작 파일 재실행 시 서버 중복 생성 없음
- [ ] 다른 앱의 3100 포트와 충돌 시 기존 앱 유지
- [ ] Ctrl+C/콘솔 창 종료 후 앱 정리, 다음 실행
- [ ] 코드 업데이트/Node 주 버전 변경 시 재설치 안내
- [ ] 기존 자료·외부 APP_DATA_DIR 유지와 보관함 새로고침
- [ ] 실제 네이버·쿠팡 상품 자료 가져오기 및 실제 MP4 제작

스마트 앱 컨트롤·브라우저 보안·PowerShell 실행 정책 해제나 외부 포트 개방을 요구하지 않는다. 이는 설치 EXE 생성이나 자동 업데이트 기능이 아니며, 다른 origin/프로필/기존 Electron 보관함의 자동 이전도 하지 않는다.
