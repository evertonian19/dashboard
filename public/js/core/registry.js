// 메뉴 목록(이름·아이콘). 화면 연결은 shell/menus.js

/* ------------------------------------------------------------------
   메뉴 정의 — 이름을 바꾸거나 메뉴를 추가하려면 이 배열만 고치면 됩니다.
   id    : 주소에 쓰이는 값 (#menu1)
   label : 메뉴바에 보이는 이름
   icon  : 아래 ICONS 의 키
   render: 화면 틀을 HTML 문자열로 돌려주는 함수 (없으면 빈 화면)
   mount : 화면이 그려진 직후 실행 — 서버에서 데이터를 받아 채웁니다 (선택)
   wide  : true 면 본문을 화면 폭 전체로 사용
------------------------------------------------------------------- */
// render / mount 는 shell/menus.js 에서 연결합니다 (뷰 → 셸 순환 import 를 피하려고 나눴습니다).
const MENUS = [
  { id: 'menu1', label: 'Menu 1', icon: 'home' },
  { id: 'menu2', label: 'Menu 2', icon: 'grid' },
  { id: 'menu3', label: 'Menu 3', icon: 'note' },
  { id: 'menu4', label: 'Menu 4', icon: 'folder' },
  { id: 'menu5', label: 'Menu 5', icon: 'gear', foot: true },  // 메뉴바 맨 아래 톱니바퀴
  { id: 'menu6', label: 'Menu 6', icon: 'mail' },
  { id: 'menu7', label: 'Menu 7', icon: 'check' },
];
MENUS.forEach((m) => { m.base = m.label; });
const menuName = (id) => MENUS.find((m) => m.id === id)?.label || '';
const KIND_MENU = { diagram: 'menu2', document: 'menu4' };
const KIND_LABEL = { diagram: '다이어그램', document: '문서', post: '게시글', comment: '댓글', mail: '메일 계정' };

export { KIND_LABEL, KIND_MENU, MENUS, menuName };
