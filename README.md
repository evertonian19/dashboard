# dashboard

Personal dashboard. A stdlib-only Python server (no dependencies to install) and a vanilla JS frontend (no build step).
Home (todos, notes, favorites, weather, server status, Claude usage), diagrams, board, documents, mail check and settings in one place, laid out like the Football Manager 27 top menu bar.

## Layout

```
server.py        entry point (server, set-login command, background jobs)
backend/         server modules
  api/           HTTP layer: handler.py (routing, login/session, static files) + per-feature mixins
  auth.py db.py config.py bootstrap.py sanitize.py ...
public/          served files (everything except login.* requires login)
  js/            main.js, core/ (api, state, registry), views/ (one per menu), shell/ (menus, layout, theme, search, markets, rail)
  css/           base -> layout -> components -> views -> fm-theme -> responsive -> fm-layout -> favorites -> board -> brand -> markets -> rail -> ios
tests/           smoke_api.py, test_ios_app.py
```

## Run

```bash
python3 -c "import server; server.set_login('user', 'password')"   # create the login
python3 server.py
```

## Add a menu

1. Create `renderXxx(menu)` and `mountXxx(menu, params)` in `public/js/views/`.
2. Add `{ id, label, icon }` to `MENUS` in `public/js/core/registry.js`.
3. Wire `render` / `mount` into `VIEWS` in `public/js/shell/menus.js`.

Views never import the shell (avoids cycles); use `hooks.show()` from `core/hooks.js` to re-render.

Keep the `<link>` order in `index.html` and `login.html`: later stylesheets override earlier ones.

## Tests

`tests/smoke_api.py` runs fixed API calls and prints a normalized log; `diff` two runs to verify a refactor kept behavior.
Run it against a **temporary data directory** (it creates and deletes data):

```bash
export DASHBOARD_DATA=/tmp/dash-test PORT=8102
python3 -c "import server; server.set_login('tester', 'pw-12345-test')"
python3 server.py &
python3 tests/smoke_api.py http://127.0.0.1:8102 tester pw-12345-test > out.txt
```

iOS mockup: `python3 -m unittest tests.test_ios_app`

## Data

Account hash, mail app passwords, the database and uploads live in `data/` and are git-ignored. Never commit it.

## iOS app menu

Development status of `~/ios_everton` (commits, module size, feature checklist) plus a phone mockup using the app's sample data and rules, ported to Python in `backend/ios_app.py`. SwiftUI rendering and compilation are not verified.
