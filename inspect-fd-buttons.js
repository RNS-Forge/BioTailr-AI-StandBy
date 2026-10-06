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
        const topButtons = Array.from(document.querySelectorAll('.jobs-details button, .jobs-unified-top-card button')).map(b => ({
          text: b.innerText.trim(),
          visible: b.offsetWidth > 0,
          classes: b.className
        }));
        const topCardText = document.querySelector('.jobs-unified-top-card')?.innerText.slice(0, 300);
        return { topCardText, topButtons };
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      console.log('Top card buttons:', JSON.stringify(parsed.result.result.value, null, 2));
      ws.close();
    };
  });
});
