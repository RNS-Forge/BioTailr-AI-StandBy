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
        const cards = Array.from(document.querySelectorAll('.jobs-search-results-list__list-item, .job-card-container, [data-occludable-job-id]')).map(c => {
          const title = c.querySelector('a.job-card-container__link, .job-card-list__title, h2, h3, a')?.innerText.trim().replace(/\\n+/g, ' ');
          const text = c.innerText.toLowerCase();
          const isApplied = text.includes('applied') || text.includes('application submitted');
          const isEasyApply = text.includes('easy apply');
          const jobId = c.getAttribute('data-occludable-job-id') || c.getAttribute('data-job-id');
          return { jobId, title, isApplied, isEasyApply };
        }).filter(c => c.title);
        return cards;
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      console.log('Cards in feed:', JSON.stringify(parsed.result.result.value, null, 2));
      ws.close();
    };
  });
});
