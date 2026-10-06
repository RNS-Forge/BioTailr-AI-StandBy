const fs = require('fs');
const http = require('http');

async function debugHUD() {
  const tabs = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const li = tabs.find(t => t.url && t.url.includes('linkedin.com/jobs'));
  const ws = new WebSocket(li.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let nextId = 1;
  const cdp = (method, params) => new Promise(res => {
    const id = nextId++;
    const handler = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        res(msg);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  const res = await cdp('Runtime.evaluate', {
    expression: `(() => {
      const old = document.getElementById('biotailr-agent-hud');
      if (old) old.remove();
      window.__biotailr_hud_loaded = false;
      return { removedOld: !!old };
    })()`,
    returnByValue: true
  });
  console.log('Old element cleanup:', res);

  // Now read screen-hud.js
  const hudJs = fs.readFileSync('c:/Temp Files/My Projects/BioTailr.ai/BioTailr-AI-Extension/automation/screen-hud.js', 'utf8');
  const inject = await cdp('Runtime.evaluate', {
    expression: hudJs,
    returnByValue: true
  });
  console.log('Inject result:', inject);

  ws.close();
}

debugHUD();
