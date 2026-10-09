/**
 * BioTailr AI StandBy - Web Control Center Server
 * Zero-dependency pure Node.js server.
 * Enables triggering runners and Chrome debug mode via web buttons with live terminal streaming.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, exec } = require('child_process');

const PORT = process.env.PORT || 4000;
const DASHBOARD_HTML_PATH = path.join(__dirname, 'dashboard.html');

let currentChild = null;
let currentPlatform = 'NONE';
const sseClients = new Set();
const logBuffer = [];
const MAX_LOG_BUFFER = 200;

function broadcastSSE(dataObj) {
  const payload = `data: ${JSON.stringify(dataObj)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch (e) {
      sseClients.delete(res);
    }
  }
}

function appendToBufferAndBroadcast(text) {
  logBuffer.push(text);
  if (logBuffer.length > MAX_LOG_BUFFER) {
    logBuffer.shift();
  }
  broadcastSSE({ type: 'log', data: text });
}

function findChromeBinary() {
  const candidates = [
    process.env['ProgramFiles'] ? path.join(process.env['ProgramFiles'], 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
    process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
    process.env['LocalAppData'] ? path.join(process.env['LocalAppData'], 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
  ].filter(Boolean);

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Serve Dashboard HTML
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/dashboard.html')) {
    if (!fs.existsSync(DASHBOARD_HTML_PATH)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('dashboard.html not found');
      return;
    }
    const html = fs.readFileSync(DASHBOARD_HTML_PATH, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // SSE Log Stream
  if (req.method === 'GET' && url.pathname === '/api/logs') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    sseClients.add(res);

    // Send buffered recent logs to newly connected client
    if (logBuffer.length > 0) {
      const replay = logBuffer.join('');
      res.write(`data: ${JSON.stringify({ type: 'log', data: replay })}\n\n`);
    }

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // Status check
  if (req.method === 'GET' && url.pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      isRunning: currentChild !== null,
      platform: currentPlatform,
      pid: currentChild ? currentChild.pid : null
    }));
    return;
  }

  // Launch Chrome Debug
  if (req.method === 'POST' && url.pathname === '/api/launch-chrome') {
    const chromeBin = findChromeBinary();
    if (!chromeBin) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Google Chrome binary not found in standard system locations.'
      }));
      return;
    }

    const userDataDir = path.join(os.homedir(), '.biotailr-chrome-profile');
    const extensionDir = path.resolve(__dirname, '..', 'BioTailr-AI-Extension');

    const args = [
      '--remote-debugging-port=9222',
      `--user-data-dir=${userDataDir}`,
      '--window-size=1400,900',
    ];

    if (fs.existsSync(extensionDir)) {
      args.push(`--load-extension=${extensionDir}`);
    }

    args.push('https://www.linkedin.com/jobs/');

    try {
      const chromeProc = spawn(chromeBin, args, {
        detached: true,
        stdio: 'ignore'
      });
      chromeProc.unref();

      appendToBufferAndBroadcast(`[SYSTEM] Launched Google Chrome with CDP on port 9222.\n`);
      appendToBufferAndBroadcast(`[SYSTEM] Profile: ${userDataDir}\n`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Chrome Debug launched successfully on port 9222.'
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: `Failed to launch Chrome: ${e.message}`
      }));
    }
    return;
  }

  // Start Runner
  if (req.method === 'POST' && url.pathname === '/api/start') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      if (currentChild !== null) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: `A runner process is already running (PID: ${currentChild.pid}, Platform: ${currentPlatform}).`
        }));
        return;
      }

      let parsed = {};
      try {
        parsed = JSON.parse(body);
      } catch (e) {}

      const platform = (parsed.platform || 'linkedin').toLowerCase();
      let scriptFile = 'apply-runner.js';
      if (platform === 'yc') {
        scriptFile = 'yc-runner.js';
      }

      const scriptPath = path.join(__dirname, scriptFile);
      if (!fs.existsSync(scriptPath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: `Runner script ${scriptFile} not found.` }));
        return;
      }

      currentPlatform = platform;
      appendToBufferAndBroadcast(`\n======================================================\n`);
      appendToBufferAndBroadcast(`[SPAWN] Starting ${platform.toUpperCase()} runner (${scriptFile})...\n`);
      appendToBufferAndBroadcast(`======================================================\n`);

      try {
        currentChild = spawn(process.execPath, [scriptPath], {
          cwd: __dirname,
          env: { ...process.env, FORCE_COLOR: '0' }
        });

        currentChild.stdout.on('data', data => {
          appendToBufferAndBroadcast(data.toString());
        });

        currentChild.stderr.on('data', data => {
          appendToBufferAndBroadcast(data.toString());
        });

        currentChild.on('close', (code) => {
          appendToBufferAndBroadcast(`\n[PROCESS] Runner process ${currentChild ? currentChild.pid : ''} terminated with code ${code}.\n`);
          broadcastSSE({ type: 'exit', code });
          currentChild = null;
          currentPlatform = 'NONE';
        });

        currentChild.on('error', (err) => {
          appendToBufferAndBroadcast(`\n[PROCESS ERROR] ${err.message}\n`);
          currentChild = null;
          currentPlatform = 'NONE';
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          platform,
          pid: currentChild.pid
        }));
      } catch (err) {
        currentChild = null;
        currentPlatform = 'NONE';
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Stop Runner
  if (req.method === 'POST' && url.pathname === '/api/stop') {
    if (!currentChild) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'No runner is currently active.' }));
      return;
    }

    const pid = currentChild.pid;
    appendToBufferAndBroadcast(`\n[SYSTEM] Terminating runner process PID ${pid}...\n`);

    if (process.platform === 'win32') {
      exec(`taskkill /pid ${pid} /T /F`, (err) => {
        if (err) {
          appendToBufferAndBroadcast(`[SYSTEM] taskkill note: ${err.message}\n`);
        }
      });
    } else {
      currentChild.kill('SIGTERM');
    }

    currentChild = null;
    currentPlatform = 'NONE';

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: `Terminated runner PID ${pid}.` }));
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

// Periodic heartbeat for SSE
setInterval(() => {
  for (const client of sseClients) {
    try {
      client.write(': heartbeat\n\n');
    } catch (e) {
      sseClients.delete(client);
    }
  }
}, 15000);

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` BioTailr AI StandBy - Web Control Center`);
  console.log(` Server running at: http://localhost:${PORT}`);
  console.log(` Open this link in your browser to run with buttons!`);
  console.log(`====================================================`);
});
