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
        const links = Array.from(document.querySelectorAll('a[href*="/jobs/view/"], a[href*="currentJobId="]')).map(a => ({
          href: a.href,
          text: a.innerText.trim().replace(/\\n+/g, ' ')
        })).filter(a => a.text.length > 3);
        return links.slice(0, 15);
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      console.log('Job links:', JSON.stringify(parsed.result.result.value, null, 2));
      ws.close();
    };
  });
});
