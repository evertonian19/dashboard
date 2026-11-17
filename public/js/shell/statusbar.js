// 뒤로/앞으로 버튼과 하단 상태 줄
import { $ } from '../core/dom.js';

$('#backBtn').addEventListener('click', () => history.back());
$('#fwdBtn').addEventListener('click', () => history.forward());
const sbClock = $('#sbClock');
const tickStatus = () => { sbClock.textContent = new Date().toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }); };
tickStatus();
setInterval(tickStatus, 30000);
