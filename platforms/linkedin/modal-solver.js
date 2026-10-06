/**
 * BioTailr AI StandBy - LinkedIn Easy Apply Modal Solver
 * Solves multi-step application forms, education pruning, experience sub-forms,
 * city comboboxes, typeaheads, radios, and automated submissions.
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
}

async function trySubmitLinkedInModal(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
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
}

async function tryAdvanceLinkedInModal(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
    if (!modal) return false;

    const reviewBtn = Array.from(modal.querySelectorAll('button')).find(b => /review/i.test(b.innerText.trim()));
    if (reviewBtn) { reviewBtn.click(); return 'review'; }

    const nextBtn = Array.from(modal.querySelectorAll('button')).find(b => /next|continue/i.test(b.innerText.trim()));
    if (nextBtn) { nextBtn.click(); return 'next'; }

    return false;
  })()`);
}

async function dismissPostSubmitDialogs(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    for (let d = 0; d < 3; d++) {
      const dismissBtn = document.querySelector('.artdeco-modal__dismiss, [data-test-modal-close-btn], button[aria-label="Dismiss"], button[aria-label="Done"]')
        || Array.from(document.querySelectorAll('button')).find(b => b.offsetWidth > 0 && /^(not now|dismiss|close|done)$/i.test(b.innerText.trim()));
      if (dismissBtn) dismissBtn.click();
    }
  })()`);
}

module.exports = {
  getLinkedInModalStatus,
  handleProfilePrompt,
  pruneEducation,
  solveFormFields,
  trySubmitLinkedInModal,
  tryAdvanceLinkedInModal,
  dismissPostSubmitDialogs
};
