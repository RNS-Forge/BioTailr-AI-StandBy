const fs = require('fs');
const http = require('http');

async function updateLiveHUD() {
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
        res(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  const hudJs = fs.readFileSync('c:/Temp Files/My Projects/BioTailr.ai/BioTailr-AI-Extension/automation/screen-hud.js', 'utf8');

  // Inject
  const cleanup = await cdp('Runtime.evaluate', {
    expression: `(() => {
      document.getElementById('biotailr-agent-hud')?.remove();
      window.__biotailr_hud_loaded = false;
      return 'Cleaned';
    })()`,
    returnByValue: true
  });
  console.log('Cleanup:', cleanup);

  const evalRes = await cdp('Runtime.evaluate', {
    expression: hudJs,
    returnByValue: true
  });
  console.log('HudJs eval:', evalRes);

  // Open panel and inspect
  const res = await cdp('Runtime.evaluate', {
    expression: `(() => {
      const pill = document.querySelector('#bt-hud-pill');
      const panel = document.querySelector('#bt-hud-panel');
      if (pill && !panel.classList.contains('open')) pill.click();

      const pillStyle = pill ? window.getComputedStyle(pill) : {};
      const panelStyle = panel ? window.getComputedStyle(panel) : {};
      const btn = document.querySelector('.bt-btn-primary');
      const btnStyle = btn ? window.getComputedStyle(btn) : {};

      return {
        pillFound: !!pill,
        pillBorderRadius: pillStyle.borderRadius,
        pillBackground: pillStyle.backgroundColor,
        panelBorderRadius: panelStyle.borderRadius,
        panelBackground: panelStyle.backgroundColor,
        panelBorder: panelStyle.border,
        btnBorderRadius: btnStyle.borderRadius,
        btnBackground: btnStyle.backgroundColor,
        btnColor: btnStyle.color,
        isOpen: panel ? panel.classList.contains('open') : false
      };
    })()`,
    returnByValue: true
  });

  console.log('Verified HUD:', JSON.stringify(res?.result?.value, null, 2));
  ws.close();
}

updateLiveHUD();
