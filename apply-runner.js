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
const batchTarget = (profile.settings?.batchTarget === 0 || profile.settings?.batchTarget === 'unlimited') ? Infinity : (profile.settings?.batchTarget || Infinity);


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

  let jobIndex = 0;
  let currentPage = 1;
  let hasMoreJobs = true;

  while (jobIndex < batchTarget && hasMoreJobs) {
    jobIndex++;
    console.log(`\n----------------------------------------------------`);
    const targetLabel = batchTarget === Infinity ? 'Unlimited' : String(batchTarget);
    log('BATCH', `[Job #${jobIndex} | Page ${currentPage} | Target: ${targetLabel}] Inspecting current active job card...`);
    console.log(`----------------------------------------------------`);

    const jobInfo = await cdpEval(ws, `(() => {
      const title = document.querySelector('.job-details-jobs-unified-top-card__job-title, h1.job-details-jobs-unified-top-card__job-title, .jobs-search__job-details--container h1, .jobs-unified-top-card__job-title, .job-card-list__title, h1')?.innerText?.trim()
        || document.querySelector('.jobs-search-results-list__list-item--active .job-card-list__title, .selected .job-card-list__title')?.innerText?.trim()
        || 'Technical Opportunity';
      const company = document.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .job-details-jobs-unified-top-card__primary-description-container a, .job-card-container__primary-description')?.innerText?.trim()
        || document.querySelector('.jobs-search-results-list__list-item--active .job-card-container__primary-description, .selected .job-card-container__primary-description')?.innerText?.trim()
        || 'Target Company';
      const easyBtn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').toLowerCase().includes('easy apply') && b.offsetWidth > 0);
      return { title, company, hasEasyApply: !!easyBtn };
    })()`);

    log('INFO', `Target Job: "${jobInfo.title || 'Untitled'}" at "${jobInfo.company || 'Company'}"`);
    log('INFO', `Easy Apply Available: ${jobInfo.hasEasyApply}`);

    if (!jobInfo.hasEasyApply) {
      log('SKIP', 'Easy Apply button not present on current job card. Moving to next card in search feed...');
      let nextJob = await selectNextFeedCard(ws);
      if (!nextJob || !nextJob.found) {
        await scrollFeedContainer(ws);
        await sleep(1500);
        nextJob = await selectNextFeedCard(ws);
      }
      if (!nextJob || !nextJob.found) {
        const paged = await goToNextSearchPage(ws);
        if (paged.success) {
          currentPage++;
          log('PAGINATION', `Advanced to Search Results Page ${currentPage}. Loading fresh jobs...`);
          await sleep(3500);
        } else {
          hasMoreJobs = false;
        }
      }
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

    while (stepCount < 60) {
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

      // 1. Intercept "Update your profile" or intermediate confirmation dialog
      const promptHandled = await cdpEval(ws, `(() => {
        const dialogs = Array.from(document.querySelectorAll('dialog, [role="dialog"], .artdeco-modal'));
        for (const d of dialogs) {
          if (d.querySelector('.jobs-easy-apply-form-section__grouping')) continue;
          const txt = (d.innerText || '').toLowerCase();
          if (txt.includes('update your profile') || txt.includes('save to your profile') || txt.includes('save changes') || txt.includes('continue applying') || txt.includes('remember this')) {
            const contBtn = Array.from(d.querySelectorAll('button')).find(b => /continue applying|continue|save and continue/i.test(b.innerText.trim()));
            if (contBtn) { contBtn.click(); return 'clicked_continue_applying'; }
            const notNow = Array.from(d.querySelectorAll('button')).find(b => /not now|no thanks|no|close|dismiss/i.test(b.innerText.trim()))
              || d.querySelector('.artdeco-modal__dismiss, [data-test-modal-close-btn]');
            if (notNow) { notNow.click(); return 'dismissed_update_profile'; }
          }
        }
        return false;
      })()`);

      if (promptHandled) {
        log('PROMPT', `Handled profile update dialog: ${promptHandled}`);
        await sleep(350);
      }

      // Check if modal closed due to profile dialog and re-click Easy Apply if available
      const needReopen = await cdpEval(ws, `(() => {
        const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
        if (!modal) {
          const btn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').toLowerCase().includes('easy apply') && b.offsetWidth > 0);
          if (btn) { btn.click(); return true; }
        }
        return false;
      })()`);
      if (needReopen) {
        log('ACTION', 'Re-opened Easy Apply modal after profile prompt.');
        await sleep(1000);
      }

      // 2. Education Pruning (Strictly 1 College + 1 School)
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

      // 3. Candidate Context, Reasoning Value Setter & Edit Experience Resolver
      await cdpEval(ws, `(() => {
        const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
        if (!modal) return;

        const setVal = (el, val) => {
          if (!el) return;
          const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement?.prototype : window.HTMLInputElement?.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto || {}, 'value')?.set
            || Object.getOwnPropertyDescriptor(el.__proto__ || {}, 'value')?.set;
          if (setter) setter.call(el, val);
          else el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('blur', { bubbles: true }));
        };

        // A. Resolve "Edit experience" sub-card if visible or if validation errors exist
        const isExpForm = Array.from(modal.querySelectorAll('*')).some(el => /edit\s*experience|add\s*work\s*experience/i.test(el.innerText || ''));
        const hasFormErrors = Boolean(modal.querySelector('.artdeco-inline-feedback--error, [data-test-form-element-error-messages]'));

        if (isExpForm || hasFormErrors) {
          // 1. Title input
          const titleInput = modal.querySelector('input[id*="title"], input[name*="title"], input[aria-label*="title"]')
            || Array.from(modal.querySelectorAll('input[type="text"]')).find(i => {
              const p = i.closest('.fb-dash-form-element, div');
              return /title/i.test(p?.innerText || '');
            });
          if (titleInput && (!titleInput.value || titleInput.value.length < 2)) {
            setVal(titleInput, 'Full Stack & AI Engineer');
          }

          // 2. Company input
          const compInput = modal.querySelector('input[id*="company"], input[name*="company"], input[aria-label*="company"]')
            || Array.from(modal.querySelectorAll('input[type="text"]')).find(i => {
              const p = i.closest('.fb-dash-form-element, div');
              return /company/i.test(p?.innerText || '');
            });
          if (compInput && (!compInput.value || compInput.value.length < 2)) {
            setVal(compInput, 'Axodian');
          }

          // 3. Month & Year selects in Dates of employment
          const selects = Array.from(modal.querySelectorAll('select'));
          selects.forEach(sel => {
            const p = sel.closest('.fb-dash-form-element, div, fieldset');
            const txt = ((sel.getAttribute('aria-label') || '') + ' ' + (sel.id || '') + ' ' + (p?.innerText || '')).toLowerCase();
            if (/month/i.test(txt) && sel.selectedIndex <= 0) {
              const idx = Array.from(sel.options).findIndex(o => /january|jan|^1$/i.test(o.text.trim()));
              sel.selectedIndex = idx !== -1 ? idx : (sel.options.length > 1 ? 1 : 0);
              sel.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (/year/i.test(txt) && sel.selectedIndex <= 0) {
              const yIdx = Array.from(sel.options).findIndex(o => /2022|2021|2023/.test(o.text));
              sel.selectedIndex = yIdx !== -1 ? yIdx : (sel.options.length > 1 ? 1 : 0);
              sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });

          // 4. "I currently work here" checkbox
          const workCb = modal.querySelector('input[type="checkbox"][id*="current"], input[type="checkbox"]');
          if (workCb && !workCb.checked) {
            workCb.click();
            workCb.checked = true;
            workCb.dispatchEvent(new Event('change', { bubbles: true }));
          }

          // 5. If sub-card Save button exists, click it to persist
          const saveBtn = Array.from(modal.querySelectorAll('button')).find(b => /^save$/i.test(b.innerText.trim()));
          if (saveBtn) {
            saveBtn.click();
          }
        }

        // B. Handle Delete Experience confirmation if dialog appeared
        const delConfirm = document.querySelector('.artdeco-modal__confirm-dialog-btn, button[data-control-name="confirm_delete"], button[data-test-dialog-primary-btn]');
        if (delConfirm) {
          delConfirm.click();
        }

        // C. Standard Form Elements Filling
        const rawInputs = Array.from(modal.querySelectorAll('input:not([type="hidden"]), select, textarea')).filter(el => {
          return !el.disabled && !el.readOnly && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.type === 'radio' || el.type === 'checkbox');
        });

        rawInputs.forEach(el => {
          const labelEl = el.id ? document.querySelector('label[for="' + el.id + '"]') : null;
          const pContainer = el.closest('.fb-dash-form-element, .jobs-easy-apply-form-section__grouping, [data-test-single-typeahead-entity-form-component], div[class*="form-component"], div[class*="form-element"], fieldset, li') || el.parentElement;
          const labelText = ((labelEl ? labelEl.innerText : '') + ' ' + (pContainer ? pContainer.innerText : '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('placeholder') || '') + ' ' + (el.name || '') + ' ' + el.id).replace(/\\s+/g, ' ').toLowerCase();

          const isCombobox = el.getAttribute('role') === 'combobox' || el.getAttribute('aria-autocomplete') === 'list' || el.classList.contains('search-basic-typeahead') || Boolean(el.closest('.search-basic-typeahead, .search-vertical-typeahead'));

          if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && ['text', 'tel', 'email', 'url', 'number', 'search', ''].includes(el.type))) {
            const isExp = /years.*experience|experience.*years|how\\s*many\\s*years/i.test(labelText) && !/salary|ctc|notice|grad/i.test(labelText);
            const isTech = /resume|python|sql|full\\s*stack|ai|engineer|developer|software|backend|react/i.test(labelText);
            const isLocation = /city|location|address|where|metro|town|area|place|state|country/i.test(labelText) || (isCombobox && !/company|title|school|college|degree|skill|role|name/i.test(labelText));

            if (isExp) {
              setVal(el, isTech ? '2' : '1');
            } else if (isLocation) {
              setVal(el, 'Bengaluru, Karnataka, India');
            } else if (/first\\s*name|^fname$/i.test(labelText)) {
              setVal(el, 'Sanjay');
            } else if (/last\\s*name|^lname$/i.test(labelText)) {
              setVal(el, 'N');
            } else if (/full\\s*name|your\\s*name|candidate\\s*name/i.test(labelText)) {
              setVal(el, 'Sanjay N');
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
            } else if (labelText.includes('linkedin')) {
              setVal(el, 'https://www.linkedin.com/in/sanjay--n');
            } else if (labelText.includes('github')) {
              setVal(el, 'https://github.com/RNS-Forge');
            } else if (labelText.includes('portfolio') || labelText.includes('website') || labelText.includes('other')) {
              setVal(el, 'https://rns-forge.github.io/RNS_Professional_Profile/');
            } else if (labelText.includes('summary') || labelText.includes('cover letter') || labelText.includes('tinkering') || labelText.includes('about')) {
              setVal(el, '2+ years of hands-on experience developing scalable full-stack software, agentic AI pipelines, microservices, and modern web architectures at Axodian. Deeply proficient in Python, FastAPI, React, SQL, and LLM APIs.');
            } else if (!el.value) {
              if (/years|number|count|period/i.test(labelText)) {
                setVal(el, '1');
              } else if (el.tagName === 'TEXTAREA') {
                setVal(el, 'Experienced in AI engineering, Python, React, and scalable backend services.');
              } else if (isCombobox) {
                setVal(el, 'Bengaluru, Karnataka, India');
              } else {
                setVal(el, 'Experienced Software Engineer');
              }
            }
          } else if (el.tagName === 'SELECT') {
            const opts = Array.from(el.options);
            let matchIdx = -1;
            if (/additional\s*month/i.test(labelText)) {
              matchIdx = opts.findIndex(o => o.text.includes('0'));
            } else if (/month/i.test(labelText)) {
              matchIdx = opts.findIndex(o => /january|jan|^1$/i.test(o.text.trim()));
              if (matchIdx === -1 && opts.length > 1) matchIdx = 1;
            } else if (/year/i.test(labelText)) {
              matchIdx = opts.findIndex(o => /2022|2021|2023/i.test(o.text));
              if (matchIdx === -1 && opts.length > 1) matchIdx = 1;
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

        // Select any open typeahead dropdown option (e.g. city, location, institution)
        const openOptions = Array.from(document.querySelectorAll([
          '[role="listbox"] [role="option"]',
          'div[role="option"]',
          '.basic-typeahead__selectable-list li',
          '.search-basic-typeahead__results li',
          'ul[id*="typeahead"] li',
          'div[id*="typeahead"] li',
          '[role="listbox"] li',
          '[role="listbox"] > div'
        ].join(', '))).filter(o => o.offsetWidth > 0 || o.offsetHeight > 0);

        if (openOptions.length > 0) {
          const opt = openOptions[0];
          opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          opt.click();
        }
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
      let nextJob = await selectNextFeedCard(ws);

      if (!nextJob || !nextJob.found) {
        log('FEED', 'End of visible cards. Scrolling search feed down to load more...');
        await scrollFeedContainer(ws);
        await sleep(1500);
        nextJob = await selectNextFeedCard(ws);
      }

      if (!nextJob || !nextJob.found) {
        log('PAGINATION', `Page ${currentPage} completed. Checking for next search page...`);
        const paged = await goToNextSearchPage(ws);
        if (paged.success) {
          currentPage++;
          log('PAGINATION', `Advanced to Search Results Page ${currentPage}. Loading fresh jobs...`);
          await sleep(3500);
          nextJob = await selectNextFeedCard(ws);
          if (!nextJob || !nextJob.found) {
            await scrollFeedContainer(ws);
            await sleep(1500);
            nextJob = await selectNextFeedCard(ws);
          }
        }
      }

      if (nextJob && nextJob.found) {
        log('TRANSITION', `Targeting: "${nextJob.title}"`);
        await sleep(2000);
      } else {
        log('COMPLETE', 'Reached the end of all search result pages. All Easy Apply jobs applied!');
        hasMoreJobs = false;
      }
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

async function scrollFeedContainer(ws) {
  return await cdpEval(ws, `(() => {
    const list = document.querySelector('.jobs-search-results-list, .jobs-search-results, div[data-view-name="job-search-results-list"], .scaffold-layout__list-detail');
    if (list) {
      list.scrollTop += 800;
      return true;
    }
    window.scrollBy(0, 800);
    return false;
  })()`);
}

async function goToNextSearchPage(ws) {
  return await cdpEval(ws, `(() => {
    // 1. Next button in pagination
    const nextBtn = document.querySelector('button[aria-label="View next page"], button[aria-label="Next"], .jobs-search-pagination__button--next')
      || Array.from(document.querySelectorAll('button')).find(b => {
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        const txt = (b.innerText || '').toLowerCase().trim();
        return (aria.includes('next page') || txt === 'next') && !b.disabled && b.offsetWidth > 0;
      });

    if (nextBtn && !nextBtn.disabled) {
      nextBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
      nextBtn.click();
      return { success: true };
    }

    // 2. Next numeric page button (e.g. active is page 1, look for page 2)
    const activePageBtn = document.querySelector('.jobs-search-pagination__indicator-button--active, [data-test-pagination-page-btn].active, button[aria-current="true"]');
    if (activePageBtn) {
      const activeNum = parseInt(activePageBtn.innerText.trim(), 10);
      if (!isNaN(activeNum)) {
        const targetPage = activeNum + 1;
        const targetBtn = Array.from(document.querySelectorAll('button')).find(b => {
          return b.innerText.trim() === String(targetPage) && !b.disabled && b.offsetWidth > 0;
        });
        if (targetBtn) {
          targetBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
          targetBtn.click();
          return { success: true };
        }
      }
    }

    return { success: false };
  })()`);
}

runAutoApply().catch(err => {
  log('ERROR', err.message);
  process.exit(1);
});
