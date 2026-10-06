const http = require('http');

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const tabs = JSON.parse(data);
    const li = tabs.find(t => t.url && t.url.includes('linkedin.com/jobs'));
    const ws = new WebSocket(li.webSocketDebuggerUrl);
    ws.onopen = () => {
      const targetUrl = 'https://www.linkedin.com/jobs/search/?keywords=full-time%20SQL%20Developer%20or%20Generative%20AI%20Engineer%20or%20Full%20Stack%20Engineer%20or%20Frontend%20Developer%20or%20Artificial%20Intelligence%20Engineer%2C%20on-site%20or%20hybrid%20or%20remote&f_AL=true&geoId=101031506';
      console.log('Navigating to target search feed...');
      ws.send(JSON.stringify({ id: 1, method: 'Page.navigate', params: { url: targetUrl } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.id === 1) {
        console.log('Navigation initiated:', parsed.result);
        ws.close();
      }
    };
  });
});
