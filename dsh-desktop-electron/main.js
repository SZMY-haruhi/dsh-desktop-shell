// DSH Desktop Shell — Electron window around `dsh web`.
const { app, BrowserWindow, shell, dialog, Tray, Menu, nativeImage } = require('electron');
const { spawn, execSync } = require('child_process');
const path = require('path');
const { parseLaunchUrl, originOf, redactSecrets } = require('./launch-url');

let dshProc = null, win = null, tray = null;
let launchPromise = null;
let allowedOrigin = 'http://127.0.0.1:3080';
let boundPort = 3080;
const logTail = [];
const LAUNCH_TIMEOUT_MS = 180000;
const DSH_ARGS = ['--yes', '@deepseek-ai/dsh@latest', 'web', '--no-open'];

function getIconPath() {
  const p1 = path.join(process.resourcesPath || __dirname, 'build', 'icon.png');
  try { if (require('fs').existsSync(p1)) return p1; } catch {}
  return path.join(__dirname, 'build', 'icon.png');
}

function rememberLog(line) {
  const safe = redactSecrets(line).trim();
  if (!safe) return;
  logTail.push(safe);
  if (logTail.length > 30) logTail.shift();
  console.log('[dsh]', safe);
}

function noteLaunchUrl(url) {
  allowedOrigin = originOf(url);
  const parsed = new URL(url);
  boundPort = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));
}

function killDsh() {
  const proc = dshProc;
  dshProc = null;
  try {
    if (process.platform === 'win32') {
      let pid = null;
      try {
        const out = execSync(`netstat -ano | findstr :${boundPort}`, { windowsHide: true, encoding: 'utf8' });
        for (const line of out.split('\n')) {
          if (line.includes('LISTENING')) {
            const m = line.trim().match(/(\d+)\s*$/);
            if (m) { pid = m[1]; break; }
          }
        }
      } catch {}
      if (pid) {
        console.log('[dsh] kill', boundPort, 'pid', pid);
        try { execSync(`taskkill /PID ${pid} /T /F`, { windowsHide: true }); } catch (e) { console.error('[dsh] taskkill', e.message); }
      } else if (proc) {
        try { execSync(`taskkill /PID ${proc.pid} /T /F`, { windowsHide: true }); } catch {}
      }
    } else if (proc && proc.pid) {
      try { process.kill(-proc.pid, 'SIGTERM'); } catch { try { proc.kill(); } catch {} }
    }
  } catch {}
}

function readLines(stream, onLine) {
  if (!stream) return;
  let buf = '';
  stream.setEncoding('utf8');
  stream.on('data', chunk => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      onLine(buf.slice(0, idx));
      buf = buf.slice(idx + 1);
    }
  });
  stream.on('end', () => { if (buf) onLine(buf); });
}

function waitForLaunch(proc, timeoutMs) {
  return new Promise(resolve => {
    let settled = false;
    const done = url => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(url);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    const onLine = line => {
      rememberLog(line);
      if (settled) return;
      const url = parseLaunchUrl(line);
      if (!url) return;
      noteLaunchUrl(url);
      done(url);
    };
    readLines(proc.stdout, onLine);
    readLines(proc.stderr, onLine);
    proc.on('exit', () => done(null));
    proc.on('error', () => done(null));
  });
}

function spawnDsh() {
  dshProc = spawn('npx', DSH_ARGS, {
    shell: true,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });
  dshProc.on('error', e => rememberLog(`spawn failed: ${e.message}`));
  launchPromise = waitForLaunch(dshProc, LAUNCH_TIMEOUT_MS);
  dshProc.unref();
  console.log('[dsh] spawned pid', dshProc.pid);
}

function dataHtml(body) {
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(body);
}

function loadingPage() {
  return dataHtml('<body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#666;background:#111">正在唤醒 DeepSeek Harness...</body>');
}

function errorPage() {
  const detail = logTail.slice(-8).join('\n') || '未收到 dsh web: 启动地址';
  const body = `<body style="font-family:sans-serif;padding:40px;background:#111;color:#ccc"><h3>dsh web 未就绪</h3><p>请确认 Node.js（^22.19 或 &gt;=24）与网络就绪。外壳会执行 <code>npx --yes @deepseek-ai/dsh@latest web --no-open</code>，并打开 CLI 打印的带 token 的地址。</p><pre style="white-space:pre-wrap;color:#aaa">${detail.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</pre></body>`;
  return dataHtml(body);
}

async function createWindow() {
  win = new BrowserWindow({
    title: 'DSH Desktop Shell', width: 1280, height: 800, minWidth: 900, minHeight: 600,
    center: true, autoHideMenuBar: true, backgroundColor: '#111', icon: getIconPath(),
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL() && !url.startsWith(allowedOrigin)) { e.preventDefault(); shell.openExternal(url); }
  });
  win.on('close', e => { if (!app.isQuitting) { e.preventDefault(); win.hide(); } });
  const onCrash = () => killDsh();
  win.on('unresponsive', () => { dialog.showErrorBox('DSH Desktop Shell 无响应', '将回收 dsh web'); onCrash(); });
  win.webContents.on('render-process-gone', onCrash);
  win.webContents.on('crashed', onCrash);

  win.loadURL(loadingPage());
  const launchUrl = launchPromise ? await launchPromise : null;
  if (!win || win.isDestroyed()) return;
  if (launchUrl) win.loadURL(launchUrl);
  else win.loadURL(errorPage());
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

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  app.whenReady().then(async () => {
    spawnDsh();
    createTray();
    await createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  process.on('uncaughtException', e => { console.error(e); killDsh(); dialog.showErrorBox('DSH Desktop Shell 异常', String(e.message || e)); });
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
