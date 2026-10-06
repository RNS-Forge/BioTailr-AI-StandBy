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
 * 7. Multi-page continuous execution: page 1 through last page (10+ pages) without stopping.
 * 8. Live On-Screen StandBy HUD: real-time progress card displayed directly inside Chrome.
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
    batchTarget: 0, // 0 = unlimited continuous apply
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
          else reject(new Error('No active LinkedIn Jobs tab detected in Chrome. Please open LinkedIn search results in the debugging Chrome window.'));
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

async function ensureHudInjected(ws) {
  await cdpEval(ws, `(() => {
    if (document.getElementById('biotailr-standby-hud')) return;

    const hud = document.createElement('div');
    hud.id = 'biotailr-standby-hud';
    hud.style.cssText = \`
      position: fixed;
      top: 16px;
      right: 16px;
      width: 320px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-top: 3px solid #10b981;
      border-radius: 6px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      z-index: 9999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      color: #111827;
      overflow: hidden;
      transition: all 0.2s ease;
    \`;

    hud.innerHTML = \`
      <div style="padding: 10px 14px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);"></div>
          <span style="font-weight: 700; color: #111827; letter-spacing: -0.2px;">BioTailr StandBy</span>
          <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 2px 6px; border-radius: 4px;">ACTIVE</span>
        </div>
        <button id="bt-standby-min-btn" style="border: none; background: transparent; cursor: pointer; color: #6b7280; font-size: 16px; line-height: 1; padding: 2px 4px;">_</button>
      </div>
      <div id="bt-standby-body" style="padding: 12px 14px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 11px; color: #4b5563;">
          <span>Session Progress</span>
          <span style="font-weight: 600; color: #059669;" id="bt-standby-stats">Page 1 | Applied: 0</span>
        </div>
        <div style="background: #f3f4f6; border-radius: 4px; padding: 8px 10px; margin-bottom: 10px; border-left: 3px solid #10b981;">
          <div style="font-size: 10px; text-transform: uppercase; color: #6b7280; font-weight: 600;">Current Target</div>
          <div id="bt-standby-job" style="font-weight: 600; color: #111827; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Scanning...</div>
          <div id="bt-standby-company" style="font-size: 11px; color: #4b5563;">LinkedIn Feed</div>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; padding: 6px 8px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px;">
          <span style="color: #166534; font-weight: 500;">Status</span>
          <span id="bt-standby-status" style="font-weight: 600; color: #059669;">Auto-Applying</span>
        </div>
        <div id="bt-standby-log" style="margin-top: 8px; font-size: 10px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          Ready. Starting continuous job iterator...
        </div>
      </div>
    \`;

    document.body.appendChild(hud);

    window.__bioTailrUpdateHud = (data) => {
      const stats = document.getElementById('bt-standby-stats');
      const job = document.getElementById('bt-standby-job');
      const comp = document.getElementById('bt-standby-company');
      const status = document.getElementById('bt-standby-status');
      const log = document.getElementById('bt-standby-log');
      if (stats && data.page !== undefined) stats.innerText = 'Page ' + data.page + ' | Applied: ' + (data.appliedCount || 0);
      if (job && data.jobTitle) job.innerText = data.jobTitle;
      if (comp && data.company) comp.innerText = data.company;
      if (status && data.status) status.innerText = data.status;
      if (log && data.message) log.innerText = data.message;
    };

    const minBtn = document.getElementById('bt-standby-min-btn');
    const body = document.getElementById('bt-standby-body');
    if (minBtn && body) {
      minBtn.onclick = () => {
        const isHidden = body.style.display === 'none';
        body.style.display = isHidden ? 'block' : 'none';
        minBtn.innerText = isHidden ? '_' : '+';
      };
    }
  })()`);
}

