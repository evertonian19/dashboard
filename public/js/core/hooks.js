// 뷰 → 셸 연결점

// 화면(뷰)이 셸의 기능을 부를 때 쓰는 연결점입니다. 뷰 → 셸 직접 import 는 순환이 되므로,
// 시작할 때 main.js 가 실제 함수를 채워 넣습니다.
const hooks = { show() {}, applyMenuNames() {} };

export { hooks };
