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
        const dismiss = document.querySelector('button.artdeco-modal__dismiss, button[aria-label="Dismiss"]')
          || Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim().toLowerCase() === 'not now');
        if (dismiss) {
          dismiss.click();
          return { clickedDismiss: true, text: dismiss.innerText || dismiss.getAttribute('aria-label') };
        }
        return { clickedDismiss: false };
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      console.log('Dismiss result:', parsed.result);
      ws.close();
    };
  });
});
