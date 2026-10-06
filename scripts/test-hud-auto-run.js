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
        console.log('Triggering Auto-Apply on newly loaded job...');
        const code = `(() => {
          const title = document.querySelector('.job-details-jobs-unified-top-card__job-title, h1')?.innerText;
          const btn = document.getElementById('bt-btn-auto-apply');
          if (btn) {
            btn.click();
            return { triggered: true, title, btnText: btn.innerText.trim() };
          }
          return { triggered: false, title };
        })()`;
        ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
      };
      ws.onmessage = (event) => {
        const parsed = JSON.parse(event.data);
        if (parsed.id === 1) {
          console.log('HUD Trigger status:', JSON.stringify(parsed.result.result.value, null, 2));
          setTimeout(() => {
            const checkStatus = `(() => {
              const feed = document.getElementById('bt-hud-feed');
              const lines = Array.from(feed ? feed.querySelectorAll('.bt-feed-line') : []).map(l => l.innerText);
              const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
              return {
                lines: lines.slice(-12),
                hasModal: !!modal,
                modalTitle: modal ? modal.querySelector('h1, h2, h3, .jobs-easy-apply-modal__title')?.innerText : null
              };
            })()`;
            ws.send(JSON.stringify({ id: 2, method: 'Runtime.evaluate', params: { expression: checkStatus, returnByValue: true } }));
          }, 3500);
        } else if (parsed.id === 2) {
          console.log('Agent Execution Progress:', JSON.stringify(parsed.result.result.value, null, 2));
          ws.close();
        }
      };
    });
  });
}, 3500);
