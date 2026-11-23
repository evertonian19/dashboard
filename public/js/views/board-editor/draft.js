// 게시판 편집기: 자동 임시저장 — 이 브라우저(localStorage)에 보관했다가 새로고침·실수로 나가도 복원할 수 있게 한다.
import { $, esc, toast } from '../../core/dom.js';
import { lifecycle } from '../../core/state.js';

// 임시저장본을 다시 넣을 때: 서버가 허용하는 태그·속성만 남긴다 (서버도 저장할 때 한 번 더 정리한다)
const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'SPAN', 'FONT', 'P', 'DIV', 'BR', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'IMG']);

export function cleanDraft(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');   // 파싱만 하므로 스크립트·이미지는 실행·로드되지 않는다
  const clean = (parent) => {
    [...parent.childNodes].forEach((n) => {
      if (n.nodeType !== 1) return;
      if (n.tagName === 'SCRIPT' || n.tagName === 'STYLE') { n.remove(); return; }
      clean(n);
      if (!ALLOWED_TAGS.has(n.tagName)) { n.replaceWith(...n.childNodes); return; }
      [...n.attributes].forEach((a) => {
        const ok = (a.name === 'style' && !/url\s*\(|expression/i.test(a.value))
          || (n.tagName === 'FONT' && (a.name === 'color' || a.name === 'size'))
          || (n.tagName === 'A' && a.name === 'href' && /^(https?:|mailto:|\/api\/files\/)/i.test(a.value))
          || (n.tagName === 'IMG' && a.name === 'src' && /^\/api\/files\/[0-9a-f]{12}\/raw$/.test(a.value));
        if (!ok) n.removeAttribute(a.name);
      });
      if (n.tagName === 'IMG' && !n.getAttribute('src')) n.remove();
    });
  };
  clean(doc.body);
  return doc.body.innerHTML;
}

const hhmm = (t) => new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
const hasContent = (d) => Boolean((d.title || '').trim() || (d.cat || '').trim() || (d.body || '').replace(/<[^>]*>|&nbsp;/g, '').trim() || /<img/i.test(d.body || ''));

// 글쓰기 화면에 임시저장을 붙인다. 돌려주는 touch() 는 본문이 바뀔 때(이미지 삽입 등) 불러 주고, finish() 는 글이 저장된 뒤 불러 임시저장본을 지운다.
export function attachDraft({ key, body, editing }) {
  const store = {
    read() { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } },
    write(v) { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (e) { return false; } },
    clear() { try { localStorage.removeItem(key); } catch (e) { /* 무시 */ } },
  };
  const snapshot = () => ({ title: $('#postTitle').value, cat: $('#postCat').value, body: body.innerHTML, at: Date.now() });
  let timer = 0, pending = false, paused = false, finished = false;
  const save = () => {
    clearTimeout(timer); pending = false;
    if (paused || finished) return;
    const d = snapshot();
    if (!hasContent(d)) { store.clear(); $('#draftStatus').textContent = ''; return; }
    if (store.write(d)) $('#draftStatus').textContent = `임시저장됨 ${hhmm(d.at)}`;
  };
  const touch = () => { if (paused || finished) return; pending = true; clearTimeout(timer); timer = setTimeout(save, 800); };
  lifecycle.cleanups.push(() => { clearTimeout(timer); if (pending) save(); });   // 화면을 떠날 때 아직 못 저장한 것을 마저 저장
  $('#postForm').addEventListener('input', touch);

  // 이전에 쓰다 만 글이 있으면 복원할지 묻는다 (고르기 전에는 새로 쓰는 내용으로 덮어쓰지 않는다)
  const old = store.read();
  const same = old && editing && old.title === $('#postTitle').value && (old.cat || '') === $('#postCat').value && old.body === body.innerHTML;
  if (same) store.clear();
  else if (old && hasContent(old)) {
    paused = true;
    const banner = $('#draftBanner');
    banner.hidden = false;
    banner.innerHTML = `<span>임시저장된 글이 있어요 (${esc(hhmm(old.at))})</span>
      <button class="btn btn-soft btn-sm" type="button" data-draft="restore">복원</button>
      <button class="btn btn-ghost btn-sm" type="button" data-draft="drop">버리기</button>
      <small>고르기 전에는 지금 쓰는 내용이 임시저장되지 않아요.</small>`;
    banner.addEventListener('click', (e) => {
      const act = e.target.closest('[data-draft]')?.dataset.draft;
      if (!act) return;
      if (act === 'restore') {
        $('#postTitle').value = old.title || '';
        $('#postCat').value = old.cat || '';
        body.innerHTML = cleanDraft(old.body);
        toast('임시저장된 글을 불러왔어요');
      } else store.clear();
      paused = false; banner.hidden = true; banner.innerHTML = '';
      if (act === 'restore') save();
    });
  }
  return { touch, finish() { finished = true; store.clear(); } };
}
