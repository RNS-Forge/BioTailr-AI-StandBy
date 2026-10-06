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
        if (!modal) return { error: 'No modal' };

        // Scroll to bottom
        const scrollContainers = [
          modal.querySelector('.jobs-easy-apply-modal__content'),
          modal.querySelector('.artdeco-modal__content'),
          modal
        ];
        scrollContainers.forEach(sc => { if (sc) sc.scrollTop = sc.scrollHeight; });

        // Find submit button
        const submitBtn = Array.from(modal.querySelectorAll('button')).find(b => {
          const t = b.innerText.trim().toLowerCase();
          return t === 'submit application' || t === 'submit';
        });

        if (!submitBtn) return { error: 'No submit button found' };

        submitBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
        submitBtn.click();
        return { clickedSubmit: true, btnText: submitBtn.innerText.trim() };
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      console.log('Submission action:', parsed.result);
      setTimeout(() => {
        // Dismiss confirmation
        const dismissCode = `(() => {
          const dismissBtn = document.querySelector('.artdeco-modal__dismiss, [data-test-modal-close-btn], button[aria-label="Dismiss"], button[aria-label="Done"]');
          if (dismissBtn) {
            dismissBtn.click();
            return { dismissed: true };
          }
          return { dismissed: false };
        })()`;
        ws.send(JSON.stringify({ id: 2, method: 'Runtime.evaluate', params: { expression: dismissCode, returnByValue: true } }));
      }, 1200);
      if (parsed.id === 2) {
        console.log('Dismiss result:', parsed.result);
        ws.close();
      }
    };
  });
});
