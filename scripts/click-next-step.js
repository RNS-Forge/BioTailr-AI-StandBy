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
        const nextBtn = Array.from(modal.querySelectorAll('button')).find(b => b.innerText.trim().toLowerCase() === 'next');
        if (nextBtn) {
          nextBtn.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.id === 1) {
        console.log('Clicked next:', parsed.result);
        setTimeout(() => {
          const inspect = `(() => {
            const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
            const inputs = Array.from(modal.querySelectorAll('input, select, textarea')).map(i => ({
              id: i.id,
              tag: i.tagName,
              type: i.type,
              value: i.value,
              label: i.closest('label')?.innerText || i.getAttribute('aria-label') || i.placeholder || i.name
            }));
            const buttons = Array.from(modal.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
            return {
              textSnippet: modal.innerText.slice(0, 300),
              inputs,
              buttons
            };
          })()`;
          ws.send(JSON.stringify({ id: 2, method: 'Runtime.evaluate', params: { expression: inspect, returnByValue: true } }));
        }, 1000);
      } else if (parsed.id === 2) {
        console.log('Step 2 info:', JSON.stringify(parsed.result.result.value, null, 2));
        ws.close();
      }
    };
  });
});
