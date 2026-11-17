// 삭제 확인 창
import { $ } from './dom.js';
import { config } from './state.js';

function confirmDelete(name, what = '파일', okLabel = '삭제') {
  const dlg = $('#confirmDialog');
  const days = config.trash_days || 30;
  const text = {
    '계정 연결': `"${name}" 연결을 해제합니다. 메일함의 메일은 그대로예요.`,
    '기록 전체': '최근 활동 기록을 모두 지웁니다. 파일과 게시글은 그대로예요.',
    '카테고리': `"${name}" 카테고리를 삭제합니다. 이 카테고리의 글은 지워지지 않고 미분류로 바뀌어요.`,
    '파일': `"${name}" 파일을 휴지통으로 옮깁니다. ${days}일 안에 설정 메뉴에서 복구할 수 있어요.`,
    '게시글': `"${name}" 게시글을 휴지통으로 옮깁니다. ${days}일 안에 설정 메뉴에서 복구할 수 있어요.`,
    '메모': `"${name}" 메모를 삭제합니다. 되돌릴 수 없어요.`,
    '영구 삭제': `"${name}" 항목을 완전히 삭제합니다. 되돌릴 수 없어요.`,
    '휴지통 비우기': '휴지통의 모든 항목을 완전히 삭제합니다. 되돌릴 수 없어요.',
  }[what] || `"${name}" ${what}을 삭제합니다. 되돌릴 수 없어요.`;
  $('#confirmTitle').textContent = what === '계정 연결' ? '연결을 해제할까요?' : what === '휴지통 비우기' ? '휴지통을 비울까요?' : '삭제할까요?';
  $('#confirmText').textContent = text;
  $('#confirmDialog .btn-danger').textContent = okLabel;
  return new Promise((resolve) => {
    const done = (ok) => {
      dlg.removeEventListener('click', onClick);
      dlg.removeEventListener('cancel', onEsc);
      if (dlg.open) dlg.close();
      resolve(ok);
    };
    const onClick = (e) => {
      const btn = e.target.closest('button[value]');
      if (btn) { e.preventDefault(); done(btn.value === 'ok'); }
    };
    const onEsc = () => done(false);
    dlg.addEventListener('click', onClick);
    dlg.addEventListener('cancel', onEsc);
    dlg.showModal();
  });
}

export { confirmDelete };