async function updateHud(ws, state) {
  const serialized = JSON.stringify(state);
  await cdpEval(ws, `(() => {
    if (typeof window.__bioTailrUpdateHud === 'function') {
      window.__bioTailrUpdateHud(${serialized});
    }
  })()`);
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

  await ensureHudInjected(ws);

  const appliedJobs = [];
  const visitedJobKeys = new Set();

  let jobIndex = 0;
  let currentPage = 1;
  let hasMoreJobs = true;

  while (jobIndex < batchTarget && hasMoreJobs) {
    jobIndex++;
    console.log(`\n----------------------------------------------------`);
    const targetLabel = batchTarget === Infinity ? 'Unlimited' : String(batchTarget);
    log('BATCH', `[Job #${jobIndex} | Page ${currentPage} | Target: ${targetLabel}] Inspecting current active job card...`);
    console.log(`----------------------------------------------------`);

    await ensureHudInjected(ws);

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

    const currentKey = (jobInfo.title + '::' + jobInfo.company).toLowerCase();
    visitedJobKeys.add(currentKey);

    await updateHud(ws, {
      page: currentPage,
      appliedCount: appliedJobs.length,
      jobTitle: jobInfo.title,
      company: jobInfo.company,
      status: jobInfo.hasEasyApply ? 'Applying' : 'Skipping (No Easy Apply)',
      message: `Inspecting Job #${jobIndex}: ${jobInfo.title}`
    });

    if (!jobInfo.hasEasyApply) {
      log('SKIP', 'Easy Apply button not present on current job card. Moving to next card in search feed...');
      let nextJob = await selectNextFeedCard(ws, visitedJobKeys);
      if (!nextJob || !nextJob.found) {
        await scrollFeedContainer(ws);
        await sleep(1500);
        nextJob = await selectNextFeedCard(ws, visitedJobKeys);
      }
      if (!nextJob || !nextJob.found) {
        const paged = await goToNextSearchPage(ws);
        if (paged.success) {
          currentPage++;
          log('PAGINATION', `Advanced to Search Results Page ${currentPage}. Loading fresh jobs...`);
          await sleep(3500);
          await ensureHudInjected(ws);
        } else {
          hasMoreJobs = false;
        }
      }
      await sleep(1500);
      continue;
    }

    log('ACTION', 'Clicking Easy Apply button...');
    await updateHud(ws, {
      page: currentPage,
      appliedCount: appliedJobs.length,
      jobTitle: jobInfo.title,
      company: jobInfo.company,
      status: 'Opening Form',
      message: 'Clicked Easy Apply button'
    });

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
      await updateHud(ws, {
        page: currentPage,
        appliedCount: appliedJobs.length,
        jobTitle: jobInfo.title,
        company: jobInfo.company,
        status: `Solving Step ${stepCount}`,
        message: `${stepStatus.title || 'Form Filling'}`
      });

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
        };

        // A. Resolve nested "Edit experience" sub-card / required field errors
        const expHeaders = Array.from(modal.querySelectorAll('h3, h4, legend, .artdeco-modal__header')).filter(h => {
          return /edit experience|add experience|work experience/i.test(h.innerText || '');
        });

        if (expHeaders.length > 0) {
          const expInputs = Array.from(modal.querySelectorAll('input:not([type="hidden"]), select'));
          expInputs.forEach(el => {
            let p = el.parentElement;
            let labelText = '';
            for (let i = 0; i < 5; i++) {
              if (!p || p === modal) break;
              const lbl = p.querySelector('label');
              if (lbl && lbl.innerText.trim()) { labelText = lbl.innerText.toLowerCase(); break; }
              p = p.parentElement;
            }
            if (!labelText) labelText = (el.getAttribute('aria-label') || el.name || el.id || '').toLowerCase();

            if (el.tagName === 'INPUT' && (el.type === 'text' || !el.type)) {
              if (labelText.includes('title')) setVal(el, 'Full Stack & AI Engineer');
              else if (labelText.includes('company')) setVal(el, 'Axodian');
              else if (labelText.includes('location')) setVal(el, 'Bengaluru, Karnataka, India');
            } else if (el.tagName === 'SELECT') {
              const opts = Array.from(el.options);
              if (labelText.includes('month')) {
                const idx = opts.findIndex(o => /january|jan|^1$/i.test(o.text.trim()));
                if (idx !== -1) { el.selectedIndex = idx; el.dispatchEvent(new Event('change', { bubbles: true })); }
              } else if (labelText.includes('year')) {
                const idx = opts.findIndex(o => /2022|2021|2023/i.test(o.text.trim()));
                if (idx !== -1) { el.selectedIndex = idx; el.dispatchEvent(new Event('change', { bubbles: true })); }
              }
            } else if (el.type === 'checkbox' && /current|currently work/i.test(labelText)) {
              if (!el.checked) { el.click(); el.dispatchEvent(new Event('change', { bubbles: true })); }
            }
          });

          // Click Save button on experience sub-form
          const saveBtn = Array.from(modal.querySelectorAll('button')).find(b => {
            const t = b.innerText.trim().toLowerCase();
            return (t === 'save' || t === 'save changes') && b.offsetWidth > 0;
          });
          if (saveBtn) {
            saveBtn.click();
            return;
          }

          // Handle "Delete experience" if unable to save
          const deleteBtn = Array.from(modal.querySelectorAll('button')).find(b => {
            const t = b.innerText.trim().toLowerCase();
            return (t.includes('delete experience') || t === 'delete') && b.offsetWidth > 0;
          });
          if (deleteBtn) {
            deleteBtn.click();
            setTimeout(() => {
              const confirmBtn = document.querySelector('.artdeco-modal__confirm-dialog-btn, button[data-control-name="confirm_delete"], button[data-test-dialog-primary-btn]');
              if (confirmBtn) confirmBtn.click();
            }, 300);
            return;
          }
        }

        // B. Standard Field Solver
        const inputs = Array.from(modal.querySelectorAll('input:not([type="hidden"]), textarea, select'));

        inputs.forEach(el => {
          let p = el.parentElement;
          let labelText = '';
          for (let i = 0; i < 5; i++) {
            if (!p || p === modal) break;
            const lbl = p.querySelector('label');
            if (lbl && lbl.innerText.trim()) { labelText = lbl.innerText.toLowerCase(); break; }
            p = p.parentElement;
          }
          if (!labelText) labelText = (el.getAttribute('aria-label') || el.name || el.id || '').toLowerCase();

          const isCombobox = el.getAttribute('role') === 'combobox'
            || el.classList.contains('search-basic-typeahead__input')
            || el.classList.contains('basic-typeahead__input')
            || Boolean(el.closest('[role="combobox"]'));

          if (el.tagName === 'INPUT' && (el.type === 'text' || !el.type || el.type === 'number')) {
            const isCityOrLocation = labelText.includes('city') || labelText.includes('location') || labelText.includes('address') || labelText.includes('residence') || labelText.includes('postal') || labelText.includes('zip');

            if (isCityOrLocation) {
              setVal(el, 'Bengaluru, Karnataka, India');
            } else if (labelText.includes('first name') || labelText.includes('given name')) {
              setVal(el, 'Sanjay');
            } else if (labelText.includes('last name') || labelText.includes('family name') || labelText.includes('surname')) {
              setVal(el, 'N');
            } else if (labelText.includes('phone') || labelText.includes('mobile')) {
              setVal(el, '9361599018');
            } else if (labelText.includes('email')) {
              setVal(el, '2005sanjaynrs@gmail.com');
            } else if (labelText.includes('experience') || labelText.includes('years') || labelText.includes('duration') || labelText.includes('python') || labelText.includes('fastapi') || labelText.includes('react') || labelText.includes('sql') || labelText.includes('ai') || labelText.includes('llm')) {
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

      // 4. Navigation Check: Submit Application
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
        await updateHud(ws, {
          page: currentPage,
          appliedCount: appliedJobs.length + 1,
          jobTitle: jobInfo.title,
          company: jobInfo.company,
          status: 'Submitted!',
          message: 'Application successfully submitted'
        });

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

      // 5. Navigation Check: Review / Next
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
      await updateHud(ws, {
        page: currentPage,
        appliedCount: appliedJobs.length,
        jobTitle: 'Finding next job...',
        company: 'LinkedIn Feed',
        status: 'Scanning Cards',
        message: 'Looking for next unvisited Easy Apply listing'
      });

      let nextJob = await selectNextFeedCard(ws, visitedJobKeys);

      if (!nextJob || !nextJob.found) {
        log('FEED', 'End of visible cards on page. Scrolling search feed down to load more...');
        await scrollFeedContainer(ws);
        await sleep(1500);
        nextJob = await selectNextFeedCard(ws, visitedJobKeys);
      }

      if (!nextJob || !nextJob.found) {
        log('PAGINATION', `Page ${currentPage} completed. Checking for next search page...`);
        await updateHud(ws, {
          page: currentPage,
          appliedCount: appliedJobs.length,
          jobTitle: `Advancing to Page ${currentPage + 1}...`,
          company: 'LinkedIn Search',
          status: 'Advancing Page',
          message: `Finished Page ${currentPage}. Loading Page ${currentPage + 1}...`
        });

        const paged = await goToNextSearchPage(ws);
        if (paged.success) {
          currentPage++;
          log('PAGINATION', `Advanced to Search Results Page ${currentPage}. Loading fresh jobs...`);
          await sleep(3500);
          await ensureHudInjected(ws);

          nextJob = await selectNextFeedCard(ws, visitedJobKeys);
          if (!nextJob || !nextJob.found) {
            await scrollFeedContainer(ws);
            await sleep(1500);
            nextJob = await selectNextFeedCard(ws, visitedJobKeys);
          }
        }
      }

      if (nextJob && nextJob.found) {
        log('TRANSITION', `Targeting: "${nextJob.title}"`);
        await updateHud(ws, {
          page: currentPage,
          appliedCount: appliedJobs.length,
          jobTitle: nextJob.title,
          company: nextJob.company || 'Selected Job',
          status: 'Target Selected',
          message: `Selected: ${nextJob.title}`
        });
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

  await updateHud(ws, {
    page: currentPage,
    appliedCount: appliedJobs.length,
    jobTitle: 'All Pages Completed',
    company: 'Session Finished',
    status: 'COMPLETE',
    message: `Batch finished: ${appliedJobs.length} jobs applied!`
  });

  ws.close();
  process.exit(0);
}

/**
 * Universal Job Card Selector
 * Operates across both Modern Atomic CSS layout and Legacy LinkedIn layouts.
 */
async function selectNextFeedCard(ws, visitedSet) {
  const visitedArray = Array.from(visitedSet);
  const serialized = JSON.stringify(visitedArray);

  return await cdpEval(ws, `(() => {
    const visited = new Set(${serialized});

    // 1. Modern Layout: Discover job cards via Dismiss buttons or card containers
    const dismissBtns = Array.from(document.querySelectorAll('button[aria-label*="Dismiss"], button[aria-label*="dismiss"]'));
    for (const btn of dismissBtns) {
      const label = btn.getAttribute('aria-label') || '';
      const m = label.match(/Dismiss\\s+(.*?)\\s+job/i);
      const title = m ? m[1].trim() : '';

      let card = btn.parentElement;
      while (card && card.tagName !== 'BODY') {
        if (card.nextElementSibling?.tagName === 'HR' || card.previousElementSibling?.tagName === 'HR') break;
        card = card.parentElement;
      }
      if (!card) continue;

      const text = (card.innerText || '').toLowerCase();
      const isApplied = text.includes('applied') || text.includes('application submitted');

      // Extract company
      const compEl = card.querySelector('div[class*="dj9lki"], p, span');
      const company = compEl ? compEl.innerText.trim() : '';
      const key = (title + '::' + company).toLowerCase();

      if (!visited.has(key) && !isApplied) {
        const clickTarget = card.querySelector('[componentkey], div[role="button"][tabindex="0"], a') || card;
        clickTarget.scrollIntoView({ behavior: 'instant', block: 'center' });
        clickTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        clickTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        clickTarget.click();
        return { found: true, title, company, key };
      }
    }

    // 2. Component Key direct cards
    const compCards = Array.from(document.querySelectorAll('[componentkey], div[role="button"][tabindex="0"]')).filter(el => {
      return el.offsetHeight > 40 && el.offsetWidth > 150;
    });

    for (const card of compCards) {
      const text = (card.innerText || '').toLowerCase();
      const isApplied = text.includes('applied') || text.includes('application submitted');
      const titleEl = card.querySelector('p, span, h3, h2, strong');
      const title = titleEl ? titleEl.innerText.trim() : '';
      const key = title.toLowerCase();

      if (title && !visited.has(key) && !isApplied) {
        card.scrollIntoView({ behavior: 'instant', block: 'center' });
        card.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        card.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        card.click();
        return { found: true, title, key };
      }
    }

    // 3. Legacy Layout: via class names
    const legacyCards = Array.from(document.querySelectorAll('.jobs-search-results-list__list-item, .job-card-container, [data-occludable-job-id]'));
    for (const card of legacyCards) {
      const text = card.innerText.toLowerCase();
      const isApplied = text.includes('applied') || text.includes('application submitted');
      const titleEl = card.querySelector('.job-card-list__title, a.job-card-container__link, strong');
      const title = titleEl ? titleEl.innerText.trim() : '';
      const compEl = card.querySelector('.job-card-container__primary-description');
      const company = compEl ? compEl.innerText.trim() : '';
      const key = (title + '::' + company).toLowerCase();

      if (title && !visited.has(key) && !isApplied) {
        const link = card.querySelector('a.job-card-container__link, a[href*="/jobs/view/"], a');
        if (link) {
          link.scrollIntoView({ behavior: 'instant', block: 'center' });
          link.click();
          return { found: true, title, company, key };
        }
      }
    }

    return { found: false };
  })()`);
}

/**
 * Universal Feed Scroller
 * Scrolls the active left job listings container in both modern atomic & classic layouts.
 */
async function scrollFeedContainer(ws) {
  return await cdpEval(ws, `(() => {
    // 1. Modern layout scroll container detection
    const dismissBtn = document.querySelector('button[aria-label*="Dismiss"], button[aria-label*="dismiss"]');
    let container = null;
    if (dismissBtn) {
      let p = dismissBtn.parentElement;
      while (p && p.tagName !== 'BODY') {
        if (p.scrollHeight > p.clientHeight + 100 && p.offsetHeight > 200) {
          container = p;
          break;
        }
        p = p.parentElement;
      }
    }

    // 2. Legacy selectors fallback
    if (!container) {
      container = document.querySelector('.jobs-search-results-list, .jobs-search-results, div[data-view-name="job-search-results-list"], .scaffold-layout__list-detail');
    }

    if (container) {
      container.scrollTop += 600;
      container.dispatchEvent(new Event('scroll', { bubbles: true }));
      return true;
    }

    window.scrollBy(0, 600);
    return false;
  })()`);
}

/**
 * Universal Search Pagination Solver
 * Finds and clicks the Next button or the next numeric page button (e.g. Page 1 -> 2 -> 3... 10+).
 */
async function goToNextSearchPage(ws) {
  return await cdpEval(ws, `(() => {
    // 1. Next button
    const nextBtns = Array.from(document.querySelectorAll('button, a[role="button"]')).filter(b => {
      const t = b.innerText.trim().toLowerCase();
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      return (t === 'next' || aria === 'next' || aria.includes('next page') || b.classList.contains('jobs-search-pagination__button--next')) && !b.disabled && b.offsetWidth > 0;
    });

    if (nextBtns.length > 0) {
      const nextBtn = nextBtns[0];
      nextBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
      nextBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      nextBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      nextBtn.click();
      return { success: true };
    }

    // 2. Numeric page buttons (e.g. Page 1 -> Page 2 -> Page 3...)
    const pageBtns = Array.from(document.querySelectorAll('button, a[role="button"]')).filter(b => {
      const aria = (b.getAttribute('aria-label') || '');
      const t = b.innerText.trim();
      return /Page\\s+\\d+/i.test(aria) || /^\\d+$/.test(t);
    });

    const activeBtn = pageBtns.find(b => b.getAttribute('aria-current') === 'true' || b.classList.contains('active') || b.parentElement?.classList.contains('active'));
    const activeNum = activeBtn ? parseInt(activeBtn.innerText.trim() || activeBtn.getAttribute('aria-label')?.replace(/\\D/g, ''), 10) : 1;
    const nextNum = activeNum + 1;
    const targetBtn = pageBtns.find(b => {
      const num = parseInt(b.innerText.trim() || b.getAttribute('aria-label')?.replace(/\\D/g, ''), 10);
      return num === nextNum;
    });

    if (targetBtn && !targetBtn.disabled) {
      targetBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
      targetBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      targetBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      targetBtn.click();
      return { success: true };
    }

    return { success: false };
  })()`);
}

runAutoApply().catch(err => {
  log('ERROR', err.message);
  process.exit(1);
});
