// 메뉴에 화면 연결
import { MENUS } from '../core/registry.js';
import { mountBoard, renderBoard } from '../views/board.js';
import { mountDiagrams, renderDiagrams } from '../views/diagrams.js';
import { mountDocuments, renderDocuments } from '../views/documents.js';
import { mountHome, renderHome } from '../views/home.js';
import { mountMail, renderMail } from '../views/mail.js';
import { mountSettings, renderSettings } from '../views/settings.js';
import { mountTodos, renderTodos } from '../views/todos.js';

// 각 메뉴에 화면(render)과 데이터 연결(mount)을 붙입니다.
const VIEWS = {
  menu1: { render: renderHome, mount: mountHome },
  menu2: { render: renderDiagrams, mount: mountDiagrams },
  menu3: { render: renderBoard, mount: mountBoard },
  menu4: { render: renderDocuments, mount: mountDocuments },
  menu5: { render: renderSettings, mount: mountSettings },
  menu6: { render: renderMail, mount: mountMail },
  menu7: { render: renderTodos, mount: mountTodos },
};
MENUS.forEach((m) => Object.assign(m, VIEWS[m.id]));
