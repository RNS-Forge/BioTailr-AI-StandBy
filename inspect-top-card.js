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
        const topCard = document.querySelector('.job-details-jobs-unified-top-card__primary-description, .jobs-unified-top-card')?.innerText;
        const allTopText = document.querySelector('.jobs-details')?.innerText.slice(0, 400);
        const easyApplyBtns = Array.from(document.querySelectorAll('button')).filter(b => (b.innerText || '').toLowerCase().includes('easy apply'));
        return {
          topCard,
          allTopText,
          easyApplyCount: easyApplyBtns.length,
          easyApplyTexts: easyApplyBtns.map(b => b.innerText.trim())
        };
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      console.log('LinkedIn top card details:', JSON.stringify(parsed.result.result.value, null, 2));
      ws.close();
    };
  });
});
