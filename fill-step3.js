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
        const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
        if (!modal) return { error: 'No modal' };

        const rawInputs = Array.from(modal.querySelectorAll('input:not([type="hidden"]), select, textarea')).filter(el => {
          return !el.disabled && !el.readOnly && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.type === 'radio' || el.type === 'checkbox');
        });

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

        const logs = [];

        rawInputs.forEach((el, idx) => {
          const pContainer = el.closest('.fb-dash-form-element, .jobs-easy-apply-form-section__grouping, fieldset') || el.parentElement;
          const labelText = ((pContainer ? pContainer.innerText : '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + el.id).replace(/\\n+/g, ' ').toLowerCase();

          if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text')) {
            if (labelText.includes('notice')) {
              setVal(el, '15 days');
              logs.push({ idx, field: 'notice', val: '15 days' });
            } else if (labelText.includes('current ctc') || labelText.includes('current salary')) {
              setVal(el, '800,000 INR (8 LPA)');
              logs.push({ idx, field: 'current ctc', val: '800,000 INR' });
            } else if (labelText.includes('expected ctc') || labelText.includes('expected salary')) {
              setVal(el, '1,200,000 INR (12 LPA)');
              logs.push({ idx, field: 'expected ctc', val: '1,200,000 INR' });
            } else if (labelText.includes('tinkering') || labelText.includes('software') || labelText.includes('experience')) {
              const text = '2+ years of hands-on experience building full-stack software, agentic AI systems, LLM automation pipelines, and scalable backend microservices at Axodian. Deeply proficient in Python, FastAPI, React, modern Claude/OpenAI APIs, and autonomous agent workflows.';
              setVal(el, text);
              logs.push({ idx, field: 'experience text', val: text.slice(0, 40) });
            } else if (!el.value) {
              const gen = 'Sanjay N — Full Stack & Generative AI Engineer with 2+ years of experience architecting autonomous agent pipelines, microservices, and AI integrations at Axodian.';
              setVal(el, gen);
              logs.push({ idx, field: 'fallback text', val: gen.slice(0, 40) });
            }
          } else if (el.type === 'radio') {
            const radioParent = el.parentElement;
            const radioText = (radioParent ? radioParent.innerText : '').trim().toLowerCase();
            const fullRadioText = (labelText + ' ' + radioText).toLowerCase();
            const isNo = fullRadioText.includes('sponsorship') || fullRadioText.includes('require sponsorship');
            const targetYes = !isNo;

            if (targetYes && (radioText.includes('yes') || radioText.includes('agree') || el.value.toLowerCase() === 'yes')) {
              el.click();
              el.dispatchEvent(new Event('change', { bubbles: true }));
              logs.push({ idx, field: 'radio', choice: 'yes', label: labelText.slice(0, 40) });
            }
          }
        });

        return { logs };
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      console.log('Fill result on step 3:', JSON.stringify(parsed.result.result.value, null, 2));
      ws.close();
    };
  });
});
