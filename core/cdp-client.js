/**
 * BioTailr AI StandBy - CDP Client
 * Handles Chrome DevTools Protocol WebSocket communication and tab management.
 */

const http = require('http');

function log(tag, message) {
  const ts = new Date().toLocaleTimeString([], { hour12: false });
  console.log(`[${ts}] [${tag}] ${message}`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function fetchTabsJson(host, port) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://${host}:${port}/json`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(2000, () => {
      req.destroy();
      reject(new Error('Connection timed out'));
    });
  });
}

async function getBrowserTabs(port = 9222) {
  try {
    return await fetchTabsJson('127.0.0.1', port);
  } catch (err1) {
    try {
      return await fetchTabsJson('localhost', port);
    } catch (err2) {
      throw new Error(`Failed to connect to Chrome on port ${port}. Ensure Chrome was started with --remote-debugging-port=${port}. (${err1.message}; ${err2.message})`);
    }
  }
}

async function getTargetTab(port = 9222, urlKeywords = ['linkedin.com/jobs', 'indeed.com/jobs']) {
  const tabs = await getBrowserTabs(port);
  const pageTabs = tabs.filter(t => t.type === 'page' && t.url);
  
  for (const keyword of urlKeywords) {
    const match = pageTabs.find(t => t.url.toLowerCase().includes(keyword.toLowerCase()));
    if (match) return match;
  }

  // Fallback: any LinkedIn or Indeed page
  const fallback = pageTabs.find(t => /linkedin\.com|indeed\.com/i.test(t.url));
  if (fallback) return fallback;

  throw new Error('No active job board tab (LinkedIn / Indeed) detected in Chrome. Please open job search results in the debugging Chrome window.');
}

async function connectWebSocket(webSocketDebuggerUrl) {
  try {
    const ws = new WebSocket(webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });
    return ws;
  } catch (err) {
    let altUrl = webSocketDebuggerUrl;
    if (webSocketDebuggerUrl.includes('127.0.0.1')) {
      altUrl = webSocketDebuggerUrl.replace('127.0.0.1', 'localhost');
    } else if (webSocketDebuggerUrl.includes('localhost')) {
      altUrl = webSocketDebuggerUrl.replace('localhost', '127.0.0.1');
    }
    const ws2 = new WebSocket(altUrl);
    await new Promise((resolve, reject) => {
      ws2.onopen = resolve;
      ws2.onerror = reject;
    });
    return ws2;
  }
}

function cdpEval(ws, expression, awaitPromise = false) {
  return new Promise((resolve) => {
    const id = Math.floor(Math.random() * 1000000);
    const handler = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.id === id) {
        ws.removeEventListener('message', handler);
        resolve(parsed.result?.result?.value);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({
      id,
      method: 'Runtime.evaluate',
      params: { expression, awaitPromise, returnByValue: true }
    }));
  });
}

function cdpSend(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const handler = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.id === id) {
        ws.removeEventListener('message', handler);
        if (parsed.error) reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
        else resolve(parsed.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

module.exports = {
  log,
  sleep,
  getBrowserTabs,
  getTargetTab,
  connectWebSocket,
  cdpEval,
  cdpSend
};
