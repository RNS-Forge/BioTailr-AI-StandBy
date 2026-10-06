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
        const radios = Array.from(modal.querySelectorAll('input[type="radio"]'));
        const clicked = [];
        radios.forEach(r => {
          let p = r.parentElement;
          let label = '';
          while (p && p.tagName !== 'FIELDSET' && p.tagName !== 'FORM') {
            if (p.innerText && p.innerText.trim()) { label = p.innerText.trim(); break; }
            p = p.parentElement;
          }
          if (label.toLowerCase().includes('yes')) {
            r.click();
            r.dispatchEvent(new Event('change', { bubbles: true }));
            clicked.push({ id: r.id, label });
          }
        });
        return { clicked };
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      console.log('Clicked radios:', JSON.stringify(parsed.result.result.value, null, 2));
      ws.close();
    };
  });
});
