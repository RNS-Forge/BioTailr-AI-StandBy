const http = require('http');

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const tabs = JSON.parse(data);
    const sw = tabs.find(t => t.url && t.url.includes('background.js'));
    if (!sw) {
      console.log('No background service worker found. Attempting extensions page reload...');
      return;
    }
    console.log('Connecting to background service worker:', sw.id);
    const ws = new WebSocket(sw.webSocketDebuggerUrl);
    ws.onopen = () => {
      console.log('Reloading extension...');
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: 'chrome.runtime.reload()' } }));
    };
    ws.onmessage = (event) => {
      console.log('Reload response:', event.data);
      ws.close();
    };
    setTimeout(() => {
      console.log('Reload signal sent.');
      process.exit(0);
    }, 1000);
  });
});
