// 보조 메뉴 바(서브탭 줄)
import { $ } from './dom.js';

// FM 상단 컨텍스트: 뒤로/앞으로, 서브탭 줄, 하단 상태 줄

const subSlot = $('#subSlot');
// el 을 보조 메뉴 바로 옮김(null 이면 비움). 링크는 그대로 동작합니다.
function setSubTabs(el) {
  subSlot.replaceChildren(...(el ? [el] : []));
}

export { setSubTabs };
