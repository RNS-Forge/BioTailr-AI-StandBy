const http = require('http');

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const tabs = JSON.parse(data);
    const li = tabs.find(t => t.url && t.url.includes('linkedin.com/jobs'));
    const ws = new WebSocket(li.webSocketDebuggerUrl);
    ws.onopen = () => {
      console.log('Clicking on-screen Auto-Apply button...');
      const code = `(() => {
        const btn = document.getElementById('bt-btn-auto-apply');
        if (btn) {
          btn.click();
          return { clicked: true, text: btn.innerText.trim() };
        }
        return { clicked: false };
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.id === 1) {
        console.log('Clicked HUD auto-apply button:', parsed.result);
        setTimeout(() => {
          const checkStatus = `(() => {
            const feed = document.getElementById('bt-hud-feed');
            const lines = Array.from(feed ? feed.querySelectorAll('.bt-feed-line') : []).map(l => l.innerText);
            const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
            const btn = document.getElementById('bt-btn-auto-apply');
            return {
              buttonText: btn ? btn.innerText.trim() : null,
              lines,
              hasModal: !!modal,
              modalTitle: modal ? modal.querySelector('h1, h2, h3, .jobs-easy-apply-modal__title')?.innerText : null
            };
          })()`;
          ws.send(JSON.stringify({ id: 2, method: 'Runtime.evaluate', params: { expression: checkStatus, returnByValue: true } }));
        }, 2000);
      } else if (parsed.id === 2) {
        console.log('HUD Status after click:', JSON.stringify(parsed.result.result.value, null, 2));
        ws.close();
      }
    };
  });
});
