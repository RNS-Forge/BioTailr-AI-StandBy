const http = require('http');

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const tabs = JSON.parse(data);
    const li = tabs.find(t => t.url && t.url.includes('linkedin.com/jobs'));
    const ws = new WebSocket(li.webSocketDebuggerUrl);
    ws.onopen = () => {
      console.log('Reloading LinkedIn page to attach refreshed content scripts...');
      ws.send(JSON.stringify({ id: 1, method: 'Page.reload' }));
    };
    ws.onmessage = (event) => {
      console.log('Reload sent.');
      ws.close();
    };
  });
});
