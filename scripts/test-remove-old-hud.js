const { getTargetTab, connectWebSocket } = require('../core/cdp-client');

(async () => {
  const tab = await getTargetTab(9222, ['linkedin.com/jobs']);
  const ws = await connectWebSocket(tab.webSocketDebuggerUrl);

  const res = await new Promise((resolve) => {
    const id = 98765;
    const handler = (evt) => {
      const p = JSON.parse(evt.data);
      if (p.id === id) {
        ws.removeEventListener('message', handler);
        resolve(p);
      }
    };
    ws.addEventListener('message', handler);
    // Let's test evaluating removing the old HUD
    const expr = `(() => {
      const els = document.querySelectorAll('#biotailr-agent-hud, .bt-hud-panel, .bt-hud-pill');
      els.forEach(e => e.remove());
      return { removedCount: els.length, remaining: document.querySelectorAll('#biotailr-agent-hud, .bt-hud-panel, .bt-hud-pill').length };
    })()`;
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
  });

  console.log('Result:', JSON.stringify(res, null, 2));
  ws.close();
})();
