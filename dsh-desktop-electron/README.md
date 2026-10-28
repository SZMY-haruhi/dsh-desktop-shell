> [!CAUTION]
> # 本项目已归档 / This project is archived
>
> **官方 DeepSeek Harness Desktop 已发布。请改用官方客户端，勿再装本壳。**
>
> **The official DeepSeek Harness Desktop has been released. Use the official client. Do not install this shell anymore.**
>
> - **产品 / Product:** [https://www.deepseek.com/en/harness/](https://www.deepseek.com/en/harness/)
> - **下载 / Download:** [https://www.deepseek.com/en/download/](https://www.deepseek.com/en/download/)
> - **上游桌面 README / Upstream desktop README:** [https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/desktop/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/desktop/README.md)

# dsh-desktop-electron

English | [中文](../README.md)

Pure Electron shell for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — the publishable artifact inside [`dsh-desktop-shell`](../README.md). See the [parent README](../README.md) for the full contract (Run / Architecture / Known Limitations).

> Format reference: [`deepseek-harness/docs/cookbook/adding-a-package.md#4`](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/cookbook/adding-a-package.md#4-write-the-package-readme); template [`packages/core/tools/README.md`](https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/core/tools/README.md) (first spine plugin).

## What it does

- Spawns `npx --yes @deepseek-ai/dsh@0.2.0-rc.2 web --no-open` (`shell: true`, `windowsHide: true`, `NO_COLOR=1`) and reads stdout/stderr
- Waits up to 180s for the `dsh web: <url>?token=…` readiness line from `@deepseek-ai/dsh-web-app`
- Opens `BrowserWindow` 1280×800 (`backgroundColor #111`, `autoHideMenuBar`, `contextIsolation:true`, `nodeIntegration:false`) and loads that tokenized URL
- Shows an encoded `data:text/html` loading page, then a fallback page with a redacted log tail if the line never arrives
- Hides to the tray on close. Quitting the app stops the spawned `dsh` process. On macOS, closing the last window does not quit; Quit still stops the child.

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

`main.js` owns the launch argv and the 180s `dsh web:` deadline — edit and rebuild to change.

## Model Experience

None, as a host shell. See parent [Model Experience](../README.md#model-experience).

## Known Limitations

See the Chinese parent [已知限制](../README.md#已知限制) — fixed port, single instance, tray without autostart, tokenized readiness line, Chromium weight, Windows PID kill, POSIX orphan on SIGKILL.
