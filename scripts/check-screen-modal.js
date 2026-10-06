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
        const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
        if (!modal) return { open: false };
        const buttons = Array.from(modal.querySelectorAll('button')).map(b => ({
          text: b.innerText.trim(),
          aria: b.getAttribute('aria-label'),
          visible: b.offsetWidth > 0
        }));
        return {
          open: true,
          title: modal.querySelector('h1, h2, h3, .jobs-easy-apply-modal__title')?.innerText,
          buttons,
          textSnippet: modal.innerText.slice(0, 300)
        };
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.id === 1) {
        console.log('Current modal on screen:', JSON.stringify(parsed.result.result.value, null, 2));
        ws.close();
      }
    };
  });
});
