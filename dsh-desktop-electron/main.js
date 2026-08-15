// Pure shell - Electron 版：双击自动拉起最新官方 dsh web，窗口只 load 3080
// 不打包任何 dsh 代码，官方更新无需重编
const { app, BrowserWindow, shell, dialog, Tray, Menu, nativeImage } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

let dshProc = null;
let win = null;
let tray = null;
const DSH_URL = 'http://127.0.0.1:3080';

function killDsh() {
  if (!dshProc) return;
  try {
    if (process.platform === 'win32') {
      // cmd /c 套了一层，kill 需杀整棵树才能带走孙进程 node
      spawn('taskkill', ['/PID', String(dshProc.pid), '/T', '/F'], { windowsHide: true });
    } else {
      dshProc.kill();
    }
  } catch {}
  dshProc = null;
}

function spawnDsh() {
  // 用 npx --yes 永远拿 latest，等价于 DSH.bat
  // windows 上用 cmd /c 包一层更稳
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'cmd' : 'npx';
  const args = isWin ? ['/c', 'npx --yes @deepseek-ai/dsh@latest web'] : ['--yes', '@deepseek-ai/dsh@latest', 'web'];
  dshProc = spawn(cmd, args, { stdio: 'ignore', detached: false, windowsHide: true });
  dshProc.on('error', (e) => console.error('[dsh] spawn failed, need Node.js:', e.message));
  dshProc.unref();
  console.log('[dsh] spawned pid', dshProc.pid);
}

function waitForReady(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.destroy();
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) resolve(false);
        else setTimeout(tick, 500);
      });
      req.end();
    };
    tick();
  });
}

function getIconPath() {
  const p1 = path.join(process.resourcesPath || __dirname, 'build', 'icon.png');
  try { if (require('fs').existsSync(p1)) return p1; } catch {}
  return path.join(__dirname, 'build', 'icon.png');
}
async function createWindow() {
  win = new BrowserWindow({
    title: "DSH Desktop Shell",
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    center: true, autoHideMenuBar: true,
    backgroundColor: '#111',
    icon: getIconPath(),
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  // 外链走系统浏览器，不弹独立窗口
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL() && !url.startsWith(DSH_URL)) {
      // 3080 外的导航一律外跳
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // 点 × 直接进托盘，不弹确认；真正退出走托盘右键
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  // 崩溃兜底：窗口崩/无响应时自动回收 dsh 服务，避免孤儿占 3080
  win.on('unresponsive', () => {
    console.error('[dsh] window unresponsive');
    dialog.showErrorBox('DSH Desktop Shell 无响应', '窗口已无响应，将回收后台 dsh 服务以释放 3080 端口。');
    killDsh();
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[dsh] render-process-gone', details);
    killDsh();
  });
  win.webContents.on('crashed', () => {
    console.error('[dsh] webContents crashed');
    killDsh();
  });

  // 先显示 loading（charset 修复乱码），等 3080 就绪再切
  win.loadURL('data:text/html;charset=utf-8,<body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:%23666;background:%23111">正在唤醒 DeepSeek Harness...</body>');

  const ok = await waitForReady(DSH_URL);
  if (ok) win.loadURL(DSH_URL);
  else win.loadURL('data:text/html;charset=utf-8,<body style="font-family:sans-serif;padding:40px;background:%23111;color:%23ccc"><h3>dsh web 未就绪</h3><p>请确认已安装 Node.js，或网络/DNS 尚未就绪（开机冷启动常见）。</p><p><button onclick="location.href=\'http://127.0.0.1:3080\'" style="padding:8px 16px;cursor:pointer">重试</button> &nbsp; 手动运行：<code>npx --yes @deepseek-ai/dsh@latest web</code></p></body>');
}

function createTray() {
  if (tray) return;
  try {
    const iconPath = getIconPath();
    const img = nativeImage.createFromPath(iconPath);
    tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img.resize({ width: 16, height: 16 }));
    tray.setToolTip('DSH Desktop Shell');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '显示窗口', click: () => { if (win) win.show(); } },
      { type: 'separator' },
      { label: '退出', click: () => { app.isQuitting = true; app.quit(); } }
    ]));
    tray.on('click', () => { if (win) win.show(); });
  } catch (e) {
    console.error('[dsh] createTray failed', e);
  }
}

app.whenReady().then(() => {
  spawnDsh();
  createTray();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

// 全局崩溃兜底
process.on('uncaughtException', (err) => {
  console.error('[dsh] uncaughtException', err);
  killDsh();
  dialog.showErrorBox('DSH Desktop Shell 异常', String(err?.message || err));
});
process.on('unhandledRejection', (reason) => {
  console.error('[dsh] unhandledRejection', reason);
});

app.on('child-process-gone', (_e, details) => {
  console.error('[dsh] child-process-gone', details);
  // 若是 GPU/渲染进程崩，窗口已在上面处理；此处仅日志
});

app.on('before-quit', () => { app.isQuitting = true; });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 若托盘存在则不直接退出，隐藏即可；否则按原逻辑退出
    if (tray && !app.isQuitting) {
      // 已在 close 事件中 hide，这里不杀服务
      return;
    }
    killDsh();
    app.quit();
  }
});

app.on('quit', () => {
  killDsh();
});
