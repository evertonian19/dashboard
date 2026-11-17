// 할 일 (메인 화면 카드와 Menu 7 공용)
import { api, jsonBody } from '../core/api.js';
import { $, esc, fill, toast } from '../core/dom.js';
import { icon } from '../core/icons.js';

/* ------------------------------------------------------------------
   할 일 (메인 화면 카드와 Menu 7 공용)
------------------------------------------------------------------- */
const fmtDue = (d) => { const [, m, day] = d.split('-'); return `${Number(m)}월 ${Number(day)}일`; };
const PRIORITY = ['보통', '높음', '긴급'];
function todoRow(t, today) {
  const late = !t.done && t.due && t.due < today, now = t.due === today;
  return `
    <li class="row todo${t.done ? ' done' : ''}">
      <input type="checkbox" class="check" data-todo="${t.id}" ${t.done ? 'checked' : ''} aria-label="${esc(t.title)} 완료">
      <div class="row-main"><p class="row-title" title="${esc(t.title)}">${esc(t.title)}</p></div>
      ${t.priority ? `<span class="chip ${t.priority === 2 ? 'del' : 'add'}">${PRIORITY[t.priority]}</span>` : ''}
      ${t.due ? `<span class="chip ${late ? 'del' : now ? 'add' : ''}">${late ? '지남 · ' : ''}${now ? '오늘' : fmtDue(t.due)}</span>` : ''}
      <button class="icon-btn icon-btn-sm" type="button" data-todo-del="${t.id}" aria-label="${esc(t.title)} 삭제" title="삭제">${icon('close')}</button>
    </li>`;
}
function wireTodos(el, reload) {
  el.addEventListener('change', async (e) => {
    const box = e.target.closest('[data-todo]');
    if (!box) return;
    try { await api(`/todos/${box.dataset.todo}`, jsonBody({ done: box.checked })); }
    catch (err) { toast(err.message, true); }
    reload();
  });
  el.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-todo-del]');
    if (!btn) return;
    try { await api(`/todos/${btn.dataset.todoDel}`, { method: 'DELETE' }); }
    catch (err) { toast(err.message, true); }
    reload();
  });
}

function renderTodos(menu) {
  return `
    <header class="page-head">
      <div>
        <p class="eyebrow">${esc(menu.label)}</p>
        <h1 class="page-title">할 일</h1>
        <p class="page-desc">기한과 우선순위를 정해 두면 메인 화면에 오늘 할 일이 표시돼요.</p>
      </div>
    </header>
    <form class="card todo-form" id="todoForm">
      <input class="field" id="todoTitle" type="text" maxlength="200" placeholder="할 일" aria-label="할 일" autocomplete="off" required>
      <input class="field" id="todoDue" type="date" aria-label="기한">
      <select class="field" id="todoPriority" aria-label="우선순위">${PRIORITY.map((p, i) => `<option value="${i}">${p}</option>`).join('')}</select>
      <button class="btn btn-blue" type="submit">${icon('plus')} 추가</button>
    </form>
    <section class="card" style="margin-top:16px">
      <div class="card-head"><h2 class="card-title">진행 중</h2><span class="muted" id="todoOpenCount"></span></div>
      <ul class="rows" id="todoOpen"><li class="empty-inline">불러오는 중…</li></ul>
    </section>
    <section class="card" style="margin-top:16px">
      <div class="card-head"><h2 class="card-title">완료</h2><span class="muted" id="todoDoneCount"></span></div>
      <ul class="rows" id="todoDone"></ul>
    </section>`;
}

function mountTodos() {
  const load = async () => {
    try {
      const { todos, today } = await api('/todos');
      if (!$('#todoOpen')) return;
      const open = todos.filter((t) => !t.done);
      const done = todos.filter((t) => t.done).sort((a, b) => (b.done_at || '').localeCompare(a.done_at || ''));
      $('#todoOpenCount').textContent = open.length ? `${open.length}개` : '';
      $('#todoDoneCount').textContent = done.length ? `${done.length}개` : '';
      $('#todoOpen').innerHTML = open.map((t) => todoRow(t, today)).join('') || '<li class="empty-inline">할 일이 없어요.</li>';
      $('#todoDone').innerHTML = done.map((t) => todoRow(t, today)).join('') || '<li class="empty-inline">완료한 일이 여기에 모여요.</li>';
    } catch (e) { fill('#todoOpen', `<li class="empty-inline">${esc(e.message)}</li>`); }
  };
  wireTodos($('#todoOpen'), load);
  wireTodos($('#todoDone'), load);
  $('#todoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/todos', jsonBody({ title: $('#todoTitle').value, due: $('#todoDue').value, priority: Number($('#todoPriority').value) }));
      $('#todoTitle').value = '';
      $('#todoTitle').focus();
      load();
    } catch (err) { toast(err.message, true); }
  });
  load();
}

export { mountTodos, renderTodos, todoRow, wireTodos };
