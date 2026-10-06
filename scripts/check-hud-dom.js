const http = require('http');

async function testDom() {
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

  const dom = await evalCDP(`(() => {
    const host = document.getElementById('biotailr-agent-hud');
    if (!host) return 'No host';
    const children = Array.from(host.children).map(c => ({ tag: c.tagName, id: c.id, className: c.className }));
    const pill = host.querySelector('#bt-hud-pill');
    const panel = host.querySelector('#bt-hud-panel');
    return {
      children,
      pill: !!pill,
      panel: !!panel
    };
  })()`);

  console.log('DOM check children:', dom);
  ws.close();
}

testDom();
