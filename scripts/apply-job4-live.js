const http = require('http');

async function getLinkedInTab() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const tabs = JSON.parse(data);
        const li = tabs.find(t => t.url && t.url.includes('linkedin.com/jobs'));
        if (li) resolve(li);
        else reject(new Error('No LinkedIn tab found'));
      });
    }).on('error', reject);
  });
}

function cdpEval(ws, expression) {
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
      params: { expression, returnByValue: true }
    }));
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function applyJob4() {
  console.log('Connecting to LinkedIn tab...');
  const liTab = await getLinkedInTab();
  const ws = new WebSocket(liTab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  console.log('Selecting Job 4: "Senior AI Engineer, Agents" at "Nacre Capital"...');
  const selectRes = await cdpEval(ws, `(() => {
    const cards = Array.from(document.querySelectorAll('.jobs-search-results-list__list-item, .job-card-container'));
    for (const card of cards) {
      const txt = card.innerText.toLowerCase();
      if (txt.includes('agents') && txt.includes('easy apply') && !txt.includes('applied')) {
        const link = card.querySelector('a.job-card-container__link, a[href*="/jobs/view/"], a');
        if (link) {
          link.scrollIntoView({ behavior: 'instant', block: 'center' });
          link.click();
          return { selected: true, text: link.innerText.trim() };
        }
      }
    }
    // Fallback: any unapplied Easy Apply card
    for (const card of cards) {
      const txt = card.innerText.toLowerCase();
      if (txt.includes('easy apply') && !txt.includes('applied')) {
        const link = card.querySelector('a.job-card-container__link, a[href*="/jobs/view/"], a');
        if (link) {
          link.scrollIntoView({ behavior: 'instant', block: 'center' });
          link.click();
          return { selected: true, text: link.innerText.trim() };
        }
      }
    }
    return { selected: false };
  })()`);

  console.log('Card selection result:', selectRes);
  await sleep(2000);

  // Check job details
  const jobInfo = await cdpEval(ws, `(() => {
    const title = document.querySelector('.job-details-jobs-unified-top-card__job-title, h1')?.innerText?.trim();
    const company = document.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name')?.innerText?.trim();
    const easyBtn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').toLowerCase().includes('easy apply') && b.offsetWidth > 0);
    return { title, company, hasEasyApply: !!easyBtn };
  })()`);

  console.log(`[JOB 4/4] Target: "${jobInfo.title}" at "${jobInfo.company}" | Easy Apply: ${jobInfo.hasEasyApply}`);

  if (!jobInfo.hasEasyApply) {
    console.error('Easy apply button not found for selected job.');
    ws.close();
    process.exit(1);
  }

  // Click Easy Apply
  console.log('Clicking Easy Apply button...');
  await cdpEval(ws, `(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').toLowerCase().includes('easy apply') && b.offsetWidth > 0);
    if (btn) btn.click();
  })()`);

  await sleep(1500);

  // Form filling loop
  let step = 0;
  let submitted = false;

  while (step < 20) {
    step++;
    await sleep(400);

    const stepStatus = await cdpEval(ws, `(() => {
      const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
      if (!modal) return { modalOpen: false };

      const modalText = (modal.innerText || '').toLowerCase();
      const actionButtons = Array.from(modal.querySelectorAll('button')).filter(b => b.offsetWidth > 0).map(b => b.innerText.trim());

      return {
        modalOpen: true,
        title: modal.querySelector('h1, h2, h3, .jobs-easy-apply-modal__title')?.innerText,
        buttons: actionButtons,
        isEducation: modalText.includes('education') && !modalText.includes('work experience'),
        isExperience: modalText.includes('work experience')
      };
    })()`);

    if (!stepStatus || !stepStatus.modalOpen) {
      console.log('Modal closed. Application finalized.');
      submitted = true;
      break;
    }

    console.log(`  -> Step ${step}: "${stepStatus.title || 'Form Step'}" | Buttons: [${stepStatus.buttons.join(', ')}]`);

    // Education pruning (1 School + 1 College)
    if (stepStatus.isEducation) {
      await cdpEval(ws, `(() => {
        const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
        if (!modal) return;
        const removeBtns = Array.from(modal.querySelectorAll('button')).filter(b => b.innerText.trim().toLowerCase() === 'remove');
        if (removeBtns.length > 2) {
          let keptCollege = false;
          let keptSchool = false;
          removeBtns.forEach(b => {
            const card = b.closest('li, div[class*="group"]') || b.parentElement?.parentElement;
            const txt = (card ? card.innerText : '').toLowerCase();
            const isSchool = /school|metric|secondary|12th|10th/i.test(txt);
            const isCollege = !isSchool && /college|university|btech|degree|anna|sns/i.test(txt);
            if (isCollege && !keptCollege) { keptCollege = true; return; }
            if (isSchool && !keptSchool) { keptSchool = true; return; }
            b.click();
            const confirmBtn = document.querySelector('.artdeco-modal__confirm-dialog-btn, button[data-control-name="confirm_delete"]');
            if (confirmBtn) confirmBtn.click();
          });
        }
      })()`);
    }

    // Input filling
    await cdpEval(ws, `(() => {
      const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
      if (!modal) return;

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

      const rawInputs = Array.from(modal.querySelectorAll('input:not([type="hidden"]), select, textarea')).filter(el => {
        return !el.disabled && !el.readOnly && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.type === 'radio' || el.type === 'checkbox');
      });

      rawInputs.forEach(el => {
        const pContainer = el.closest('.fb-dash-form-element, .jobs-easy-apply-form-section__grouping, fieldset') || el.parentElement;
        const labelText = ((pContainer ? pContainer.innerText : '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + el.id).replace(/\\n+/g, ' ').toLowerCase();

        if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && ['text', 'tel', 'email', 'url', 'number', ''].includes(el.type))) {
          const isExp = /years.*experience|experience.*years|how\\s*many\\s*years/i.test(labelText) && !/salary|ctc|notice|grad/i.test(labelText);
          const isTech = /resume|python|sql|full\\s*stack|ai|engineer|developer|software|backend|react/i.test(labelText);

          if (isExp) {
            setVal(el, isTech ? '2' : '1');
          } else if (labelText.includes('headline')) {
            setVal(el, 'Generative AI & Full Stack Engineer');
          } else if (labelText.includes('income expectation')) {
            setVal(el, '1200000');
          } else if (labelText.includes('organisation') || labelText.includes('organization') || labelText.includes('company')) {
            setVal(el, 'Axodian');
          } else if (labelText.includes('designation') || labelText.includes('title')) {
            setVal(el, 'Full Stack & AI Engineer');
          } else if (labelText.includes('notice')) {
            setVal(el, '15');
          } else if (labelText.includes('current ctc') || labelText.includes('current salary')) {
            setVal(el, '800000');
          } else if (labelText.includes('expected ctc') || labelText.includes('expected salary')) {
            setVal(el, '1200000');
          } else if (labelText.includes('city') || labelText.includes('location') || labelText.includes('where')) {
            setVal(el, 'Coimbatore, Tamil Nadu, India');
          } else if (labelText.includes('linkedin')) {
            setVal(el, 'https://www.linkedin.com/in/sanjay--n');
          } else if (labelText.includes('github')) {
            setVal(el, 'https://github.com/RNS-Forge');
          } else if (labelText.includes('portfolio') || labelText.includes('website') || labelText.includes('other')) {
            setVal(el, 'https://rns-forge.github.io/RNS_Professional_Profile/');
          } else if (labelText.includes('summary') || labelText.includes('cover letter') || labelText.includes('about')) {
            setVal(el, '2+ years of hands-on experience developing scalable full-stack software, agentic AI pipelines, microservices, and modern web architectures at Axodian. Deeply proficient in Python, FastAPI, React, SQL, and LLM APIs.');
          } else if (!el.value) {
            setVal(el, el.tagName === 'TEXTAREA' ? 'Experienced in AI engineering, Python, React, and scalable backend services.' : 'Sanjay N');
          }
        } else if (el.tagName === 'SELECT') {
          const opts = Array.from(el.options);
          let matchIdx = -1;
          if (/month/i.test(labelText)) {
            matchIdx = opts.findIndex(o => o.text.includes('0'));
          } else if (/year/i.test(labelText)) {
            matchIdx = opts.findIndex(o => o.text.includes('2022') || o.text.includes('2026'));
          } else {
            matchIdx = opts.findIndex(o => o.text.trim().toLowerCase() === 'yes' || o.text.includes('Yes'));
          }
          if (matchIdx !== -1 && el.selectedIndex !== matchIdx) {
            el.selectedIndex = matchIdx;
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        } else if (el.type === 'radio') {
          let p = el.parentElement;
          let radioText = '';
          while (p && p.tagName !== 'FIELDSET' && p.tagName !== 'FORM') {
            if (p.innerText && p.innerText.trim()) { radioText = p.innerText.trim(); break; }
            p = p.parentElement;
          }
          const isNo = /sponsorship|require.*visa/i.test(labelText + ' ' + radioText);
          const target = isNo ? /no|decline/i : /yes|agree|accept|confirm/i;
          if (target.test(radioText.toLowerCase()) || target.test(el.value.toLowerCase())) {
            if (!el.checked) {
              el.click();
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        } else if (el.type === 'checkbox') {
          if (!el.checked) {
            el.click();
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      });
    })()`);

    // Submit Application Check
    const submitClicked = await cdpEval(ws, `(() => {
      const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
      if (!modal) return false;

      const submitBtn = Array.from(modal.querySelectorAll('button')).find(b => {
        const t = b.innerText.trim().toLowerCase();
        return t === 'submit application' || t === 'submit';
      });

      if (submitBtn) {
        const scrollContainers = [
          modal.querySelector('.jobs-easy-apply-modal__content'),
          modal.querySelector('.artdeco-modal__content'),
          modal
        ];
        scrollContainers.forEach(sc => { if (sc) sc.scrollTop = sc.scrollHeight; });
        submitBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
        submitBtn.click();
        return true;
      }
      return false;
    })()`);

    if (submitClicked) {
      console.log('     [SUBMIT] Clicked "Submit application"!');
      await sleep(1500);

      // Dismiss confirmation
      await cdpEval(ws, `(() => {
        for (let d = 0; d < 3; d++) {
          const dismissBtn = document.querySelector('.artdeco-modal__dismiss, [data-test-modal-close-btn], button[aria-label="Dismiss"], button[aria-label="Done"]')
            || Array.from(document.querySelectorAll('button')).find(b => b.offsetWidth > 0 && /^(not now|dismiss|close|done)$/i.test(b.innerText.trim()));
          if (dismissBtn) dismissBtn.click();
        }
      })()`);

      submitted = true;
      break;
    }

    // Next / Review Check
    const nextClicked = await cdpEval(ws, `(() => {
      const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
      if (!modal) return false;

      const reviewBtn = Array.from(modal.querySelectorAll('button')).find(b => /review/i.test(b.innerText.trim()));
      if (reviewBtn) { reviewBtn.click(); return 'review'; }

      const nextBtn = Array.from(modal.querySelectorAll('button')).find(b => /next|continue/i.test(b.innerText.trim()));
      if (nextBtn) { nextBtn.click(); return 'next'; }

      return false;
    })()`);

    if (nextClicked) {
      console.log(`     [NAV] Clicked "${nextClicked}" button.`);
      await sleep(600);
    } else {
      await sleep(500);
    }
  }

  if (submitted) {
    console.log(`\n========================================`);
    console.log(`[JOB 4/4] SUCCESS: Application submitted successfully!`);
    console.log(`========================================`);
  }

  // Dismiss any lingering dialogs
  await sleep(1000);
  await cdpEval(ws, `(() => {
    const dismiss = document.querySelector('.artdeco-modal__dismiss, [data-test-modal-close-btn], button[aria-label="Dismiss"]')
      || Array.from(document.querySelectorAll('button')).find(b => /not now|dismiss|close/i.test(b.innerText.trim()));
    if (dismiss) dismiss.click();
  })()`);

  ws.close();
}

applyJob4().catch(err => {
  console.error('Job 4 apply failed:', err);
  process.exit(1);
});
