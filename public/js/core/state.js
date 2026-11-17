// 화면 사이에서 공유하는 상태: 서버 설정, 정리할 타이머

// 서버에서 받은 설정(파일 종류, 메뉴 이름, 메인 화면 카드 등). 모듈끼리 같은 객체를 보도록 속성만 바꿉니다.
const config = { kinds: {}, max_upload: 0, menus: {}, home: {}, trash_days: 30, pdf_sources: [] };

// 화면을 떠날 때 정리할 타이머들
const lifecycle = { cleanups: [] };
const every = (ms, fn) => { const t = setInterval(fn, ms); lifecycle.cleanups.push(() => clearInterval(t)); };
// 화면을 떠날 때 모든 정리 작업을 실행하고 목록을 비웁니다.
function runCleanups() { lifecycle.cleanups.forEach((fn) => fn()); lifecycle.cleanups = []; }

export { config, every, lifecycle, runCleanups };
