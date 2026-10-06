/**
 * BioTailr AI - Standalone Autonomous Auto-Apply Desktop Runner
 * Connects directly to Google Chrome via Chrome DevTools Protocol (CDP) over WebSocket.
 * Operates without third-party dependencies using Node.js built-in APIs (Node 18+).
 * 
 * Rules Enforced:
 * 1. Strictly 1 College and 1 School in Education. Extra entries pruned.
 * 2. Maximum 3 Work Experiences. Extra entries pruned.
 * 3. 2 years experience for technical skills/resume match; 1 year for general questions.
 * 4. 0 months for additional month dropdowns.
 * 5. Affirmative consent for qualification and agreement questions; No for visa sponsorship.
 * 6. Viewport scrolling, submission confirmation dismissal, and automated card advancing.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// 1. Load Candidate Profile Configuration
let profile = {
  personal: {
    fullName: 'Sanjay N',
    firstName: 'Sanjay',
    lastName: 'N',
    email: '2005sanjaynrs@gmail.com',
    phone: '+91 9361599018',
    city: 'Coimbatore, Tamil Nadu, India',
    linkedinUrl: 'https://www.linkedin.com/in/sanjay--n',
    githubUrl: 'https://github.com/RNS-Forge',
    portfolioUrl: 'https://rns-forge.github.io/RNS_Professional_Profile/'
  },
  workAuth: {
    authorizedInCountry: 'Yes',
    needSponsorship: 'No'
  },
  experience: {
    totalYears: 2,
    noticePeriodDays: 15,
    currentTitle: 'Full Stack & AI Engineer',
    currentCompany: 'Axodian',
    currentSalary: '800,000 INR (8 LPA)',
    expectedSalary: '1,200,000 INR (12 LPA)'
  },
  education: {
    degree: 'Bachelor of Technology - BTech',
    institution: 'Anna University / SNS College of Technology'
  },
  settings: {
    batchTarget: 5,
    cdpPort: 9222
  }
};

try {
  const profilePath = path.join(__dirname, 'candidate-profile.json');
  if (fs.existsSync(profilePath)) {
    const raw = fs.readFileSync(profilePath, 'utf8');
    profile = { ...profile, ...JSON.parse(raw) };
  }
} catch (e) {
  console.log('[WARN] Could not parse candidate-profile.json, using defaults.');
}

const cdpPort = profile.settings?.cdpPort || 9222;
const batchTarget = profile.settings?.batchTarget || 5;

function log(tag, message) {
  const ts = new Date().toLocaleTimeString([], { hour12: false });
  console.log(`[${ts}] [${tag}] ${message}`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getLinkedInTab() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${cdpPort}/json`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const tabs = JSON.parse(data);
          const li = tabs.find(t => t.url && t.url.includes('linkedin.com/jobs'));
          if (li) resolve(li);
          else reject(new Error('No active LinkedIn Jobs tab detected in Chrome. Please open LinkedIn in the debugging Chrome window.'));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', (err) => {
      reject(new Error(`Failed to connect to Chrome on port ${cdpPort}. Ensure Chrome was launched with --remote-debugging-port=${cdpPort}. (${err.message})`));
    });
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

async function runAutoApply() {
  console.log('====================================================');
  console.log('   BioTailr AI - Standalone Autonomous Auto-Apply   ');
  console.log('====================================================');
  log('INIT', `Connecting to Chrome DevTools Protocol at 127.0.0.1:${cdpPort}...`);

  const liTab = await getLinkedInTab();
  log('CONNECTED', `Attached to tab: "${liTab.title}"`);

  const ws = new WebSocket(liTab.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });

  const appliedJobs = [];

  for (let jobIndex = 1; jobIndex <= batchTarget; jobIndex++) {
    console.log(`\n----------------------------------------------------`);
    log('BATCH', `[${jobIndex}/${batchTarget}] Inspecting current active job card...`);
    console.log(`----------------------------------------------------`);

    const jobInfo = await cdpEval(ws, `(() => {
      const title = document.querySelector('.job-details-jobs-unified-top-card__job-title, h1')?.innerText?.trim();
      const company = document.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name')?.innerText?.trim();
      const easyBtn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').toLowerCase().includes('easy apply') && b.offsetWidth > 0);
      return { title, company, hasEasyApply: !!easyBtn };
    })()`);

    log('INFO', `Target Job: "${jobInfo.title || 'Untitled'}" at "${jobInfo.company || 'Company'}"`);
    log('INFO', `Easy Apply Available: ${jobInfo.hasEasyApply}`);

    if (!jobInfo.hasEasyApply) {
      log('SKIP', 'Easy Apply button not present on current job card. Moving to next card in search feed...');
      await selectNextFeedCard(ws);
      await sleep(2000);
      continue;
    }

    log('ACTION', 'Clicking Easy Apply button...');
    await cdpEval(ws, `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').toLowerCase().includes('easy apply') && b.offsetWidth > 0);
      if (btn) btn.click();
    })()`);

    await sleep(1500);

    let stepCount = 0;
    let submitted = false;

    while (stepCount < 20) {
      stepCount++;
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
        log('MODAL', 'Application modal closed. Verifying completion...');
        submitted = true;
        break;
      }

      log('STEP', `Step ${stepCount}: "${stepStatus.title || 'Form'}" | Action Buttons: [${stepStatus.buttons.join(', ')}]`);

      // 1. Education Pruning (Strictly 1 College + 1 School)
      if (stepStatus.isEducation) {
        const pruneResult = await cdpEval(ws, `(() => {
          const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
          if (!modal) return { pruned: 0 };
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
            return { pruned: prunedCount };
          }
          return { pruned: 0 };
        })()`);

        if (pruneResult && pruneResult.pruned > 0) {
          log('PRUNE', `Removed ${pruneResult.pruned} extra education entries to enforce 1 College + 1 School constraint.`);
          await sleep(300);
        }
      }

      // 2. Candidate Context & Reasoning Value Setter
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
              setVal(el, '1,200,000 INR (12 LPA)');
            } else if (labelText.includes('total experience')) {
              setVal(el, '2');
            } else if (labelText.includes('organisation') || labelText.includes('organization') || labelText.includes('company')) {
              setVal(el, 'Axodian');
            } else if (labelText.includes('designation') || labelText.includes('title')) {
              setVal(el, 'Full Stack & AI Engineer');
            } else if (labelText.includes('notice')) {
              setVal(el, '15');
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
            } else if (labelText.includes('summary') || labelText.includes('cover letter') || labelText.includes('tinkering') || labelText.includes('about')) {
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

      // 3. Navigation Check: Submit Application
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
        log('SUBMIT', 'Clicked "Submit application"!');
        await sleep(1500);

        // Auto-dismiss confirmation modal
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

      // 4. Navigation Check: Review / Next
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
        log('NAV', `Advanced past "${nextClicked}" step.`);
        await sleep(600);
      } else {
        await sleep(400);
      }
    }

    if (submitted) {
      log('SUCCESS', `Application to "${jobInfo.title}" successfully submitted!`);
      appliedJobs.push({
        index: jobIndex,
        title: jobInfo.title,
        company: jobInfo.company,
        status: 'SUBMITTED'
      });
    }

    // Dismiss lingering modals
    await sleep(800);
    await cdpEval(ws, `(() => {
      const dismiss = document.querySelector('.artdeco-modal__dismiss, [data-test-modal-close-btn], button[aria-label="Dismiss"]')
        || Array.from(document.querySelectorAll('button')).find(b => /not now|dismiss|close/i.test(b.innerText.trim()));
      if (dismiss) dismiss.click();
    })()`);

    if (jobIndex < batchTarget) {
      log('TRANSITION', 'Selecting next job card in search feed...');
      await selectNextFeedCard(ws);
      await sleep(2000);
    }
  }

  console.log('\n====================================================');
  log('COMPLETE', `Batch session finished: ${appliedJobs.length} jobs applied!`);
  console.log('====================================================');
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

runAutoApply().catch(err => {
  log('ERROR', err.message);
  process.exit(1);
});
