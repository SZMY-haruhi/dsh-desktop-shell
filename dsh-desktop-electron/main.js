// Pure shell - Electron 版：双击自动拉起最新官方 dsh web，窗口只 load 3080
// 不打包任何 dsh 代码，官方更新无需重编
const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const http = require('http');

let dshProc = null;
let win = null;
const DSH_URL = 'http://127.0.0.1:3080';

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

function waitForReady(url, timeoutMs = 15000) {
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

async function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    center: true, autoHideMenuBar: true,
    backgroundColor: '#111',
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  // 先显示 loading，等 3080 就绪再切
  win.loadURL('data:text/html,<body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:%23666">正在唤醒 DeepSeek Harness...');

  const ok = await waitForReady(DSH_URL);
  if (ok) win.loadURL(DSH_URL);
  else win.loadURL('data:text/html,<body style="font-family:sans-serif;padding:40px">dsh web 未就绪，请确认已安装 Node.js<br>可手动运行: npx --yes @deepseek-ai/dsh@latest web');
}

app.whenReady().then(() => {
  spawnDsh();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (dshProc) try { dshProc.kill(); } catch {}
  if (process.platform !== 'darwin') app.quit();
});
