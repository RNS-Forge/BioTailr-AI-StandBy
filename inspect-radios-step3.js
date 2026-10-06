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
        const radios = Array.from(modal.querySelectorAll('input[type="radio"]')).map(r => ({
          id: r.id,
          name: r.name,
          value: r.value,
          checked: r.checked,
          parentText: r.parentElement ? r.parentElement.innerText.trim() : '',
          grandParentText: r.parentElement?.parentElement ? r.parentElement.parentElement.innerText.trim() : '',
          fieldset: r.closest('fieldset')?.innerText.slice(0, 100)
        }));
        return radios;
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      console.log('Radios details:', JSON.stringify(parsed.result.result.value, null, 2));
      ws.close();
    };
  });
});
