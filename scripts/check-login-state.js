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
        const bodyText = document.body.innerText.slice(0, 500);
        const navProfile = document.querySelector('.global-nav__me, img[alt*="Sanjay"], button[aria-label*="Me"]');
        const signInBtn = Array.from(document.querySelectorAll('a, button')).find(b => b.innerText.trim().toLowerCase() === 'sign in');
        return {
          bodyText,
          hasNavProfile: !!navProfile,
          hasSignIn: !!signInBtn
        };
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      console.log('Login check:', JSON.stringify(parsed.result.result.value, null, 2));
      ws.close();
    };
  });
});
