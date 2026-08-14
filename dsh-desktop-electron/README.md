# dsh-desktop-electron

English | [中文](../README.zh.md)

Pure Electron shell for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — the publishable artifact inside [`dsh-desktop-shell`](../README.md). See the [parent README](../README.md) for the full contract (Run / Architecture / Known Limitations).

> Format reference: [`deepseek-harness/docs/cookbook/adding-a-package.md#4`](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/cookbook/adding-a-package.md#4-write-the-package-readme); template [`packages/core/tools/README.md`](https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/core/tools/README.md) (first spine plugin).

## What it does

- Spawns `npx --yes @deepseek-ai/dsh@latest web` (`cmd /c` on Windows, `npx` on POSIX) with `stdio: ignore`, `windowsHide: true`
- Polls `http://127.0.0.1:3080` via `http.get` every 500 ms up to 15 s
- Opens `BrowserWindow` 1280×800 (`backgroundColor #111`, `autoHideMenuBar`, `contextIsolation:true`, `nodeIntegration:false`)
- Shows inline `data:text/html` loading → real URL on ready, fallback error page otherwise
- Kills the spawned `dsh` process on `window-all-closed` (darwin excluded)

No `dsh` code is bundled; the shell is transparent to every `dsh` plugin and survives upstream `rc → 1.0` without rebuild.

## Run

```sh
pnpm install
pnpm start        # electron .
pnpm run build    # electron-builder --win --x64 → dist/DSH Desktop Setup 0.1.0.exe
```

Requires `Node.js ^22.19 || >=24`.

## Build config

`package.json#build`: `appId com.dsh.desktop-shell`, `productName DSH Desktop`, `directories.output dist`, `win.target nsis`, `icon build/icon.png`, `nsis.oneClick false`.

`main.js` owns `DSH_URL` and the 15 s poll timeout — edit and rebuild to change.

## Model Experience

None, as a host shell. See parent [Model Experience](../README.md#model-experience).

## Known Limitations

See parent [Known Limitations](../README.md#known-limitations-and-deferred-work) — fixed port, single instance, no tray, poll-only readiness, Chromium weight, Windows-first.
