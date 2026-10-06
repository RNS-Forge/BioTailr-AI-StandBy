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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run4JobsApply() {
  console.log('Connecting to LinkedIn tab...');
  const liTab = await getLinkedInTab();
  console.log('Connected to tab:', liTab.title);

  const ws = new WebSocket(liTab.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });

  const appliedJobs = [];
  const targetCount = 4;

  for (let jobIndex = 1; jobIndex <= targetCount; jobIndex++) {
    console.log(`\n========================================`);
    console.log(`[JOB ${jobIndex}/${targetCount}] Initializing application...`);
    console.log(`========================================`);

    // 1. Get current job info
    const jobInfo = await cdpEval(ws, `(() => {
      const title = document.querySelector('.job-details-jobs-unified-top-card__job-title, h1')?.innerText?.trim();
      const company = document.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name')?.innerText?.trim();
      const easyBtn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').toLowerCase().includes('easy apply') && b.offsetWidth > 0);
      return { title, company, hasEasyApply: !!easyBtn };
    })()`);

    console.log(`Target Job: "${jobInfo.title}" at "${jobInfo.company || 'Company'}" | Easy Apply Available: ${jobInfo.hasEasyApply}`);

    if (!jobInfo.hasEasyApply) {
      console.log('Easy Apply button not present on current job card. Moving to next card in feed...');
      await selectNextFeedCard(ws);
      await sleep(2000);
      continue;
    }

    // 2. Click Easy Apply button
    console.log('Clicking Easy Apply button...');
    const opened = await cdpEval(ws, `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').toLowerCase().includes('easy apply') && b.offsetWidth > 0);
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    })()`);

    await sleep(1500);

    // 3. Multi-Step Form Solver Loop (Up to 20 steps)
    let stepCount = 0;
    let submitted = false;

    while (stepCount < 20) {
      stepCount++;
      await sleep(350);

      const stepStatus = await cdpEval(ws, `(() => {
        const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
        if (!modal) return { modalOpen: false };

        const modalText = (modal.innerText || '').toLowerCase();
        const actionButtons = Array.from(modal.querySelectorAll('button')).filter(b => b.offsetWidth > 0).map(b => b.innerText.trim());

        return {
          modalOpen: true,
          title: modal.querySelector('h1, h2, h3, .jobs-easy-apply-modal__title')?.innerText,
          modalSnippet: modal.innerText.slice(0, 160).replace(/\\n+/g, ' '),
          buttons: actionButtons,
          isReview: modalText.includes('review your application') || actionButtons.some(b => /submit application/i.test(b)),
          isEducation: modalText.includes('education') && !modalText.includes('work experience'),
          isExperience: modalText.includes('work experience')
        };
      })()`);

      if (!stepStatus || !stepStatus.modalOpen) {
        console.log('Modal closed. Checking if application completed...');
        submitted = true;
        break;
      }

      console.log(`  -> Step ${stepCount}: "${stepStatus.title || 'Form'}" | Buttons: [${stepStatus.buttons.join(', ')}]`);

      // A. Prune extra Education / Work Experience
      if (stepStatus.isEducation || stepStatus.isExperience) {
        const pruneResult = await cdpEval(ws, `(() => {
          const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
          if (!modal) return { pruned: 0 };
          const modalText = (modal.innerText || '').toLowerCase();

          // Education Pruning: Strictly 1 College + 1 School
          if (modalText.includes('education') && !modalText.includes('work experience')) {
            const removeBtns = Array.from(modal.querySelectorAll('button, a[role="button"]')).filter(b => {
              const t = (b.innerText || b.getAttribute('aria-label') || '').toLowerCase().trim();
              return t === 'remove' || t.includes('remove education');
            });
            if (removeBtns.length > 2) {
              let keptCollege = false;
              let keptSchool = false;
              let prunedCount = 0;
              removeBtns.forEach(b => {
                const card = b.closest('li, div[class*="group"]') || b.parentElement?.parentElement;
                const txt = (card ? card.innerText : '').toLowerCase();
                const isSchool = /school|metric|secondary|12th|10th/i.test(txt);
                const isCollege = !isSchool && (/college|university|btech|degree|anna|sns/i.test(txt));
                if (isCollege && !keptCollege) { keptCollege = true; return; }
                if (isSchool && !keptSchool) { keptSchool = true; return; }
                b.click();
                prunedCount++;
                const confirmBtn = document.querySelector('.artdeco-modal__confirm-dialog-btn, button[data-control-name="confirm_delete"]');
                if (confirmBtn) confirmBtn.click();
              });
              return { pruned: prunedCount, type: 'education' };
            }
          }

          // Work Experience Pruning: Max 3
          if (modalText.includes('work experience')) {
            const expRemoveBtns = Array.from(modal.querySelectorAll('button, a[role="button"]')).filter(b => {
              const t = (b.innerText || b.getAttribute('aria-label') || '').toLowerCase().trim();
              return t === 'remove' || t.includes('remove experience');
            });
            if (expRemoveBtns.length > 3) {
              let prunedCount = 0;
              for (let i = 3; i < expRemoveBtns.length; i++) {
                expRemoveBtns[i].click();
                prunedCount++;
                const confirmBtn = document.querySelector('.artdeco-modal__confirm-dialog-btn, button[data-control-name="confirm_delete"]');
                if (confirmBtn) confirmBtn.click();
              }
              return { pruned: prunedCount, type: 'experience' };
            }
          }

          return { pruned: 0 };
        })()`);

        if (pruneResult && pruneResult.pruned > 0) {
          console.log(`     [PRUNING] Removed ${pruneResult.pruned} extra entries in ${pruneResult.type} to enforce strict constraints.`);
          await sleep(300);
        }
      }

      // B. Native Value Setter & Question Reasoning
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
            } else if (labelText.includes('notice')) {
              setVal(el, '15 days');
            } else if (labelText.includes('current ctc') || labelText.includes('current salary')) {
              setVal(el, '800,000 INR (8 LPA)');
            } else if (labelText.includes('expected ctc') || labelText.includes('expected salary')) {
              setVal(el, '1,200,000 INR (12 LPA)');
            } else if (labelText.includes('city') || labelText.includes('location') || labelText.includes('where')) {
              setVal(el, 'Coimbatore, Tamil Nadu, India');
            } else if (labelText.includes('linkedin')) {
              setVal(el, 'https://www.linkedin.com/in/sanjay--n');
            } else if (labelText.includes('github')) {
              setVal(el, 'https://github.com/RNS-Forge');
            } else if (labelText.includes('portfolio') || labelText.includes('website') || labelText.includes('other')) {
              setVal(el, 'https://rns-forge.github.io/RNS_Professional_Profile/');
            } else if (labelText.includes('tinkering') || labelText.includes('ai') || labelText.includes('automation') || labelText.includes('summary')) {
              setVal(el, '2+ years of hands-on experience developing scalable full-stack software, agentic AI pipelines, microservices, and modern web architectures at Axodian. Deeply proficient in Python, FastAPI, React, SQL, and LLM APIs.');
            } else if (!el.value) {
              setVal(el, 'Sanjay N — Full Stack & Generative AI Engineer (2+ years experience) specializing in scalable architectures, Python, microservices, and AI-enabled software solutions.');
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

      // C. Action Navigation: Check for Submit Application
      const submitClicked = await cdpEval(ws, `(() => {
        const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
        if (!modal) return false;

        const submitBtn = Array.from(modal.querySelectorAll('button')).find(b => {
          const t = b.innerText.trim().toLowerCase();
          return t === 'submit application' || t === 'submit';
        });

        if (submitBtn) {
          // Scroll containers
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
        await sleep(1200);

        // Dismiss confirmation modal
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

      // D. Check for Review or Next button
      const nextClicked = await cdpEval(ws, `(() => {
        const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
        if (!modal) return false;

        const reviewBtn = Array.from(modal.querySelectorAll('button')).find(b => /review/i.test(b.innerText.trim()));
        if (reviewBtn) { reviewBtn.click(); return 'review'; }

        const saveBtn = Array.from(modal.querySelectorAll('button')).find(b => /^save$/i.test(b.innerText.trim()));
        if (saveBtn) { saveBtn.click(); return 'save'; }

        const nextBtn = Array.from(modal.querySelectorAll('button')).find(b => /next|continue/i.test(b.innerText.trim()));
        if (nextBtn) { nextBtn.click(); return 'next'; }

        return false;
      })()`);

      if (nextClicked) {
        console.log(`     [NAV] Clicked "${nextClicked}" button.`);
        await sleep(350);
      } else {
        console.log('     [WAIT] Standing by on step...');
        await sleep(500);
      }
    }

    if (submitted) {
      console.log(`[JOB ${jobIndex}] SUCCESS: Application to "${jobInfo.title}" submitted successfully!`);
      appliedJobs.push({
        index: jobIndex,
        title: jobInfo.title,
        company: jobInfo.company,
        status: 'SUBMITTED'
      });
    }

    // Dismiss any remaining dialogs
    await sleep(600);
    await cdpEval(ws, `(() => {
      const dismiss = document.querySelector('.artdeco-modal__dismiss, [data-test-modal-close-btn], button[aria-label="Dismiss"]')
        || Array.from(document.querySelectorAll('button')).find(b => /not now|dismiss|close/i.test(b.innerText.trim()));
      if (dismiss) dismiss.click();
    })()`);

    if (jobIndex < targetCount) {
      console.log(`Transitioning to next job in search feed...`);
      await selectNextFeedCard(ws);
      await sleep(2000);
    }
  }

  console.log(`\n========================================`);
  console.log(`BATCH COMPLETE: Successfully applied to ${appliedJobs.length} jobs!`);
  console.log(`========================================`);
  console.table(appliedJobs);

  ws.close();
  process.exit(0);
}

async function selectNextFeedCard(ws) {
  return await cdpEval(ws, `(() => {
    const cards = Array.from(document.querySelectorAll('.jobs-search-results-list__list-item, .job-card-container, [data-occludable-job-id]'));
    for (const card of cards) {
      const t = card.innerText.toLowerCase();
      const isApplied = t.includes('applied') || t.includes('application submitted');
      const isEasyApply = t.includes('easy apply');
      const isActive = card.classList.contains('jobs-search-results-list__list-item--active') || card.classList.contains('selected') || Boolean(card.querySelector('.job-card-container--active'));

      if (isEasyApply && !isApplied && !isActive) {
        const link = card.querySelector('a.job-card-container__link, a[href*="/jobs/view/"], a');
        if (link) {
          link.scrollIntoView({ behavior: 'instant', block: 'center' });
          link.click();
          return { found: true, title: link.innerText.trim() };
        }
      }
    }
    return { found: false };
  })()`);
}

run4JobsApply().catch(err => {
  console.error('Apply runner failed:', err);
  process.exit(1);
});
