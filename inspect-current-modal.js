const http = require('http');

async function check() {
  const tabs = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const li = tabs.find(t => t.url && t.url.includes('linkedin.com/jobs'));
  const ws = new WebSocket(li.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  const evalCDP = (expr) => new Promise(res => {
    const id = 123;
    ws.onmessage = (e) => {
      const p = JSON.parse(e.data);
      if (p.id === id) res(p.result?.result?.value);
    };
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
  });

  const fillRes = await evalCDP(`(() => {
    const modal = document.querySelector('.jobs-easy-apply-modal, [role="dialog"]');
    const setVal = (el, val) => {
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement?.prototype : window.HTMLInputElement?.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto || {}, 'value')?.set
        || Object.getOwnPropertyDescriptor(el.__proto__ || {}, 'value')?.set;
      if (setter) setter.call(el, val);
      else el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    };

    const inputs = Array.from(modal.querySelectorAll('input:not([type="hidden"]), textarea, select'));
    const filled = [];

    inputs.forEach(el => {
      const p = el.closest('.fb-dash-form-element, fieldset') || el.parentElement;
      const label = ((p ? p.innerText : '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + el.id).toLowerCase();

      if (label.includes('income expectation')) {
        setVal(el, '1,200,000 INR (12 LPA)');
        filled.push({ label: 'Income', val: el.value });
      } else if (label.includes('total experience')) {
        setVal(el, '2');
        filled.push({ label: 'Total Exp', val: el.value });
      } else if (label.includes('organisation') || label.includes('company')) {
        setVal(el, 'Axodian');
        filled.push({ label: 'Org', val: el.value });
      } else if (label.includes('designation') || label.includes('title')) {
        setVal(el, 'Full Stack & AI Engineer');
        filled.push({ label: 'Designation', val: el.value });
      } else if (label.includes('current ctc') || label.includes('current salary')) {
        setVal(el, '800,000 INR (8 LPA)');
        filled.push({ label: 'Current CTC', val: el.value });
      } else if (label.includes('expected ctc') || label.includes('expected salary')) {
        setVal(el, '1,200,000 INR (12 LPA)');
        filled.push({ label: 'Expected CTC', val: el.value });
      } else if (label.includes('notice')) {
        setVal(el, '15');
        filled.push({ label: 'Notice', val: el.value });
      } else if (label.includes('location') || label.includes('city') || label.includes('where')) {
        setVal(el, 'Coimbatore, Tamil Nadu, India');
        filled.push({ label: 'Location', val: el.value });
      } else if (/years.*experience|experience.*years|how many years/i.test(label)) {
        setVal(el, '2');
        filled.push({ label: 'Years exp', val: el.value });
      }
    });

    return filled;
  })()`);

  console.log('Filled items:', JSON.stringify(fillRes, null, 2));

  // Click Review
  const clickReview = await evalCDP(`(() => {
    const modal = document.querySelector('.jobs-easy-apply-modal, [role="dialog"]');
    const reviewBtn = Array.from(modal.querySelectorAll('button')).find(b => /review/i.test(b.innerText.trim()));
    if (reviewBtn) {
      reviewBtn.click();
      return 'Clicked Review';
    }
    return 'No review btn';
  })()`);

  console.log('Review button action:', clickReview);
  await new Promise(r => setTimeout(r, 1200));

  const submitCheck = await evalCDP(`(() => {
    const modal = document.querySelector('.jobs-easy-apply-modal, [role="dialog"]');
    return {
      title: modal?.querySelector('h1, h2, h3')?.innerText,
      buttons: Array.from(modal?.querySelectorAll('button') || []).filter(b => b.offsetWidth > 0).map(b => b.innerText.trim())
    };
  })()`);

  console.log('After Review Step:', submitCheck);
  ws.close();
}

check();
