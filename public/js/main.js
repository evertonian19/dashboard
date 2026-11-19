// 진입점: 모듈을 불러오고 셸을 시작합니다.
import { api } from './core/api.js';
import { hooks } from './core/hooks.js';
import { config } from './core/state.js';
import { applyMenuNames } from './shell/nav.js';
import { show } from './shell/router.js';
import { watchMail } from './views/mail.js';
import './shell/menus.js';
import './shell/layout.js';
import './shell/statusbar.js';
import './shell/theme.js';
import './shell/search.js';
import './shell/session.js';
import { startMarkets } from './shell/markets.js';

startMarkets();
hooks.show = show;
hooks.applyMenuNames = applyMenuNames;

/* ------------------------------------------------------------------
   시작
------------------------------------------------------------------- */

window.addEventListener('hashchange', show);
api('/config').then((c) => { Object.assign(config, c); applyMenuNames(); }).catch(() => {}).finally(show);
watchMail();
setInterval(watchMail, 30000);
