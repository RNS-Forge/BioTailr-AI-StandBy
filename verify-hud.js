const http = require('http');

setTimeout(() => {
  http.get('http://127.0.0.1:9222/json', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const tabs = JSON.parse(data);
      const li = tabs.find(t => t.url && t.url.includes('linkedin.com/jobs'));
      const ws = new WebSocket(li.webSocketDebuggerUrl);
      ws.onopen = () => {
        const code = `(() => {
          const hud = document.getElementById('biotailr-agent-hud');
          const easyApplyBtn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').toLowerCase().includes('easy apply') && b.offsetWidth > 0);
          const jobTitle = document.querySelector('.job-details-jobs-unified-top-card__job-title, h1')?.innerText;
          return {
            hudFound: !!hud,
            hudHtml: hud ? hud.innerHTML.slice(0, 150) : null,
            easyApplyFound: !!easyApplyBtn,
            jobTitle
          };
        })()`;
        ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
      };
      ws.onmessage = (event) => {
        const parsed = JSON.parse(event.data);
        console.log('Post-reload verification:', JSON.stringify(parsed.result.result.value, null, 2));
        ws.close();
      };
    });
  });
}, 3500);
