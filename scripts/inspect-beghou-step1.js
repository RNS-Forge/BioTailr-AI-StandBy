const http = require('http');

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const tabs = JSON.parse(data);
    const li = tabs.find(t => t.url && t.url.includes('linkedin.com/jobs'));
    const ws = new WebSocket(li.webSocketDebuggerUrl);
    ws.onopen = () => {
      // Step through modal step 1
      const code = `(() => {
        const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
        if (!modal) return { error: 'No modal' };

        // Inspect all fields on current step
        const inputs = Array.from(modal.querySelectorAll('input, select, textarea')).map(i => ({
          id: i.id,
          tag: i.tagName,
          type: i.type,
          value: i.value,
          label: i.closest('label')?.innerText || i.getAttribute('aria-label') || i.placeholder || i.name
        }));

        // Find Next / Review button
        const buttons = Array.from(modal.querySelectorAll('button')).map(b => ({
          text: b.innerText.trim(),
          aria: b.getAttribute('aria-label'),
          classes: b.className
        }));

        return {
          title: modal.querySelector('h1, h2, h3, .jobs-easy-apply-modal__title')?.innerText,
          pageText: modal.innerText.slice(0, 200),
          inputs,
          buttons
        };
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.id === 1) {
        console.log('Step 1 info:', JSON.stringify(parsed.result.result.value, null, 2));
        ws.close();
      }
    };
  });
});
