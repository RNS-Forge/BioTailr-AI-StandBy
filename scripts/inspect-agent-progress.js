const http = require('http');

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const tabs = JSON.parse(data);
    const li = tabs.find(t => t.url && t.url.includes('linkedin.com/jobs'));
    const ws = new WebSocket(li.webSocketDebuggerUrl);
    ws.onopen = () => {
      const code = `(() => {
        const feed = document.getElementById('bt-hud-feed');
        const lines = Array.from(feed ? feed.querySelectorAll('.bt-feed-line') : []).map(l => l.innerText);
        const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
        const btn = document.getElementById('bt-btn-auto-apply');
        return {
          buttonText: btn ? btn.innerText.trim() : null,
          lines: lines.slice(-15),
          hasModal: !!modal,
          modalTitle: modal ? modal.querySelector('h1, h2, h3, .jobs-easy-apply-modal__title')?.innerText : null,
          modalSnippet: modal ? modal.innerText.slice(0, 300) : null
        };
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      console.log('Current Agent Progress:', JSON.stringify(parsed.result.result.value, null, 2));
      ws.close();
    };
  });
});
