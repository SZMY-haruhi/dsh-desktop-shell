// DSH Desktop Shell — Electron window around `dsh web`.
const { app, BrowserWindow, shell, dialog, Tray, Menu, nativeImage } = require('electron');
const { spawn, execSync } = require('child_process');
const path = require('path');
const { redactSecrets } = require('./launch-url');
const { RETRY_URL, navigationDecision, isRetryNavigation, isOpenableExternal } = require('./navigation');
const { waitForLaunch } = require('./child-output');
const { ownedListeningPid } = require('./win-port');

let dshProc = null, win = null, tray = null;
let launchPromise = null;
let spawnGen = 0;
let acceptedLaunch = false;
let allowedOrigin = 'http://127.0.0.1:3080';
let launchHost = '127.0.0.1';
let boundPort = 3080;
const logTail = [];
const LAUNCH_TIMEOUT_MS = 180000;
const DSH_SPEC = '@deepseek-ai/dsh@0.2.0-rc.2';
const DSH_ARGS = ['--yes', DSH_SPEC, 'web', '--no-open'];

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
  const parsed = new URL(url);
  allowedOrigin = parsed.origin;
  launchHost = parsed.hostname;
  boundPort = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));
}

function safePid(pid) {
  const text = String(pid);
  return /^\d+$/.test(text) ? text : null;
}

function taskkillTree(pid) {
  const safe = safePid(pid);
  if (!safe) return false;
  try {
    execSync(`taskkill /PID ${safe} /T /F`, { windowsHide: true });
    rememberLog(`taskkill tree ${safe}`);
    return true;
  } catch (e) {
    rememberLog(`taskkill ${safe}: ${e.message}`);
    return false;
  }
}

function windowsParentPid(pid) {
  const safe = safePid(pid);
  if (!safe) return null;
  try {
    const out = execSync(
      `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=${safe}').ParentProcessId"`,
      { windowsHide: true, encoding: 'utf8' },
    );
    return safePid(out.trim());
  } catch {
    return null;
  }
}

function killDsh() {
  const proc = dshProc;
  dshProc = null;
  if (!proc || !proc.pid) return;
  try {
    if (process.platform === 'win32') {
      if (taskkillTree(proc.pid)) return;
      let out = '';
      try {
        out = execSync('netstat -ano -p tcp', { windowsHide: true, encoding: 'utf8' });
      } catch (e) {
        rememberLog(`netstat fallback: ${e.message}`);
        return;
      }
      const owned = ownedListeningPid(out, {
        host: launchHost,
        port: boundPort,
        rootPid: proc.pid,
        parentOf: windowsParentPid,
      });
      if (!owned) {
        rememberLog(`port ${boundPort} listener is not our process; left it running`);
        return;
      }
      taskkillTree(owned);
      return;
    }
    try { process.kill(-proc.pid, 'SIGTERM'); }
    catch { try { proc.kill(); } catch {} }
  } catch (e) {
    rememberLog(e.message || e);
  }
}

