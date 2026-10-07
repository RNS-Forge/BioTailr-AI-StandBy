const { connectWebSocket, cdpEval } = require('../core/cdp-client');
const { inspectJobDetailPage } = require('../platforms/yc/card-selector');
const http = require('http');

async function main() {
  const newTab = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 9222,
      path: '/json/new?' + encodeURIComponent('https://www.workatastartup.com/jobs/79944'),
      method: 'PUT'
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });

  await new Promise(r => setTimeout(r, 3500));
  const ws = await connectWebSocket(newTab.webSocketDebuggerUrl);

  const detail = await inspectJobDetailPage(ws, cdpEval);
  console.log('inspectJobDetailPage result on 79944:');
  console.log(JSON.stringify(detail, null, 2));

  await new Promise(resolve => {
    http.get(`http://127.0.0.1:9222/json/close/${newTab.id}`, () => resolve());
  });
  ws.close();
}
main().catch(console.error);
