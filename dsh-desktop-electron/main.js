// DSH Desktop Shell - 精简纯壳 90行
const { app, BrowserWindow, shell, dialog, Tray, Menu, nativeImage } = require('electron');
const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');

let dshProc = null, win = null, tray = null;
const DSH_URL = 'http://127.0.0.1:3080';

// 图标：extraResources -> resources/build/icon.png 优先
function getIconPath() {
  const p1 = path.join(process.resourcesPath || __dirname, 'build', 'icon.png');
  try { if (require('fs').existsSync(p1)) return p1; } catch {}
  return path.join(__dirname, 'build', 'icon.png');
}
// 继承式杀：按端口找 LISTENING 3080 同步 taskkill，等同手关旧 powershell
function killDsh() {
  try {
    if (process.platform === 'win32') {
      let pid = null;
      try {
        const out = execSync('netstat -ano | findstr :3080', { windowsHide: true, encoding: 'utf8' });
        for (const line of out.split('\n')) {
          if (line.includes('LISTENING')) {
            const m = line.trim().match(/(\d+)\s*$/);
            if (m) { pid = m[1]; break; }
          }
        }
      } catch {}
      if (pid) {
        console.log('[dsh] kill 3080 pid', pid);
        try { execSync(`taskkill /PID ${pid} /T /F`, { windowsHide: true }); } catch (e) { console.error('[dsh] taskkill', e.message); }
      } else if (dshProc) {
        try { execSync(`taskkill /PID ${dshProc.pid} /T /F`, { windowsHide: true }); } catch {}
      }
    } else if (dshProc) dshProc.kill();
  } catch {}
  dshProc = null;
}
function spawnDsh() {
  dshProc = spawn('npx', ['--yes', '@deepseek-ai/dsh@latest', 'web'], { shell: true, windowsHide: true, stdio: 'ignore' });
  dshProc.on('error', e => console.error('[dsh] spawn failed:', e.message));
  dshProc.unref();
  console.log('[dsh] spawned pid', dshProc.pid);
}
function waitForReady(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise(res => {
    const tick = () => {
      const req = http.get(url, r => { r.destroy(); res(true); });
      req.on('error', () => Date.now() - start > timeoutMs ? res(false) : setTimeout(tick, 500));
      req.end();
    };
    tick();
  });
}
async function createWindow() {
  win = new BrowserWindow({
    title: 'DSH Desktop Shell', width: 1280, height: 800, minWidth: 900, minHeight: 600,
    center: true, autoHideMenuBar: true, backgroundColor: '#111', icon: getIconPath(),
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL() && !url.startsWith(DSH_URL)) { e.preventDefault(); shell.openExternal(url); }
  });
  win.on('close', e => { if (!app.isQuitting) { e.preventDefault(); win.hide(); } });
  // 崩溃兜底
  const onCrash = () => killDsh();
  win.on('unresponsive', () => { dialog.showErrorBox('DSH Desktop Shell 无响应', '将回收 3080'); onCrash(); });
  win.webContents.on('render-process-gone', onCrash);
  win.webContents.on('crashed', onCrash);

  win.loadURL('data:text/html;charset=utf-8,<body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:%23666;background:%23111">正在唤醒 DeepSeek Harness...</body>');
  const ok = await waitForReady(DSH_URL);
  win.loadURL(ok ? DSH_URL : 'data:text/html;charset=utf-8,<body style="font-family:sans-serif;padding:40px;background:%23111;color:%23ccc"><h3>dsh web 未就绪</h3><p>请确认 Node.js 或网络就绪</p><p><button onclick="location.href=\'http://127.0.0.1:3080\'" style="padding:8px 16px;cursor:pointer">重试</button> <code>npx --yes @deepseek-ai/dsh@latest web</code></p></body>');
}
function createTray() {
  if (tray) return;
  try {
    const p = getIconPath(), img = nativeImage.createFromPath(p);
    tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img.resize({ width: 16, height: 16 }));
    tray.setToolTip('DSH Desktop Shell');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '显示窗口', click: () => win && win.show() },
      { type: 'separator' },
      { label: '退出', click: () => { app.isQuitting = true; app.quit(); } }
    ]));
    tray.on('click', () => win && win.show());
  } catch (e) { console.error('[dsh] tray', e); }
}
// 单例：多开只唤起已有窗口
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  app.whenReady().then(async () => {
    const alive = await waitForReady(DSH_URL, 1000);
    if (alive) console.log('[dsh] reuse 3080'); else spawnDsh();
    createTray();
    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  process.on('uncaughtException', e => { console.error(e); killDsh(); dialog.showErrorBox('DSH Desktop Shell 异常', String(e.message||e)); });
  process.on('unhandledRejection', r => console.error(r));
  app.on('before-quit', () => { app.isQuitting = true; });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      if (tray && !app.isQuitting) return;
      killDsh(); app.quit();
    }
  });
  app.on('quit', killDsh);
}
