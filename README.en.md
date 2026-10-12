# dsh-desktop-shell

<p align="center">
  <img src="dsh-desktop-electron/build/icon.png" height="100" alt="DSH Desktop icon" style="vertical-align: middle; margin-right: 16px;">
  <a href="https://dshfind.com/zh/plugins/SZMY-haruhi/dsh-desktop-shell?ref=badge" style="display: inline-block; vertical-align: middle;">
    <img src="https://dshfind.com/api/card/SZMY-haruhi/dsh-desktop-shell?lang=zh" alt="dshfind" style="height: 100px; width: 320px; object-fit: cover; object-position: left; border-radius: 8px;">
  </a>
</p>

English | [中文](README.md)

Pure Electron shell for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`). No bundled `dsh` code. On launch the shell runs `npx --yes @deepseek-ai/dsh@0.2.0-rc.2 web --no-open`, reads the `dsh web:` readiness line (`http://127.0.0.1:3080/?token=...`), and loads that tokenized URL. Since 0.1.2 a bare loopback URL does not mint the session cookie and the index responds 401. Bump the pinned spec in `main.js` when moving to another tested release.

> Reference format: this README follows the package README contract in [`deepseek-harness/docs/cookbook/adding-a-package.md`](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/cookbook/adding-a-package.md#4-write-the-package-readme) and the prose rules in `docs/AGENTS.md`. The closest in-tree template is [`packages/core/tools/README.md`](https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/core/tools/README.md) (the first spine plugin).

## Screenshots

Pure shell is transparent to plugins — windowed `dsh web` with community skins and market work unchanged.

| Dark | Light |
|---|---|
| ![Dark](docs/images/dark.png) | ![Light](docs/images/light.png) |

**Community skin** [`dsh-web-ui-all`](https://github.com/zhu1090093659/dsh-web-ui/tree/main/packages/dsh-web-ui-all) — loaded directly, no shell change:

![dsh-web-ui-all](docs/images/dsh-web-ui-all.png)

**Plugin Market** [`dsh-market`](https://github.com/dsh-market/dsh-market#readme) — packaged shell has no effect on `dsh-plugin` ecosystem:

![Plugin Market](docs/images/plugin-market.png)

## Run

### Prerequisites

- `Node.js ^22.19 || >=24` (required by `dsh` itself; the shell also uses it to spawn `npx`)
- `pnpm@11.7.0` recommended, `npm`/`yarn` also work for the Electron project

### From release

Download `DSH Desktop Shell Setup 0.1.1.exe` from Releases, install, then double-click `DSH Desktop Shell`. The first launch pulls `@deepseek-ai/dsh@0.2.0-rc.2` via `npx` and opens the Harness Web UI.

### From source

```sh
git clone https://github.com/<you>/dsh-desktop-shell.git
cd dsh-desktop-shell/dsh-desktop-electron
pnpm install
pnpm start        # dev: open Electron against local npx dsh web
pnpm run build    # prod: electron-builder → dist/DSH Desktop Shell Setup 0.1.1.exe (~80MB, Chromium included)
```

The shell does not require `deepseek-harness` to be cloned. `npx --yes @deepseek-ai/dsh@0.2.0-rc.2 web --no-open` is the single source of truth (same contract as `dsh web --no-open` in the [web-app manual](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/bundle/web-app/README.md)).

## Architecture

```
Electron main (main.js)
  ├─ spawnDsh() ──► npx --yes @deepseek-ai/dsh@0.2.0-rc.2 web --no-open
  │                 (stdout/stderr piped, NO_COLOR=1, windowsHide: true)
  ├─ parse `dsh web: <url>?token=…` ── 180s deadline; timeout kills our child
  └─ BrowserWindow ──► data:text/html loading → that tokenized URL once
                      later windows load the same origin at /
                      fallback page (redacted log, Retry) when the line never arrives
  close → hide to tray on every platform
  window-all-closed → on non-darwin, stay in the tray unless quitting; otherwise kill our child and quit
  darwin → window-all-closed does not quit; tray Quit / app quit still kills our child
```

- **Zero fork:** no vendored `dsh` code, no patch to `cordis.yml`, no plugin registration. The shell is transparent to every `dsh-plugin`.
- **Pinned runtime:** `main.js` launches `@deepseek-ai/dsh@0.2.0-rc.2`. `^0.2` does not select that prerelease, so the spec is exact.
- **Launch token:** the window loads the URL from the `dsh web:` line. `--no-open` keeps the system browser closed. Default bind remains `127.0.0.1:3080`. No custom `--host`/`--port` passthrough.

## Project layout

```
dsh-desktop-shell/                 # ← this repo root (what you push to GitHub)
├─ dsh-desktop-electron/           # Electron pure-shell (the publishable artifact)
│  ├─ main.js                      # spawn + token URL + BrowserWindow
│  ├─ launch-url.js                # parse the `dsh web:` readiness line
│  ├─ navigation.js                # origin allowlist and external-protocol check
│  ├─ child-output.js              # line buffering and launch wait
│  ├─ win-port.js                  # exact Windows listener match
│  ├─ package.json                 # private:true, electron 33 + electron-builder 25
│  ├─ build/icon.png               # window + installer icon
│  └─ dist/                        # ← ignored: builder output (exe, win-unpacked, blockmap)
├─ .pnpm-store/                    # ← ignored: local pnpm store cache (moved here to keep root clean)
├─ .gitignore                      # ignores node_modules / dist / .pnpm-store
└─ README.md (中文默认) / README.en.md / LICENSE
```

Only `dsh-desktop-electron/` source is needed to reproduce the build; `node_modules/` and `dist/` are never committed (pure version).

## Build

| Script | Action |
|---|---|
| `pnpm start` | `electron .` — launches shell with live `npx dsh web` |
| `pnpm run build` | `electron-builder --win --x64` — NSIS installer + unpacked dir in `dist/` |
| `pnpm run dist` | alias with `--publish never` |

`build.appId = com.dsh.desktop-shell`, `productName = DSH Desktop`, `win.target = nsis`, `icon = build/icon.png`. Porting to macOS/Linux is `electron-builder --mac/--linux` without code change.

## Configuration

No config file. Constants owned by `main.js`:

| Constant | Default | Meaning |
|---|---|---|
| launch command | `npx --yes @deepseek-ai/dsh@0.2.0-rc.2 web --no-open` | child process |
| launch timeout | `180000 ms` | wait for the `dsh web:` line |
| window size | `1280×800`, `min 900×600` | `center:true`, `autoHideMenuBar:true`, `backgroundColor:#111` |

Change requires editing `main.js` and rebuilding — intentional, to keep the shell dependency-free.

## Model Experience

None, as a standalone host shell.

The shell owns no prompt sections, tool schemas, or session events. Model-visible behavior is wholly owned by the spawned `dsh` process and its loaded plugins (e.g., `dsh-tools`, `dsh-system-prompt`).

#### KV Cache effect

No direct invalidation; the spawned Harness process owns any request-prefix changes.

## Known Limitations and Deferred Work

- **Fixed port:** the shell does not pass `--port`. Upstream still defaults to `127.0.0.1:3080`. If that port is already taken, this process cannot see the other process's launch token, so startup shows the fallback page instead of loading a bare URL.
- **Single instance:** `requestSingleInstanceLock()` focuses the existing window.
- **Tray:** closing the window hides it. Tray → 退出, or quitting the app, stops `dsh web`. There is no OS autostart.
- **Readiness:** the shell waits for the `dsh web:` line (printed after the loader settles). Cold `npx` fetches have 180s.
- **Chromium weight:** NSIS exe ~81 MB because Electron bundles Chromium.
- **Windows-first:** `shell: true` so `npx.cmd` works on Windows. Quit kills that process tree by PID. A port scan is only a fallback, and it kills a listener only when the local address matches exactly and the PID is our process or its child.
- **POSIX process group:** the child is `detached` so quit can signal the whole group. A normal quit, SIGINT, or SIGTERM does that. SIGKILL cannot be caught, so it can leave an orphan `dsh web`.

## License

[MIT](LICENSE) — same as [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness/blob/main/LICENSE).
Add topic `dsh-plugin` is not needed (not a Harness plugin); for discoverability consider `dsh` / `deepseek-harness` / `electron-shell`.

---

## Author

<a href="https://tonkatsu258.vercel.app/">
  <img src="docs/avatar.png" width="96" height="96" alt="tonkatsu258" />
</a>

**Thanks for Star ❤️** — [tonkatsu258](https://tonkatsu258.vercel.app/) · [Personal Website](https://tonkatsu258.vercel.app/)