function spawnDsh() {
  const gen = ++spawnGen;
  dshProc = spawn('npx', DSH_ARGS, {
    shell: true,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  const proc = dshProc;
  const pending = waitForLaunch(proc, LAUNCH_TIMEOUT_MS, { onLine: rememberLog });
  launchPromise = pending.then(result => (gen === spawnGen ? result : { url: null, reason: 'stale' }));
  proc.unref();
  rememberLog(`spawned pid ${proc.pid}`);
}

function dataHtml(body) {
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(body);
}

function loadingPage() {
  return dataHtml('<body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#666;background:#111">正在唤醒 DeepSeek Harness...</body>');
}

function errorPage() {
  const detail = logTail.slice(-8).join('\n') || '未收到 dsh web: 启动地址';
  const escaped = detail.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const body = `<body style="font-family:sans-serif;padding:40px;background:#111;color:#ccc"><h3>dsh web 未就绪</h3><p>请确认 Node.js（^22.19 或 &gt;=24）与网络就绪。外壳会执行 <code>npx --yes ${DSH_SPEC} web --no-open</code>，并打开 CLI 打印的带 token 的地址。</p><p><button onclick="location.href='${RETRY_URL}'" style="padding:8px 16px;cursor:pointer">重试</button></p><pre style="white-space:pre-wrap;color:#aaa">${escaped}</pre></body>`;
  return dataHtml(body);
}

function guardNavigation(event, url) {
  if (isRetryNavigation(url)) {
    event.preventDefault();
    void retryLaunch();
    return;
  }
  const decision = navigationDecision(url, allowedOrigin);
  if (decision === 'allow') return;
  event.preventDefault();
  if (decision === 'external') shell.openExternal(url);
}

function offerReload(message, detail) {
  const target = win;
  dialog.showMessageBox(target, {
    type: 'warning',
    buttons: ['重新加载', '取消'],
    defaultId: 0,
    cancelId: 1,
    message,
    detail,
  }).then(({ response }) => {
    if (response !== 0 || !target || target.isDestroyed()) return;
    target.loadURL(acceptedLaunch ? `${allowedOrigin}/` : loadingPage());
  }).catch(e => rememberLog(e.message || e));
}

async function showLaunchResult() {
  const gen = spawnGen;
  const result = launchPromise ? await launchPromise : null;
  if (gen !== spawnGen || !win || win.isDestroyed()) return;
  if (!result || result.reason !== 'url' || !result.url) {
    if (result && result.reason === 'timeout') {
      rememberLog('launch timed out');
      killDsh();
    }
    win.loadURL(errorPage());
    return;
  }
  noteLaunchUrl(result.url);
  if (acceptedLaunch) {
    win.loadURL(`${allowedOrigin}/`);
    return;
  }
  acceptedLaunch = true;
  win.loadURL(result.url);
}

async function retryLaunch() {
  killDsh();
  acceptedLaunch = false;
  spawnDsh();
  if (!win || win.isDestroyed()) return;
  win.loadURL(loadingPage());
  await showLaunchResult();
}

async function createWindow() {
  win = new BrowserWindow({
    title: 'DSH Desktop Shell', width: 1280, height: 800, minWidth: 900, minHeight: 600,
    center: true, autoHideMenuBar: true, backgroundColor: '#111', icon: getIconPath(),
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isRetryNavigation(url)) void retryLaunch();
    else if (isOpenableExternal(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => guardNavigation(event, url));
  win.webContents.on('will-redirect', (event, url) => guardNavigation(event, url));
  win.on('close', e => { if (!app.isQuitting) { e.preventDefault(); win.hide(); } });
  win.on('unresponsive', () => {
    offerReload('DSH Desktop Shell 无响应', '页面没有响应。重新加载界面不会停止 dsh web。');
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    rememberLog(`render-process-gone reason=${details && details.reason || ''} code=${details && details.exitCode != null ? details.exitCode : ''}`);
    offerReload('页面进程已退出', '可以重新加载界面。dsh web 会继续运行。');
  });

  win.loadURL(loadingPage());
  await showLaunchResult();
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
  } catch (e) { rememberLog(`tray ${e.message || e}`); }
}

function shutdownFromSignal() {
  app.isQuitting = true;
  killDsh();
  app.quit();
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  app.whenReady().then(async () => {
    spawnDsh();
    createTray();
    await createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) void createWindow(); });
  });
  process.on('uncaughtException', e => {
    const text = redactSecrets(e && e.stack ? e.stack : e);
    rememberLog(text);
    killDsh();
    dialog.showErrorBox('DSH Desktop Shell 异常', redactSecrets(e && e.message ? e.message : e));
  });
  process.on('unhandledRejection', r => rememberLog(r && r.stack ? r.stack : r));
  process.on('SIGINT', shutdownFromSignal);
  process.on('SIGTERM', shutdownFromSignal);
  app.on('before-quit', () => { app.isQuitting = true; });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      if (tray && !app.isQuitting) return;
      killDsh();
      app.quit();
    }
  });
  app.on('quit', killDsh);
}
