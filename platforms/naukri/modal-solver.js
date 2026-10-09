/**
 * BioTailr AI StandBy - Naukri Modal & Chatbot Solver
 * Handles Naukri's quick apply modals, recruiter screening chatbots,
 * CTC/notice period/experience questionnaires, and post-submission dialogs.
 */

const { dispatchCdpClick } = require('./card-selector');

const CONTAINER_SEL = '.chatbot, [class*="chat-container"], [class*="chat_wrapper"], [class*="bot-container"], [class*="apply-modal"], [role="dialog"], .apply-message-container, [class*="drawer-wrapper"], [class*="apply-drawer"], [class*="questionnaire"], div.layer';

/**
 * Check if Naukri modal, chatbot, or application drawer is currently open.
 */
async function getNaukriModalStatus(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    const CONTAINER_SEL = '.chatbot, [class*="chat-container"], [class*="chat_wrapper"], [class*="bot-container"], [class*="apply-modal"], [role="dialog"], .apply-message-container, [class*="drawer-wrapper"], [class*="apply-drawer"], [class*="questionnaire"], div.layer';
    const chatbot = document.querySelector('.chatbot, [class*="chat-container"], [class*="chat_wrapper"], [class*="bot-container"]');
    const modal = document.querySelector('[class*="apply-modal"], [role="dialog"], .apply-message-container, [class*="drawer-wrapper"], [class*="apply-drawer"], [class*="questionnaire"], div.layer[class*="apply"]');
    const container = chatbot || modal;

    if (!container || container.offsetWidth <= 0) {
      return { modalOpen: false };
    }

    const text = (container.innerText || '').toLowerCase();
    const isPostSubmit = text.includes('applied successfully') ||
                         text.includes('application sent') ||
                         text.includes('application submitted') ||
                         text.includes('your application has been') ||
                         text.includes('similar jobs you may like') ||
                         text.includes('successfully applied');

    const buttons = Array.from(container.querySelectorAll('button, a[role="button"], input[type="submit"]'))
      .filter(b => b.offsetWidth > 0)
      .map(b => (b.innerText || b.value || '').trim())
      .filter(Boolean);

    const heading = container.querySelector('h2, h3, h4, .title, .heading, .question-title, .bot-msg') ?
      container.querySelector('h2, h3, h4, .title, .heading, .question-title, .bot-msg').innerText.trim() : '';

    return { modalOpen: true, isChatbot: Boolean(chatbot), isPostSubmit, heading, buttons, textSnippet: text.slice(0, 150) };
  })()`);
}

/**
 * Solve form fields, questionnaire inputs, and chatbot chips in the Naukri apply dialog.
 */
async function solveNaukriModal(ws, cdpEval, profile) {
  // Extract all profile values outside the template literal to avoid backtick conflicts
  const noticeDays   = String(profile.experience && profile.experience.noticePeriodDays || 15);
  const curSalaryLpa = String(profile.experience && profile.experience.currentSalaryLpa  || '2');
  const curSalary    = String(profile.experience && profile.experience.currentSalary     || '200000');
  const expSalaryLpa = String(profile.experience && profile.experience.expectedSalaryLpa || '4.5');
  const expSalary    = String(profile.experience && profile.experience.expectedSalary    || '450000');
  const totalYears   = String(profile.experience && profile.experience.totalYears        || 1);
  const city         = String(profile.personal && profile.personal.city || 'Coimbatore').replace(/'/g, "\\'");
  const phone        = String(profile.personal && profile.personal.phone || '9361599018').replace(/\D/g, '').slice(-10);
  const email        = String(profile.personal && profile.personal.email || '2005sanjaynrs@gmail.com').replace(/'/g, "\\'");
  const fullName     = String(profile.personal && profile.personal.fullName || 'Sanjay N').replace(/'/g, "\\'");
  const pitch = [
    'Hi, I am Sanjay N, Full Stack & AI Engineer with production LLM agent pipelines & generative AI experience at Axodian.',
    '',
    'Key Projects:',
    '- BioTailr AI (Real-time ATS Resume Platform): https://rns-forge.github.io/BioTailr-AI/',
    '- Agentium (AI Agent Framework): https://pypi.org/project/agentium',
    '- Contributor at Faculties.ai',
    '- AgriBridge & Furry Funds AI',
    '',
    'Notice Period: 15 Days | Current CTC: 2 LPA | Expected CTC: 4.5 LPA | Location: Coimbatore, Tamil Nadu',
    'Portfolio: https://rns-forge.github.io/RNS_Professional_Profile/'
  ].join('\\n').replace(/'/g, "\\'");

  const expression = `(() => {
    const NOTICE_DAYS = '${noticeDays}';
    const CUR_LPA     = '${curSalaryLpa}';
    const CUR_SAL     = '${curSalary}';
    const EXP_LPA     = '${expSalaryLpa}';
    const EXP_SAL     = '${expSalary}';
    const TOTAL_YEARS = '${totalYears}';
    const CITY        = '${city}';
    const PHONE       = '${phone}';
    const EMAIL       = '${email}';
    const FULL_NAME   = '${fullName}';
    const PITCH       = '${pitch}';

    const sel = '.chatbot, [class*="chat-container"], [class*="chat_wrapper"], [class*="bot-container"], [class*="apply-modal"], [role="dialog"], .apply-message-container, [class*="drawer-wrapper"], [class*="apply-drawer"], [class*="questionnaire"], div.layer';
    const container = document.querySelector(sel);
    if (!container) return { solved: false, reason: 'no_container' };

    let solvedCount = 0;

    const setInputValue = (input, val) => {
      try {
        input.focus();
        const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
          || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
        const nativeSetter = desc && desc.set;
        if (nativeSetter) { nativeSetter.call(input, val); }
        else { input.value = val; }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        solvedCount++;
        return true;
      } catch (e) { return false; }
    };

    // 1. Chatbot Quick-Reply Chips
    const chips = Array.from(container.querySelectorAll('.chip, .quick-reply, [class*="chip"], [class*="pill"], button[class*="option"], li[class*="option"], [class*="clickable-chip"], div[class*="choice"]'))
      .filter(el => el.offsetWidth > 0);

    if (chips.length > 0) {
      const lastBotEl = Array.from(container.querySelectorAll('.bot-msg, .bot-message, .msg-text, [class*="chat-bubble"]')).pop();
      const recentBotMsg = lastBotEl ? lastBotEl.innerText.toLowerCase() : '';
      let matchedChip = null;

      if (recentBotMsg.includes('notice') || recentBotMsg.includes('join') || recentBotMsg.includes('availab')) {
        matchedChip = chips.find(c => {
          const txt = (c.innerText || '').toLowerCase();
          return txt.includes('15') || txt.includes('immediate') || txt.includes('1 month') || txt.includes('serving');
        });
      }
      if (!matchedChip && (recentBotMsg.includes('experience') || recentBotMsg.includes('years'))) {
        matchedChip = chips.find(c => {
          const txt = (c.innerText || '').toLowerCase();
          return txt.includes('1') || txt.includes('0-1') || txt.includes('1-2') || txt.includes('1 year');
        });
      }
      if (!matchedChip && (recentBotMsg.includes('current ctc') || recentBotMsg.includes('current salary'))) {
        matchedChip = chips.find(c => {
          const txt = (c.innerText || '').toLowerCase();
          return txt.includes('2') || txt.includes('0-3') || txt.includes('1-2') || txt.includes('2-3');
        });
      }
      if (!matchedChip && (recentBotMsg.includes('expected ctc') || recentBotMsg.includes('expected salary'))) {
        matchedChip = chips.find(c => {
          const txt = (c.innerText || '').toLowerCase();
          return txt.includes('4.5') || txt.includes('4') || txt.includes('3-5') || txt.includes('4-6');
        });
      }
      if (!matchedChip && (recentBotMsg.includes('relocate') || recentBotMsg.includes('office') || recentBotMsg.includes('shift') || recentBotMsg.includes('hybrid'))) {
        matchedChip = chips.find(c => (c.innerText || '').toLowerCase().trim() === 'yes');
      }
      if (!matchedChip) {
        matchedChip = chips.find(c => {
          const txt = (c.innerText || '').toLowerCase().trim();
          return txt === 'yes' || txt.includes('immediate') || txt === '15 days';
        });
      }
      if (matchedChip) {
        matchedChip.click();
        return { solved: true, type: 'clicked_chip', label: matchedChip.innerText ? matchedChip.innerText.trim() : '' };
      }
    }

    // 2. Text Inputs / Textareas
    const inputs = Array.from(container.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea'))
      .filter(el => el.offsetWidth > 0 && !el.disabled && !el.readOnly);

    for (const input of inputs) {
      if (input.value && input.value.trim().length > 0) continue;
      const placeholder = (input.placeholder || '').toLowerCase();
      const parentText = input.parentElement ? input.parentElement.innerText.toLowerCase() : '';
      const name = (input.name || input.id || '').toLowerCase();
      const combined = placeholder + ' ' + parentText + ' ' + name;

      if (combined.includes('notice') || combined.includes('joining') || combined.includes('how soon')) {
        setInputValue(input, NOTICE_DAYS); continue;
      }
      if (combined.includes('current ctc') || combined.includes('current salary') || combined.includes('present ctc')) {
        setInputValue(input, (combined.includes('lakh') || combined.includes('lac') || combined.includes('lpa')) ? CUR_LPA : CUR_SAL); continue;
      }
      if (combined.includes('expected ctc') || combined.includes('expected salary') || combined.includes('minimum ctc')) {
        setInputValue(input, (combined.includes('lakh') || combined.includes('lac') || combined.includes('lpa')) ? EXP_LPA : EXP_SAL); continue;
      }
      if (combined.includes('experience') || combined.includes('years') || combined.includes('exp in')) {
        setInputValue(input, TOTAL_YEARS); continue;
      }
      if (combined.includes('city') || combined.includes('location') || combined.includes('where')) {
        setInputValue(input, CITY); continue;
      }
      if (combined.includes('phone') || combined.includes('mobile') || combined.includes('contact')) {
        setInputValue(input, PHONE); continue;
      }
      if (combined.includes('email')) {
        setInputValue(input, EMAIL); continue;
      }
      if (combined.includes('name') && !combined.includes('company')) {
        setInputValue(input, FULL_NAME); continue;
      }
      if (input.tagName === 'TEXTAREA' || combined.includes('cover') || combined.includes('pitch') || combined.includes('message') || combined.includes('why should')) {
        setInputValue(input, PITCH); continue;
      }
      if (input.type === 'number') { setInputValue(input, '1'); }
      else { setInputValue(input, 'Yes'); }
    }

    // 3. Radio Buttons
    const radioGroups = {};
    const radios = Array.from(container.querySelectorAll('input[type="radio"]')).filter(r => r.offsetWidth > 0);
    for (const r of radios) {
      const gName = r.name || 'default';
      radioGroups[gName] = radioGroups[gName] || [];
      radioGroups[gName].push(r);
    }
    for (const gName of Object.keys(radioGroups)) {
      const group = radioGroups[gName];
      if (group.some(r => r.checked)) continue;
      const yesRadio = group.find(r => {
        const txt = (r.value || (r.parentElement ? r.parentElement.innerText : '') || '').toLowerCase().trim();
        return txt === 'yes' || txt.includes('yes') || txt.includes('immediate') || txt.includes('15');
      });
      const target = yesRadio || group[0];
      if (target) {
        target.click(); target.checked = true;
        target.dispatchEvent(new Event('change', { bubbles: true }));
        solvedCount++;
      }
    }

    // 4. Checkboxes
    Array.from(container.querySelectorAll('input[type="checkbox"]'))
      .filter(c => c.offsetWidth > 0 && !c.checked)
      .forEach(cb => { cb.click(); cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); solvedCount++; });

    // 5. Select Dropdowns
    Array.from(container.querySelectorAll('select'))
      .filter(s => s.offsetWidth > 0 && s.selectedIndex <= 0)
      .forEach(sel => {
        const opts = Array.from(sel.options);
        const yesOpt = opts.find(o => /yes|15|1 year|immediate/i.test(o.text));
        sel.selectedIndex = yesOpt ? yesOpt.index : (opts.length > 1 ? 1 : 0);
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        solvedCount++;
      });

    return { solved: true, fieldsCount: solvedCount };
  })()`;

  return await cdpEval(ws, expression);
}

/**
 * Click Submit / Save & Next / Apply button to complete the application.
 */
async function trySubmitNaukriModal(ws, cdpEval) {
  const coords = await cdpEval(ws, `(() => {
    const sel = '.chatbot, [class*="chat-container"], [class*="chat_wrapper"], [class*="bot-container"], [class*="apply-modal"], [role="dialog"], .apply-message-container, [class*="drawer-wrapper"], [class*="apply-drawer"], [class*="questionnaire"], div.layer';
    const container = document.querySelector(sel);
    const searchRoot = container || document;

    const btn = Array.from(searchRoot.querySelectorAll('button, input[type="submit"], a[role="button"]')).find(b => {
      if (b.offsetWidth <= 0) return false;
      const txt = (b.innerText || b.value || '').toLowerCase().trim();
      const cls = (b.className || '').toLowerCase();
      const id = (b.id || '').toLowerCase();
      return txt === 'submit' || txt === 'submit application' ||
             txt === 'apply' || txt === 'save & next' || txt === 'save and next' ||
             txt === 'send' || txt === 'apply now' ||
             cls.includes('submit') || cls.includes('send-btn') || id.includes('submit');
    });

    if (btn) {
      btn.scrollIntoView({ behavior: 'instant', block: 'center' });
      const r = btn.getBoundingClientRect();
      return { clicked: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    }
    return { clicked: false };
  })()`);

  if (coords && coords.clicked && coords.x && coords.y) {
    await dispatchCdpClick(ws, coords.x, coords.y);
    return true;
  }
  return false;
}

/**
 * Click Next / Continue / Send if the modal is a multi-step questionnaire.
 */
async function tryAdvanceNaukriModal(ws, cdpEval) {
  const coords = await cdpEval(ws, `(() => {
    const sel = '.chatbot, [class*="chat-container"], [class*="chat_wrapper"], [class*="bot-container"], [class*="apply-modal"], [role="dialog"], .apply-message-container, [class*="drawer-wrapper"], [class*="apply-drawer"], [class*="questionnaire"], div.layer';
    const container = document.querySelector(sel);
    const searchRoot = container || document;

    const btn = Array.from(searchRoot.querySelectorAll('button, a[role="button"], input[type="submit"]')).find(b => {
      if (b.offsetWidth <= 0) return false;
      const txt = (b.innerText || b.value || '').toLowerCase().trim();
      const cls = (b.className || '').toLowerCase();
      return txt === 'next' || txt === 'continue' || txt === 'save' || txt === 'send' ||
             cls.includes('next') || cls.includes('chat-button') || cls.includes('send');
    });

    if (btn) {
      btn.scrollIntoView({ behavior: 'instant', block: 'center' });
      const r = btn.getBoundingClientRect();
      return { clicked: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    }
    return { clicked: false };
  })()`);

  if (coords && coords.clicked && coords.x && coords.y) {
    await dispatchCdpClick(ws, coords.x, coords.y);
    return true;
  }
  return false;
}

/**
 * Dismiss post-submission confirmation banner, drawer, or modal.
 */
async function dismissNaukriPostSubmit(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    const candidates = Array.from(document.querySelectorAll('.crossIcon, [class*="cross"], [class*="close"], button.close, [aria-label*="close" i], [aria-label*="dismiss" i], button'))
      .filter(b => {
        if (b.offsetWidth <= 0) return false;
        const txt = (b.innerText || '').toLowerCase().trim();
        const cls = (b.className || '').toLowerCase();
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        return txt === 'close' || txt === 'done' || txt === 'got it' ||
               cls.includes('cross') || cls.includes('close') ||
               aria.includes('close') || aria.includes('dismiss');
      });
    for (const btn of candidates) {
      try { btn.click(); return true; } catch (e) {}
    }
    return false;
  })()`);
}

/**
 * Discard / close incomplete or stuck modal to return to listings feed.
 */
async function discardNaukriIncompleteModal(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    const closeBtn = document.querySelector('.crossIcon, [class*="cross"], [class*="close"], [aria-label*="close" i]');
    if (closeBtn && closeBtn.offsetWidth > 0) { closeBtn.click(); return true; }
    return false;
  })()`);
}

module.exports = {
  getNaukriModalStatus,
  solveNaukriModal,
  trySubmitNaukriModal,
  tryAdvanceNaukriModal,
  dismissNaukriPostSubmit,
  discardNaukriIncompleteModal
};
