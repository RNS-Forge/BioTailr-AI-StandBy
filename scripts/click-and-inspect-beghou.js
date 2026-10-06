const http = require('http');

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const tabs = JSON.parse(data);
    const li = tabs.find(t => t.url && t.url.includes('linkedin.com/jobs'));
    const ws = new WebSocket(li.webSocketDebuggerUrl);
    ws.onopen = () => {
      // Find Easy Apply button and inspect it
      const code = `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim().toLowerCase().includes('easy apply') && b.offsetWidth > 0);
        if (!btn) return { status: 'no_easy_apply_button' };
        btn.click();
        return { status: 'clicked_easy_apply' };
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
    };
    ws.onmessage = async (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.id === 1) {
        console.log('Clicked Easy Apply:', parsed.result);
        setTimeout(() => {
          // Check what modal opened
          const checkCode = `(() => {
            const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
            if (!modal) return { modalFound: false };
            const inputs = Array.from(modal.querySelectorAll('input, select, textarea')).map(i => ({
              id: i.id,
              tag: i.tagName,
              type: i.type,
              value: i.value,
              label: i.closest('label')?.innerText || i.getAttribute('aria-label') || i.placeholder || i.name
            }));
            const buttons = Array.from(modal.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
            return {
              modalFound: true,
              title: modal.querySelector('h1, h2, h3, .jobs-easy-apply-modal__title')?.innerText,
              inputs,
              buttons
            };
          })()`;
          ws.send(JSON.stringify({ id: 2, method: 'Runtime.evaluate', params: { expression: checkCode, returnByValue: true } }));
        }, 1000);
      } else if (parsed.id === 2) {
        console.log('Modal details:', JSON.stringify(parsed.result.result.value, null, 2));
        ws.close();
      }
    };
  });
});
