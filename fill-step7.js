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
        const input = modal.querySelector('input[type="text"]');
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement?.prototype || {}, 'value')?.set;
          if (setter) setter.call(input, 'Coimbatore, Tamil Nadu, India');
          else input.value = 'Coimbatore, Tamil Nadu, India';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('blur', { bubbles: true }));
        }
        const reviewBtn = Array.from(modal.querySelectorAll('button')).find(b => b.innerText.trim().toLowerCase().includes('review'));
        if (reviewBtn) reviewBtn.click();
        return { filledLocation: true };
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      console.log('Filled step 7 & review:', parsed.result);
      ws.close();
    };
  });
});
