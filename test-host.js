const http = require('http');

async function testHost() {
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

  const res = await evalCDP(`(() => {
    const host = document.createElement('div');
    host.id = 'test-host';
    host.innerHTML = \`
      <div id="bt-hud-panel">Panel</div>
      <div id="bt-hud-pill">Pill</div>
    \`;
    const pill = host.querySelector('#bt-hud-pill');
    return {
      hasPill: !!pill,
      pillText: pill?.innerText
    };
  })()`);

  console.log('Test Host Result:', res);
  ws.close();
}

testHost();
