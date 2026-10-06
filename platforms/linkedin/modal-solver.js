/**
 * BioTailr AI StandBy - LinkedIn Easy Apply Modal Solver
 * Solves multi-step application forms, education pruning, experience sub-forms,
 * city comboboxes, typeaheads, radios, and automated submissions.
 * Includes dynamic error auto-correction (pure numbers for numeric/salary inputs,
 * dropdown selection for Coimbatore location).
 */

async function getLinkedInModalStatus(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
    if (!modal) return { modalOpen: false };

    const modalText = (modal.innerText || '').toLowerCase();
    const actionButtons = Array.from(modal.querySelectorAll('button')).filter(b => b.offsetWidth > 0).map(b => b.innerText.trim());

    return {
      modalOpen: true,
      title: modal.querySelector('h1, h2, h3, .jobs-easy-apply-modal__title')?.innerText?.trim(),
      buttons: actionButtons,
      isEducation: modalText.includes('education') && !modalText.includes('work experience'),
      isExperience: modalText.includes('work experience')
    };
  })()`);
}

async function handleProfilePrompt(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
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
}

async function pruneEducation(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
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
}

async function solveFormFields(ws, cdpEval, profile) {
  return await cdpEval(ws, `(() => {
    const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
    if (!modal) return;

    const setVal = (el, val) => {
      if (!el) return;
      const strVal = String(val);
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement?.prototype : window.HTMLInputElement?.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto || {}, 'value')?.set
        || Object.getOwnPropertyDescriptor(el.__proto__ || {}, 'value')?.set;
      if (setter) setter.call(el, strVal);
      else el.value = strVal;
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
          else if (labelText.includes('location')) setVal(el, 'Coimbatore, Tamil Nadu, India');
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
        const isCityOrLocation = labelText.includes('city') || labelText.includes('location') || labelText.includes('address') || labelText.includes('residence') || labelText.includes('postal') || labelText.includes('zip') || isCombobox;

        if (isCityOrLocation) {
          // Set location to Coimbatore and trigger typeahead event
          setVal(el, 'Coimbatore');
          el.dispatchEvent(new Event('focus', { bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'e' }));
          el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'e' }));
        } else if (labelText.includes('first name') || labelText.includes('given name')) {
          setVal(el, 'Sanjay');
        } else if (labelText.includes('last name') || labelText.includes('family name') || labelText.includes('surname')) {
          setVal(el, 'N');
        } else if (labelText.includes('phone') || labelText.includes('mobile')) {
          setVal(el, '9361599018');
        } else if (labelText.includes('email')) {
          setVal(el, '2005sanjaynrs@gmail.com');
        } else if (labelText.includes('notice')) {
          // Pure numbers only for notice period
          setVal(el, '15');
        } else if (labelText.includes('current ctc') || labelText.includes('current salary') || labelText.includes('fixed ctc')) {
          // Strictly pure numbers: 800000 or 8 if LPA field
          const isLpa = /lpa|lakh/i.test(labelText) || (el.maxLength > 0 && el.maxLength <= 4);
          setVal(el, isLpa ? '8' : '800000');
        } else if (labelText.includes('expected ctc') || labelText.includes('expected salary')) {
          // Strictly pure numbers: 1200000 or 12 if LPA field
          const isLpa = /lpa|lakh/i.test(labelText) || (el.maxLength > 0 && el.maxLength <= 4);
          setVal(el, isLpa ? '12' : '1200000');
        } else if (labelText.includes('experience') || labelText.includes('years') || labelText.includes('duration') || labelText.includes('python') || labelText.includes('fastapi') || labelText.includes('react') || labelText.includes('sql') || labelText.includes('ai') || labelText.includes('llm')) {
          setVal(el, '2');
        } else if (labelText.includes('organisation') || labelText.includes('organization') || labelText.includes('company')) {
          setVal(el, 'Axodian');
        } else if (labelText.includes('designation') || labelText.includes('title')) {
          setVal(el, 'Full Stack & AI Engineer');
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

    // C. Select Typeahead Dropdown Option (Prefers Coimbatore)
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
      const coimbatoreOpt = openOptions.find(o => /coimbatore/i.test(o.innerText || '')) || openOptions[0];
      coimbatoreOpt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      coimbatoreOpt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      coimbatoreOpt.click();
    }

    // D. Validation Error Auto-Correction Pass
    // Detects any input marked invalid and sanitizes it strictly to numbers or clean text
    const errorMessages = Array.from(modal.querySelectorAll('.artdeco-inline-feedback--error, [data-test-form-element-error-messages], .fb-form-element__error-text'));
    const invalidInputs = Array.from(modal.querySelectorAll('input[aria-invalid="true"], select[aria-invalid="true"], textarea[aria-invalid="true"]'));

    const problemInputs = new Set([
      ...invalidInputs,
      ...errorMessages.map(em => {
        let parent = em.parentElement;
        while (parent && parent !== modal) {
          const inp = parent.querySelector('input, select, textarea');
          if (inp) return inp;
          parent = parent.parentElement;
        }
        return null;
      }).filter(Boolean)
    ]);

    problemInputs.forEach(el => {
      let p = el.parentElement;
      let labelText = '';
      for (let i = 0; i < 5; i++) {
        if (!p || p === modal) break;
        const lbl = p.querySelector('label');
        if (lbl && lbl.innerText.trim()) { labelText = lbl.innerText.toLowerCase(); break; }
        p = p.parentElement;
      }
      if (!labelText) labelText = (el.getAttribute('aria-label') || el.name || el.id || '').toLowerCase();

      // Check if it is a salary/CTC field
      if (/ctc|salary|package|compensation|remuneration/i.test(labelText)) {
        const curVal = el.value || '';
        // If current value contains non-digits, strip them immediately
        if (/\D/.test(curVal)) {
          const onlyDigits = curVal.replace(/\D/g, '');
          setVal(el, onlyDigits || (labelText.includes('expected') ? '1200000' : '800000'));
        } else {
          // If pure numbers failed, it might be an LPA field (e.g. 8 or 12) or vice-versa
          if (curVal === '800000' || curVal.length > 4) {
            setVal(el, '8');
          } else if (curVal === '1200000' || curVal.length > 4) {
            setVal(el, '12');
          } else if (curVal === '8') {
            setVal(el, '800000');
          } else if (curVal === '12') {
            setVal(el, '1200000');
          }
        }
      } else if (/notice/i.test(labelText)) {
        setVal(el, '15');
      } else if (/experience|year|count|month/i.test(labelText)) {
        setVal(el, '2');
      } else if (/city|location|address/i.test(labelText)) {
        setVal(el, 'Coimbatore');
      } else if (el.type === 'number' || (el.value && /^\d+/.test(el.value))) {
        // Any numeric field with error: sanitize to pure digits
        const digits = (el.value || '').replace(/\D/g, '') || '1';
        setVal(el, digits);
      }
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    });
  })()`);
}

async function trySubmitLinkedInModal(ws, cdpEval) {
  // Step 1: Attempt click on submit button inside modal
  const submitInfo = await cdpEval(ws, `(() => {
    const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
    if (!modal) return { found: false, reason: 'no_modal' };

    // Check if there are active validation errors blocking submission
    const hasActiveErrors = Array.from(modal.querySelectorAll('.artdeco-inline-feedback--error')).some(e => e.offsetWidth > 0);
    if (hasActiveErrors) return { found: false, reason: 'active_validation_errors' };

    const submitBtn = Array.from(modal.querySelectorAll('button')).find(b => {
      const t = b.innerText.trim().toLowerCase();
      return (t === 'submit application' || t === 'submit') && b.offsetWidth > 0;
    });

    if (!submitBtn) return { found: false, reason: 'no_submit_btn' };

    const scrollContainers = [
      modal.querySelector('.jobs-easy-apply-modal__content'),
      modal.querySelector('.artdeco-modal__content'),
      modal
    ];
    scrollContainers.forEach(sc => { if (sc) sc.scrollTop = sc.scrollHeight; });
    submitBtn.scrollIntoView({ behavior: 'instant', block: 'center' });

    // Handle any consent or acknowledge checkboxes on review step
    const reviewCheckboxes = Array.from(modal.querySelectorAll('input[type="checkbox"]')).filter(c => !c.checked && c.offsetWidth > 0);
    reviewCheckboxes.forEach(cb => {
      const lbl = (cb.closest('label')?.innerText || '').toLowerCase();
      if (/terms|acknowledge|certify|consent|agree/i.test(lbl)) {
        cb.click();
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const rect = submitBtn.getBoundingClientRect();
    submitBtn.click();
    return {
      found: true,
      clicked: true,
      x: Math.round(rect.x + rect.width / 2),
      y: Math.round(rect.y + rect.height / 2)
    };
  })()`);

  if (!submitInfo || !submitInfo.clicked) {
    return false;
  }

  // Step 2: Verify that LinkedIn accepted the submission
  // Either modal is closed, or confirmation screen is shown ("Your application was sent", etc.)
  let verified = false;
  for (let attempt = 0; attempt < 8; attempt++) {
    await new Promise(r => setTimeout(r, 600));

    const checkState = await cdpEval(ws, `(() => {
      const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
      if (!modal) return { status: 'MODAL_CLOSED' };

      const txt = (modal.innerText || '').toLowerCase();
      const isSent = txt.includes('application was sent')
        || txt.includes('application sent')
        || txt.includes('your application was submitted')
        || txt.includes('next best action')
        || txt.includes('turn your resume into a profile');

      if (isSent) return { status: 'CONFIRMATION_SHOWN' };

      const submitBtn = Array.from(modal.querySelectorAll('button')).find(b => {
        const t = b.innerText.trim().toLowerCase();
        return (t === 'submit application' || t === 'submit') && b.offsetWidth > 0;
      });

      if (submitBtn) return { status: 'SUBMIT_STILL_PRESENT' };

      return { status: 'PENDING' };
    })()`);

    if (checkState?.status === 'MODAL_CLOSED' || checkState?.status === 'CONFIRMATION_SHOWN') {
      verified = true;
      break;
    }

    if (checkState?.status === 'SUBMIT_STILL_PRESENT' && attempt >= 3) {
      // If submit button is still visible, the synthetic click may not have triggered LinkedIn's action
      break;
    }
  }

  return verified;
}

async function tryAdvanceLinkedInModal(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
    if (!modal) return false;

    const reviewBtn = Array.from(modal.querySelectorAll('button')).find(b => /review/i.test(b.innerText.trim()) && b.offsetWidth > 0);
    if (reviewBtn) { reviewBtn.click(); return 'review'; }

    const nextBtn = Array.from(modal.querySelectorAll('button')).find(b => /next|continue/i.test(b.innerText.trim()) && b.offsetWidth > 0);
    if (nextBtn) { nextBtn.click(); return 'next'; }

    return false;
  })()`);
}

async function dismissPostSubmitDialogs(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    // 1. Check for "Not now" button on the post-submit prompt
    const notNowBtn = Array.from(document.querySelectorAll('button')).find(b => /not now/i.test(b.innerText.trim()) && b.offsetWidth > 0);
    if (notNowBtn) {
      notNowBtn.click();
      return 'dismissed_not_now';
    }

    // 2. Check for standard dismissal buttons
    for (let d = 0; d < 3; d++) {
      const dismissBtn = document.querySelector('.artdeco-modal__dismiss, [data-test-modal-close-btn], button[aria-label="Dismiss"], button[aria-label="Done"]')
        || Array.from(document.querySelectorAll('button')).find(b => b.offsetWidth > 0 && /^(not now|dismiss|close|done)$/i.test(b.innerText.trim()));
      if (dismissBtn) {
        dismissBtn.click();
        const discardBtn = document.querySelector('[data-control-name="discard_application_confirm_btn"], button[data-test-dialog-primary-btn]')
          || Array.from(document.querySelectorAll('button')).find(b => /discard/i.test(b.innerText.trim()) && b.offsetWidth > 0);
        if (discardBtn) discardBtn.click();
      }
    }
  })()`);
}

async function discardIncompleteModal(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    const modal = document.querySelector('dialog, [role="dialog"], .artdeco-modal');
    if (!modal) return false;

    // Check if it's the post-submit "turn resume into profile" modal
    const notNowBtn = Array.from(document.querySelectorAll('button')).find(b => /not now/i.test(b.innerText.trim()) && b.offsetWidth > 0);
    if (notNowBtn) {
      notNowBtn.click();
      return true;
    }

    // Dismiss the open modal
    const dismissBtn = modal.querySelector('.artdeco-modal__dismiss, [data-test-modal-close-btn], button[aria-label="Dismiss"]')
      || document.querySelector('.artdeco-modal__dismiss, button[aria-label="Dismiss"]');
    if (dismissBtn) {
      dismissBtn.click();
      setTimeout(() => {
        const discardBtn = document.querySelector('[data-control-name="discard_application_confirm_btn"], button[data-test-dialog-primary-btn]')
          || Array.from(document.querySelectorAll('button')).find(b => /discard/i.test(b.innerText.trim()) && b.offsetWidth > 0);
        if (discardBtn) discardBtn.click();
      }, 350);
      return true;
    }
    return false;
  })()`);
}

module.exports = {
  getLinkedInModalStatus,
  handleProfilePrompt,
  pruneEducation,
  solveFormFields,
  trySubmitLinkedInModal,
  tryAdvanceLinkedInModal,
  dismissPostSubmitDialogs,
  discardIncompleteModal
};

