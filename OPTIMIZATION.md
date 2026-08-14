# 优化清单 · DSH Desktop Shell

> 2026-08-15 整理 · 三个主问题 + 追加提问 · 状态：待实现

## 1) 链接 `Ctrl+点击` 弹出独立窗口

- **现状**：`main.js` 未拦截 `window.open / target="_blank"`，`Ctrl+点击` 会再开一个 `BrowserWindow` 独立窗口。
- **问题**：不方便，应走系统默认浏览器。
- **优化**：`createWindow()` 中加：
  ```js
  const { shell } = require('electron');
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL() && !url.startsWith('http://127.0.0.1:3080')) { e.preventDefault(); shell.openExternal(url); }
  });
  ```
- **优先级**：高 · 影响日常跳转

## 2) 无黑框但关窗口即秒杀服务

- **现状**：`spawn(..., { windowsHide: true, stdio: 'ignore' })` 藏黑框是对的；但 `app.on('window-all-closed', () => dshProc.kill())` 关窗即 `TerminateProcess`，秒断 `127.0.0.1:3080`。
- **追加**：关窗 = 秒杀，无优雅退出；`stdio: ignore` 无日志。
- **优化**：二选一
  - 保持秒杀（最干净）— 不动
  - 托盘常驻 — 关窗仅 `hide()`，托盘菜单“显示/退出”才真 `kill`，加 `Tray + Menu`
- **优先级**：中 · 取决于是否要后台常驻

### 2.1 首启乱码 / 二启秒进

- **现状**：`win.loadURL('data:text/html,<body>正在唤醒...')` 未加 `charset=utf-8`，中文裸塞 `data:` URL，冷启动等 5-15s 时闪出乱码；热启动 `npm cache` 命中，1-2s 切 `3080` 看不见。
- **问题**：时不时冷启动可见乱码；关机明天不一定再现（cache 落盘，除非清缓存或 `@latest` 更新）。
- **优化**：`data:text/html;charset=utf-8,` 并对内容做编码，或改 `loadFile` 本地 loading 页。
- **优先级**：低 · 视觉修复

## 3) 关窗无确认/无最小化，误点即退

- **现状**：无 `close` 拦截，无托盘，点 `X` 即退。
- **追加**：目前无系统托盘。
- **优化**：
  ```js
  const { dialog, Tray, Menu, nativeImage } = require('electron');
  let tray;
  // 创建后
  tray = new Tray(nativeImage.createFromPath('build/icon.png'));
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示窗口', click: () => win.show() },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } }
  ]));
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      const r = dialog.showMessageBoxSync(win, {
        type: 'question', buttons: ['最小化到托盘','直接退出','取消'],
        message: '要退出 DSH Desktop 吗？', detail: '关窗口会终止 dsh web 服务'
      });
      if (r === 0) win.hide();
      else if (r === 1) { app.isQuitting = true; win.close(); }
    }
  });
  ```
- **优先级**：高 · 防误触

---

### 下一轮实现顺序建议
1. 外链拦截（1）
2. 托盘 + 关窗确认（3）
3. 保留秒杀或切常驻（2）+ loading `charset` 修复（2.1）

> 位置：根目录 `OPTIMIZATION.md` · 下次直接按此清单改 `main.js` 并重编三件套即可。
