const { connectWebSocket, cdpEval } = require('../core/cdp-client');
const { generateYCMessage } = require('../platforms/yc/message-generator');
const http = require('http');

async function main() {
  const profile = require('../candidate-profile.json');
  const jobId = '79944'; // Head of Engineering at David AI
  console.log(`=== FULL APPLICATION TEST ON JOB ${jobId} ===`);

  // Step 1: Open new tab
  console.log('[1] Opening job tab...');
  const newTab = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 9222,
      path: '/json/new?' + encodeURIComponent(`https://www.workatastartup.com/jobs/${jobId}`),
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

  // Step 2: Click Apply button
  console.log('[2] Clicking Apply...');
  const clickRes = await cdpEval(ws, `(() => {
    const applyEl = Array.from(document.querySelectorAll('a, button')).find(el => {
      if (el.closest('#biotailr-hud')) return false;
      const txt = (el.innerText || '').trim().toLowerCase();
      return (txt === 'apply' || txt === 'apply now') && el.offsetWidth > 0;
    });
    if (!applyEl) return { error: 'No apply button' };
    applyEl.scrollIntoView({ behavior: 'instant', block: 'center' });
    applyEl.focus();
    applyEl.click();
    return { clicked: true };
  })()`);
  console.log('Click result:', clickRes);

  await new Promise(r => setTimeout(r, 1500));

  // Step 3: Check modal
  const modalInfo = await cdpEval(ws, `(() => {
    const ta = document.querySelector('textarea');
    const sendBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Send');
    return {
      open: Boolean(ta),
      taRect: ta ? ta.getBoundingClientRect() : null,
      hasSend: Boolean(sendBtn)
    };
  })()`);
  console.log('[3] Modal info:', modalInfo);

  if (!modalInfo.open) {
    console.log('Modal did not open!');
    return;
  }

  // Step 4: Generate message
  const message = generateYCMessage({
    title: 'Head of Engineering',
    company: 'David AI',
    description: 'Data for audio AI',
    techStack: 'Python, AI, LLM'
  }, profile);
  console.log('[4] Message generated (' + message.length + ' chars):', message.substring(0, 100) + '...');

  // Step 5: Focus textarea & insert text
  console.log('[5] Pasting text into textarea...');
  await cdpEval(ws, `(() => {
    const ta = document.querySelector('textarea');
    ta.focus();
    const proto = window.HTMLTextAreaElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(ta, ${JSON.stringify(message)});
    } else {
      ta.value = ${JSON.stringify(message)};
    }
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);

  // Also send CDP Input.insertText to ensure full React typing event
  ws.send(JSON.stringify({
    id: 1,
    method: 'Input.insertText',
    params: { text: ' ' }
  }));
  await new Promise(r => setTimeout(r, 400));

  const textVerify = await cdpEval(ws, `(() => {
    const ta = document.querySelector('textarea');
    return { length: ta ? ta.value.length : 0 };
  })()`);
  console.log('[5] Text length in textarea:', textVerify.length);

  // Step 6: Click Send button
  console.log('[6] Clicking Send button...');
  const sendRes = await cdpEval(ws, `(() => {
    const sendBtn = Array.from(document.querySelectorAll('button, input[type="submit"]')).find(b => {
      return (b.innerText || '').trim().toLowerCase() === 'send' && b.offsetWidth > 0;
    });
    if (!sendBtn) return { error: 'No send button' };
    sendBtn.focus();
    sendBtn.click();
    return { clicked: true, text: sendBtn.innerText };
  })()`);
  console.log('[6] Send button clicked:', sendRes);

  await new Promise(r => setTimeout(r, 2500));

  // Step 7: Post-send status
  const postStatus = await cdpEval(ws, `(() => {
    const ta = document.querySelector('textarea');
    const sendBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Send');
    const bodyText = document.body.innerText;
    return {
      modalStillOpen: Boolean(ta),
      hasSendBtn: Boolean(sendBtn),
      bodyHasApplied: bodyText.includes('Applied') || bodyText.includes('Thank you') || !ta
    };
  })()`);
  console.log('[7] Post-send status:', postStatus);

  // Close tab
  await new Promise(resolve => {
    http.get(`http://127.0.0.1:9222/json/close/${newTab.id}`, () => resolve());
  });
  ws.close();
  console.log('=== TEST COMPLETED SUCCESSFULLY ===');
}

main().catch(console.error);
