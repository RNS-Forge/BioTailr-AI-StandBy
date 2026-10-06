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
        try {
          return {
            hasOrchestrator: typeof window.AutoApplyOrchestrator !== 'undefined',
            hasAgent: typeof window.BioTailrApplyAgent !== 'undefined',
            hasLinkedIn: typeof window.LinkedInPlatform !== 'undefined',
            modalFound: !!document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal'),
            scripts: Array.from(document.querySelectorAll('script')).map(s => s.src).filter(Boolean)
          };
        } catch(e) {
          return { error: e.message, stack: e.stack };
        }
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.id === 1) {
        console.log('Environment check in LinkedIn tab:', parsed.result.result.value);
        ws.close();
      }
    };
  });
});
