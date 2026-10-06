const http = require('http');

async function checkHUD() {
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

  const evalCDP = (expr) => new Promise(res => {
    const id = 123;
    ws.onmessage = (e) => {
      const p = JSON.parse(e.data);
      if (p.id === id) res(p.result?.result?.value);
    };
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
  });

  const info = await evalCDP(`(() => {
    const pill = document.querySelector('#bt-hud-pill');
    const panel = document.querySelector('#bt-hud-panel');
    if (pill && panel && !panel.classList.contains('open')) {
      pill.click();
    }

    const pillStyle = pill ? window.getComputedStyle(pill) : null;
    const panelStyle = panel ? window.getComputedStyle(panel) : null;
    const btnPrimary = document.querySelector('.bt-btn-primary');
    const btnPrimaryStyle = btnPrimary ? window.getComputedStyle(btnPrimary) : null;
    const btnSecondary = document.querySelector('.bt-btn-secondary');
    const btnSecondaryStyle = btnSecondary ? window.getComputedStyle(btnSecondary) : null;
    const badge = document.querySelector('#bt-hud-badge');
    const badgeStyle = badge ? window.getComputedStyle(badge) : null;

    return {
      pill: {
        found: !!pill,
        text: pill?.innerText?.trim(),
        borderRadius: pillStyle?.borderRadius,
        backgroundColor: pillStyle?.backgroundColor,
        color: pillStyle?.color,
        border: pillStyle?.border
      },
      panel: {
        found: !!panel,
        isOpen: panel?.classList.contains('open'),
        borderRadius: panelStyle?.borderRadius,
        backgroundColor: panelStyle?.backgroundColor,
        border: panelStyle?.border,
        boxShadow: panelStyle?.boxShadow
      },
      btnPrimary: {
        text: btnPrimary?.innerText?.trim(),
        borderRadius: btnPrimaryStyle?.borderRadius,
        backgroundColor: btnPrimaryStyle?.backgroundColor,
        color: btnPrimaryStyle?.color
      },
      btnSecondary: {
        text: btnSecondary?.innerText?.trim(),
        borderRadius: btnSecondaryStyle?.borderRadius,
        backgroundColor: btnSecondaryStyle?.backgroundColor,
        color: btnSecondaryStyle?.color
      },
      badge: {
        text: badge?.innerText?.trim(),
        borderRadius: badgeStyle?.borderRadius,
        backgroundColor: badgeStyle?.backgroundColor,
        color: badgeStyle?.color
      }
    };
  })()`);

  console.log('HUD Styling Details:\n', JSON.stringify(info, null, 2));
  ws.close();
}

checkHUD();
