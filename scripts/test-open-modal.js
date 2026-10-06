const { getTargetTab, connectWebSocket, cdpEval } = require('../core/cdp-client');

async function test() {
  const tab = await getTargetTab(9222);
  const ws = await connectWebSocket(tab.webSocketDebuggerUrl);

  const clickResult = await cdpEval(ws, `(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => {
      const t = (b.innerText || b.getAttribute('aria-label') || '').toLowerCase();
      return t.includes('easy apply') && b.offsetWidth > 0;
    });

    if (!btn) return { error: 'No button found' };
    btn.scrollIntoView({ behavior: 'instant', block: 'center' });
    const r = btn.getBoundingClientRect();
    return {
      text: btn.innerText,
      aria: btn.getAttribute('aria-label'),
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top + r.height / 2)
    };
  })()`);

  console.log('Button:', clickResult);

  if (clickResult && clickResult.x) {
    // Send CDP mouse click
    await new Promise(resolve => {
      ws.send(JSON.stringify({
        id: 201,
        method: 'Input.dispatchMouseEvent',
        params: { type: 'mousePressed', x: clickResult.x, y: clickResult.y, button: 'left', clickCount: 1 }
      }));
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 202,
          method: 'Input.dispatchMouseEvent',
          params: { type: 'mouseReleased', x: clickResult.x, y: clickResult.y, button: 'left', clickCount: 1 }
        }));
        setTimeout(resolve, 1000);
      }, 50);
    });

    const modalCheck = await cdpEval(ws, `(() => {
      const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
      if (!modal) return { modalOpen: false };
      return {
        modalOpen: true,
        title: modal.querySelector('h1, h2, h3, .jobs-easy-apply-modal__title')?.innerText?.trim(),
        buttons: Array.from(modal.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean),
        inputs: Array.from(modal.querySelectorAll('input:not([type="hidden"]), select, textarea')).map(i => ({
          tag: i.tagName,
          type: i.type,
          name: i.name,
          val: i.value,
          label: i.closest('label')?.innerText || i.getAttribute('aria-label')
        }))
      };
    })()`);

    console.log('Modal Check after click:', JSON.stringify(modalCheck, null, 2));
  }

  ws.close();
}

test().catch(console.error);
