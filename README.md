# dashboard

개인용 대시보드. 파이썬 표준 라이브러리만 쓰는 서버(의존성 설치 없음)와 빌드 과정이 없는 바닐라 JS 프론트엔드로 이루어져 있습니다.
메인 화면(할 일 · 메모 · 즐겨찾기 · 날씨 · 서버 상태 · Claude 사용량), 다이어그램, 게시판, 문서, 메일 확인, 설정을 한곳에서 봅니다.
화면은 Football Manager 27의 상단 메뉴 바 구조를 따랐습니다.

## 실행

```bash
python3 server.py set-login 아이디      # 로그인 계정 만들기 (비밀번호는 입력창으로 받음)
python3 server.py                       # http://127.0.0.1:8080
```

로그인하지 않으면 모든 화면이 로그인 페이지로 이동하고 모든 API가 401을 돌려줍니다. 기본적으로 이 컴퓨터(127.0.0.1)에서만 접속됩니다.

| 환경 변수 | 기본값 | 설명 |
|---|---|---|
| `HOST` | `127.0.0.1` | 바인드 주소 |
| `PORT` | `8080` | 포트 |
| `DASHBOARD_DATA` | `./data` | 데이터베이스와 업로드 파일 위치 (git에서 제외됨) |
| `CLAUDE_DIR` | `~/.claude/projects` | Claude Code 로그 위치 (토큰 사용량 집계) |
| `CLAUDE_USAGE_FILE` | `~/.claude/dashboard-usage.json` | Claude Code 상태 줄이 저장하는 공식 한도 정보 |
| `OCI_DIR` | `~/oci-oke` | OCI 노드풀 재시도 로그 위치 (없으면 해당 카드는 비어 있음) |
| `SOFFICE` | 자동 탐색 | LibreOffice 실행 파일 (문서 → PDF 변환, 없으면 변환 버튼이 나타나지 않음) |

## 구조

```
server.py                 진입점 (서버 시작, set-login 명령, 백그라운드 작업 시작)
backend/                  서버: 기능별 모듈
  config.py db.py         경로·제한·파일 종류 / SQLite 연결·스키마·공통 도구
  bootstrap.py            시작 시 초기화 (테이블 생성 + 오래된 휴지통 비우기)
  auth.py                 로그인 (PBKDF2 해시, 세션 쿠키, 시도 횟수 제한, 공개 경로)
  sanitize.py             게시글 HTML 허용 목록 정리
  trash.py pdf.py filenames.py
  mail.py weather.py oci.py system.py usage.py jobs.py
  api/                    HTTP 처리
    handler.py            라우팅 표, 로그인/세션, 정적 파일
    board.py files.py todos.py mail.py settings.py weather.py summary.py   기능별 Mixin
public/                   브라우저에 내려가는 파일 (login.* 를 뺀 나머지는 로그인 필요)
  index.html login.html
  js/
    main.js               진입점 (type="module")
    core/                 api, dom, format, state, registry(메뉴 목록), hooks, uploads …
    views/                메뉴별 화면: home todos usage settings diagrams documents board mail empty
    shell/                메뉴 연결, 좌측/상단 메뉴, 화면 전환, 레이아웃, 테마, 검색, 세션
  css/                    base → layout → components → views → fm-theme → responsive → fm-layout → favorites
tests/smoke_api.py        API 회귀 스크립트
```

### 새 메뉴 추가
1. `public/js/views/` 에 `renderXxx(menu)`(화면 틀 HTML)와 `mountXxx(menu, params)`(데이터 채우기)를 만듭니다.
2. `public/js/core/registry.js` 의 `MENUS` 에 `{ id, label, icon }` 를 추가합니다.
3. `public/js/shell/menus.js` 의 `VIEWS` 에 `render` / `mount` 를 연결합니다.

뷰는 셸을 직접 import 하지 않습니다(순환 방지). 화면을 다시 그려야 하면 `core/hooks.js` 의 `hooks.show()` 를 씁니다.

### CSS 순서
뒤에 오는 스타일시트가 앞의 규칙을 덮어쓰므로 `index.html` 과 `login.html` 의 `<link>` 순서를 바꾸면 안 됩니다.

## 테스트

`tests/smoke_api.py` 는 고정된 API 호출을 실행하고 id·시각을 치환한 기록을 출력합니다. 두 버전의 기록을 `diff` 하면 리팩터링 전후 동작이 같은지 확인할 수 있습니다.
**반드시 임시 데이터 디렉터리**에서 실행하세요 (글·파일 등을 만들고 지웁니다).

```bash
export DASHBOARD_DATA=/tmp/dash-test PORT=8102
python3 -c "import server; server.set_login('tester', 'pw-12345-test')"
python3 server.py &
python3 tests/smoke_api.py http://127.0.0.1:8102 tester pw-12345-test > out.txt
```

## 데이터와 비밀 정보

계정 해시(`auth.json`), 메일 앱 비밀번호(`mail-accounts.json`), 데이터베이스, 업로드 파일은 모두 `data/` 에 저장되며 `.gitignore` 로 제외됩니다. 이 디렉터리는 저장소에 올리지 마세요.
