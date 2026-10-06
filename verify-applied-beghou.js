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
        const postSubmitModal = document.querySelector('.artdeco-modal');
        const title = document.querySelector('.job-details-jobs-unified-top-card__job-title, h1')?.innerText;
        const appliedIndicator = Array.from(document.querySelectorAll('span, div')).some(e => e.innerText && e.innerText.trim().toLowerCase() === 'applied');
        return {
          hasModal: !!modal,
          modalText: modal ? modal.innerText.slice(0, 300) : null,
          hasPostSubmitModal: !!postSubmitModal,
          postSubmitText: postSubmitModal ? postSubmitModal.innerText.slice(0, 300) : null,
          title,
          appliedIndicator
        };
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      console.log('Post-submit check:', JSON.stringify(parsed.result.result.value, null, 2));
      ws.close();
    };
  });
});
