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
        const dialog = document.querySelector('dialog, [role="dialog"], .artdeco-modal');
        if (!dialog) return { noDialog: true };
        const buttons = Array.from(dialog.querySelectorAll('button')).map(b => ({
          text: b.innerText.trim(),
          aria: b.getAttribute('aria-label'),
          classes: b.className
        }));
        return { dialogTitle: dialog.innerText.slice(0, 100), buttons };
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      console.log('Dialog buttons:', JSON.stringify(parsed.result.result.value, null, 2));
      ws.close();
    };
  });
});
