/**
 * BioTailr AI StandBy - LinkedIn Easy Apply Modal Solver
 * Solves multi-step application forms, education pruning, experience sub-forms,
 * city comboboxes, typeaheads, radios, and automated submissions.
 * Includes dynamic error auto-correction (pure numbers for numeric/salary inputs,
 * dropdown selection for Coimbatore location).
 */

async function handleRemoveConfirmationDialog(ws, cdpEval) {
  const removeInfo = await cdpEval(ws, `(() => {
    const allModals = Array.from(document.querySelectorAll('dialog, [role="dialog"], .artdeco-modal, [data-test-modal]'));
    for (const m of allModals) {
      const text = (m.innerText || '').toLowerCase();
      const isRemoveModal = text.includes('remove from your application')
        || text.includes('remove from application')
        || text.includes('this will not affect your linkedin profile')
        || (text.includes('remove') && text.includes('cancel') && !m.querySelector('.jobs-easy-apply-form-section__grouping'));

      if (isRemoveModal) {
        const buttons = Array.from(m.querySelectorAll('button, a[role="button"], [role="button"]')).filter(b => b.offsetWidth > 0 || b.offsetHeight > 0);
        const removeBtn = buttons.find(b => {
          const t = (b.innerText || b.getAttribute('aria-label') || '').trim().toLowerCase();
          return t === 'remove' || t.startsWith('remove') || b.classList.contains('artdeco-modal__confirm-dialog-btn') || b.hasAttribute('data-test-dialog-primary-btn');
        });

        if (removeBtn) {
          removeBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
          removeBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
          removeBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          removeBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
          removeBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          removeBtn.click();
          const r = removeBtn.getBoundingClientRect();
          return { found: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        }
      }
    }

    const fallbackBtn = Array.from(document.querySelectorAll('.artdeco-modal button, [role="dialog"] button, .artdeco-modal__confirm-dialog-btn')).find(b => {
      const t = (b.innerText || b.getAttribute('aria-label') || '').trim().toLowerCase();
      return t === 'remove' && (b.offsetWidth > 0 || b.offsetHeight > 0);
    });
    if (fallbackBtn) {
      fallbackBtn.click();
      const r = fallbackBtn.getBoundingClientRect();
      return { found: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    }

    return { found: false };
  })()`);

  if (removeInfo && removeInfo.found && removeInfo.x && removeInfo.y) {
    ws.send(JSON.stringify({
      id: Math.floor(Math.random() * 1000000),
      method: 'Input.dispatchMouseEvent',
      params: { type: 'mousePressed', x: removeInfo.x, y: removeInfo.y, button: 'left', clickCount: 1 }
    }));
    await new Promise(r => setTimeout(r, 40));
    ws.send(JSON.stringify({
      id: Math.floor(Math.random() * 1000000),
      method: 'Input.dispatchMouseEvent',
      params: { type: 'mouseReleased', x: removeInfo.x, y: removeInfo.y, button: 'left', clickCount: 1 }
    }));
    await new Promise(r => setTimeout(r, 300));
    return true;
  }
  return false;
}

async function getLinkedInModalStatus(ws, cdpEval) {
  await handleRemoveConfirmationDialog(ws, cdpEval);
  return await cdpEval(ws, `(() => {
    const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
    if (!modal) return { modalOpen: false };

    const modalText = (modal.innerText || '').toLowerCase();
    const actionButtons = Array.from(modal.querySelectorAll('button')).filter(b => b.offsetWidth > 0).map(b => b.innerText.trim());

    const isPostSubmit = modalText.includes('application was sent')
      || modalText.includes('application sent')
      || modalText.includes('your application was submitted')
      || modalText.includes('next best action')
      || modalText.includes('turn your resume into a profile')
      || window.location.href.includes('/post-apply/');

    return {
      modalOpen: true,
      isPostSubmit,
      title: modal.querySelector('h1, h2, h3, .jobs-easy-apply-modal__title')?.innerText?.trim(),
      buttons: actionButtons,
      isEducation: modalText.includes('education') && !modalText.includes('work experience'),
      isExperience: modalText.includes('work experience')
    };
  })()`);
}

async function handleSafetyReminder(ws, cdpEval) {
  const contInfo = await cdpEval(ws, `(() => {
    const contBtn = Array.from(document.querySelectorAll('button')).find(b => {
      const t = (b.innerText || b.getAttribute('aria-label') || '').toLowerCase().trim();
      return (t === 'continue applying' || t.includes('continue applying')) && b.offsetWidth > 0;
    });
    if (contBtn) {
      contBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
      contBtn.click();
      const r = contBtn.getBoundingClientRect();
      return { found: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    }
    return { found: false };
  })()`);

  if (contInfo && contInfo.found && contInfo.x && contInfo.y) {
    ws.send(JSON.stringify({
      id: Math.floor(Math.random() * 1000000),
      method: 'Input.dispatchMouseEvent',
      params: { type: 'mousePressed', x: contInfo.x, y: contInfo.y, button: 'left', clickCount: 1 }
    }));
    await new Promise(r => setTimeout(r, 40));
    ws.send(JSON.stringify({
      id: Math.floor(Math.random() * 1000000),
      method: 'Input.dispatchMouseEvent',
      params: { type: 'mouseReleased', x: contInfo.x, y: contInfo.y, button: 'left', clickCount: 1 }
    }));
    return true;
  }
  return false;
}

async function handleProfilePrompt(ws, cdpEval) {
  const safetyClicked = await handleSafetyReminder(ws, cdpEval);
  if (safetyClicked) return 'clicked_continue_applying';

  return await cdpEval(ws, `(() => {
    const dialogs = Array.from(document.querySelectorAll('dialog, [role="dialog"], .artdeco-modal'));
    for (const d of dialogs) {
      if (d.querySelector('.jobs-easy-apply-form-section__grouping')) continue;
      const txt = (d.innerText || '').toLowerCase();

      // Prioritize Continue Applying on Job Search Safety Reminders or Apply confirmations
      const contBtn = Array.from(d.querySelectorAll('button')).find(b => /continue applying|continue apply/i.test(b.innerText.trim()) && b.offsetWidth > 0);
      if (contBtn) { contBtn.click(); return 'clicked_continue_applying'; }

      if (txt.includes('update your profile') || txt.includes('update profile') || txt.includes('save to your profile') || txt.includes('save changes') || txt.includes('remember this') || txt.includes('next best action') || txt.includes('application sent') || txt.includes('application was sent')) {
        const notNow = Array.from(d.querySelectorAll('button')).find(b => /not now|no thanks|no|close|dismiss|done/i.test(b.innerText.trim()))
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
        const isCollege = !isSchool && (/college|university|btech|degree|bachelor|master|institute/i.test(txt));
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

async function handleDeleteExperience(ws, cdpEval) {
  let deletedAny = false;

  for (let attempt = 0; attempt < 3; attempt++) {
    const deleteBtnInfo = await cdpEval(ws, `(() => {
      const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
      if (!modal) return { found: false };

      const btns = Array.from(modal.querySelectorAll('button, a[role="button"], [role="button"]')).filter(b => {
        return (b.offsetWidth > 0 || b.offsetHeight > 0);
      });

      const delBtn = btns.find(b => {
        const txt = (b.innerText || '').trim().toLowerCase();
        const aria = (b.getAttribute('aria-label') || '').trim().toLowerCase();
        const testId = (b.getAttribute('data-test-delete-btn') || b.getAttribute('data-control-name') || '').toLowerCase();

        return txt === 'delete experience' || txt.includes('delete experience')
          || txt === 'delete work experience' || txt.includes('delete work experience')
          || txt === 'remove experience' || txt.includes('remove experience')
          || aria.includes('delete experience') || aria.includes('delete work experience')
          || aria.includes('remove experience') || aria.includes('remove work experience')
          || (txt === 'delete' && Boolean(b.closest('[class*="experience"], [id*="experience"], .jobs-easy-apply-form-section__grouping')))
          || testId.includes('delete');
      });

      if (!delBtn) return { found: false };

      delBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
      const r = delBtn.getBoundingClientRect();
      delBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      delBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      delBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
      delBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      delBtn.click();

      return {
        found: true,
        text: delBtn.innerText || delBtn.getAttribute('aria-label') || 'delete experience',
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2)
      };
    })()`);

    if (!deleteBtnInfo || !deleteBtnInfo.found) {
      break;
    }

    deletedAny = true;

    // Dispatch CDP mouse events as guarantee
    if (deleteBtnInfo.x && deleteBtnInfo.y) {
      ws.send(JSON.stringify({
        id: Math.floor(Math.random() * 1000000),
        method: 'Input.dispatchMouseEvent',
        params: { type: 'mousePressed', x: deleteBtnInfo.x, y: deleteBtnInfo.y, button: 'left', clickCount: 1 }
      }));
      await new Promise(r => setTimeout(r, 40));
      ws.send(JSON.stringify({
        id: Math.floor(Math.random() * 1000000),
        method: 'Input.dispatchMouseEvent',
        params: { type: 'mouseReleased', x: deleteBtnInfo.x, y: deleteBtnInfo.y, button: 'left', clickCount: 1 }
      }));
    }

    await new Promise(r => setTimeout(r, 350));

    // Clear the confirmation popup ("Remove from your application?")
    await handleRemoveConfirmationDialog(ws, cdpEval);
    await new Promise(r => setTimeout(r, 300));
  }

  return deletedAny;
}

async function solveFormFields(ws, cdpEval, profile) {
  const serialized = JSON.stringify(profile || {});
  return await cdpEval(ws, `(() => {
    const prof = ${serialized};
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

    // Experience sub-card handling
    const deleteExpBtn = Array.from(modal.querySelectorAll('button, a[role="button"]')).find(b => {
      const t = (b.innerText || b.getAttribute('aria-label') || '').toLowerCase().trim();
      return (t.includes('delete experience') || t === 'delete experience') && b.offsetWidth > 0;
    });

    if (deleteExpBtn) {
      deleteExpBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
      deleteExpBtn.click();
    }

    // Standard Field Solver
    const elements = Array.from(modal.querySelectorAll('input:not([type="hidden"]), textarea, select'));

    elements.forEach(el => {
      // 1. Direct label association
      let labelText = '';
      if (el.labels && el.labels.length > 0 && el.labels[0].innerText.trim()) {
        labelText = el.labels[0].innerText.toLowerCase();
      } else if (el.id) {
        const directLbl = modal.querySelector('label[for="' + (window.CSS && window.CSS.escape ? window.CSS.escape(el.id) : el.id) + '"]');
        if (directLbl && directLbl.innerText.trim()) {
          labelText = directLbl.innerText.toLowerCase();
        }
      }

      // 2. aria-labelledby
      if (!labelText && el.getAttribute('aria-labelledby')) {
        const idList = el.getAttribute('aria-labelledby').split(' ');
        const texts = idList.map(id => document.getElementById(id)?.innerText?.trim()).filter(Boolean);
        if (texts.length > 0) labelText = texts.join(' ').toLowerCase();
      }

      // 3. aria-label or placeholder
      if (!labelText) {
        labelText = (el.getAttribute('aria-label') || el.placeholder || '').toLowerCase();
      }

      // 4. Ancestor search - strictly ignoring labels belonging to OTHER inputs (lbl.htmlFor && lbl.htmlFor !== el.id)
      if (!labelText) {
        let p = el.parentElement;
        for (let i = 0; i < 4; i++) {
          if (!p || p === modal) break;
          const candidateLabels = Array.from(p.querySelectorAll('label, legend, [class*="label"]'));
          const myLabel = candidateLabels.find(lbl => {
            if (lbl.tagName === 'LABEL' && lbl.htmlFor && el.id && lbl.htmlFor !== el.id) return false;
            return Boolean(lbl.innerText && lbl.innerText.trim());
          });
          if (myLabel && myLabel.innerText.trim()) {
            labelText = myLabel.innerText.toLowerCase();
            break;
          }
          p = p.parentElement;
        }
      }

      if (!labelText) {
        labelText = (el.name || el.id || '').toLowerCase();
      }

      const isCombobox = el.getAttribute('role') === 'combobox'
        || el.classList.contains('search-basic-typeahead__input')
        || el.classList.contains('basic-typeahead__input')
        || Boolean(el.closest('[role="combobox"]'));

      const isTypeaheadLocation = el.getAttribute('data-testid') === 'typeahead-input'
        || /city|location|where/i.test(el.placeholder || '')
        || (el.getAttribute('aria-autocomplete') === 'list' && /city|location|residence|where/i.test(labelText + ' ' + (el.placeholder || '')))
        || labelText.includes('city') || labelText.includes('location') || labelText.includes('residence') || labelText.includes('where');

      const isTextarea = el.tagName === 'TEXTAREA';
      const isInput = el.tagName === 'INPUT';
      const isSelect = el.tagName === 'SELECT';

      // Detect if this field requires numeric-only input
      const isNumericField = (isInput && (el.type === 'number' || el.inputMode === 'numeric'))
        || /years?|experience|duration|months?|days?|notice|salary|ctc|compensation|fixed|variable|lpa|lakh|phone|mobile|postal|zip|pin\s*code|percentage|gpa|cgpa|scale|rate|amount|number|count|quantity/i.test(labelText);

      if (isInput && (el.type === 'text' || !el.type || el.type === 'number' || el.type === 'tel' || el.type === 'email')) {
        const isCityOrLocation = isTypeaheadLocation || isCombobox || labelText.includes('city') || labelText.includes('location') || labelText.includes('residence') || labelText.includes('where') || labelText.includes('address');

        if (isCityOrLocation) {
          const fullLocationStr = prof.personal?.fullLocation || prof.personal?.location || prof.personal?.city || '';
          const isFullLocReq = !isCombobox && (labelText.includes('location') || labelText.includes('where') || labelText.includes('address'));
          const fillVal = isFullLocReq ? fullLocationStr : (prof.personal?.city || prof.personal?.location || '');
          if (fillVal) {
            setVal(el, fillVal);
            el.dispatchEvent(new Event('focus', { bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'e' }));
            el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'e' }));
          }

          // If dropdown options are already visible, select matching city option immediately
          const visibleOpts = Array.from(document.querySelectorAll('[role="option"], .basic-typeahead__selectable-list li, .search-basic-typeahead__results li, [role="listbox"] li, div[role="option"]')).filter(o => o.offsetWidth > 0 || o.offsetHeight > 0);
          const targetCityName = (prof.personal?.city || '').toLowerCase();
          const matchOpt = visibleOpts.find(o => {
            const ot = (o.innerText || '').toLowerCase();
            return targetCityName ? ot.includes(targetCityName) : false;
          }) || visibleOpts[0];
          if (matchOpt) {
            matchOpt.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            matchOpt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            matchOpt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            matchOpt.click();
          }
        } else if (isNumericField) {
          // Strictly sanitize to digits only (e.g. "234as" -> "234")
          let val = '';
          if (labelText.includes('notice')) {
            val = String(prof.experience?.noticePeriodDays || '15');
          } else if (labelText.includes('current ctc') || labelText.includes('current salary') || labelText.includes('fixed ctc')) {
            const isLpa = /lpa|lakh/i.test(labelText) || (el.maxLength > 0 && el.maxLength <= 4);
            val = isLpa ? String(prof.experience?.currentSalaryLpa || '2') : String(prof.experience?.currentSalary || '200000');
          } else if (labelText.includes('expected ctc') || labelText.includes('expected salary')) {
            const isLpa = /lpa|lakh/i.test(labelText) || (el.maxLength > 0 && el.maxLength <= 4);
            val = isLpa ? String(prof.experience?.expectedSalaryLpa || '4.5') : String(prof.experience?.expectedSalary || '450000');
          } else if (labelText.includes('phone') || labelText.includes('mobile')) {
            val = String(prof.personal?.phone || '').replace(/\D/g, '');
          } else if (labelText.includes('postal') || labelText.includes('zip') || labelText.includes('pin')) {
            val = String(prof.personal?.postalCode || '641001');
          } else if (labelText.includes('gpa') || labelText.includes('cgpa')) {
            val = '8';
          } else if (labelText.includes('percentage') || labelText.includes('percent')) {
            val = '85';
          } else {
            val = String(prof.experience?.totalYears || '2');
          }
          const sanitizedDigits = val.replace(/\D/g, '') || '1';
          setVal(el, sanitizedDigits);
        } else {
          // Clean text input (strictly guard so location/city inputs are NEVER set with candidate name!)
          if (isCityOrLocation || isTypeaheadLocation || el.getAttribute('data-testid') === 'typeahead-input' || /city|location/i.test(el.placeholder || '')) {
            const locVal = prof.personal?.location || prof.personal?.city || '';
            if (locVal) setVal(el, locVal);
          } else if (labelText.includes('first name') || labelText.includes('given name')) {
            setVal(el, prof.personal?.firstName || 'Applicant');
          } else if (labelText.includes('last name') || labelText.includes('family name') || labelText.includes('surname')) {
            setVal(el, prof.personal?.lastName || '');
          } else if (labelText.includes('full name')) {
            setVal(el, prof.personal?.fullName || 'Applicant');
          } else if (labelText.includes('email')) {
            setVal(el, prof.personal?.email || '');
          } else if (labelText.includes('organisation') || labelText.includes('organization') || labelText.includes('company')) {
            setVal(el, prof.experience?.currentCompany || '');
          } else if (labelText.includes('designation') || labelText.includes('title') || labelText.includes('role')) {
            setVal(el, prof.experience?.currentTitle || 'Software Engineer');
          } else if (labelText.includes('linkedin')) {
            setVal(el, prof.personal?.linkedinUrl || '');
          } else if (labelText.includes('github')) {
            setVal(el, prof.personal?.githubUrl || '');
          } else if (labelText.includes('portfolio') || labelText.includes('website') || labelText.includes('other')) {
            setVal(el, prof.personal?.portfolioUrl || '');
          } else if (labelText.includes('college') || labelText.includes('university') || labelText.includes('institution') || labelText.includes('school')) {
            setVal(el, prof.education?.institution || '');
          } else if (labelText.includes('degree') || labelText.includes('qualification')) {
            setVal(el, prof.education?.degree || 'Bachelor of Engineering / Technology');
          } else if (labelText.includes('major') || labelText.includes('field of study')) {
            setVal(el, prof.education?.fieldOfStudy || 'Computer Science and Engineering');
          } else if (labelText.includes('country')) {
            setVal(el, prof.personal?.country || 'India');
          } else if (labelText.includes('state')) {
            setVal(el, prof.personal?.state || '');
          } else if (labelText.includes('skill') || labelText.includes('tools') || labelText.includes('tech stack')) {
            const skillStr = (Array.isArray(prof.skills) && prof.skills.length > 0) ? prof.skills.slice(0, 10).join(', ') : 'Software Engineering, Python, React, SQL, Git';
            setVal(el, skillStr);
          } else {
            if (!el.value || /\d{2,}[a-z]+|[a-z]+\d{2,}/i.test(el.value)) {
              setVal(el, prof.experience?.currentTitle || 'Software Engineer');
            }
          }
        }
      } else if (isTextarea) {
        const candName = prof.personal?.fullName || 'Applicant';
        const candEmail = prof.personal?.email || '';
        const candPhone = prof.personal?.phone ? String(prof.personal.phone) : '';
        const candTitle = prof.experience?.currentTitle || 'Software Engineer';
        const candYears = prof.experience?.totalYears || '2';
        const candCompany = prof.experience?.currentCompany ? `at ${prof.experience.currentCompany}` : '';
        const contactSig = [candName, candEmail, candPhone].filter(Boolean).join(' | ');

        if (/cover\s*letter|message|note\s*to|letter/i.test(labelText)) {
          setVal(el, `Dear Hiring Team,\\n\\nI am writing to express my strong enthusiasm for this position. With ${candYears} years of hands-on experience as a ${candTitle} ${candCompany}, I focus on architecting resilient, production-ready solutions that solve complex technical problems and drive measurable outcomes.\\n\\nSincerely,\\n${contactSig}`);
        } else if (/why.*(hire|work|join|fit|company|us)|interest/i.test(labelText)) {
          setVal(el, `As a ${candTitle} with ${candYears} years of experience ${candCompany}, I bring proven technical problem-solving ability, rapid learning velocity, and production expertise. I am excited to contribute to your engineering objectives.`);
        } else if (/project|achievement|accomplish|describe.*experience/i.test(labelText)) {
          setVal(el, `In my work as a ${candTitle} ${candCompany}, I have engineered scalable features, optimized database queries, and collaborated with cross-functional teams to deliver reliable software with high availability.`);
        } else if (/relocat|remote|hybrid|travel|commute/i.test(labelText)) {
          setVal(el, 'Yes, I am fully open to remote, hybrid, or on-site arrangements and comfortable with relocation.');
        } else if (/summary|about\s*(yourself|you)|bio/i.test(labelText)) {
          setVal(el, prof.summary || `${candTitle} with ${candYears} years of experience developing scalable applications and high-performance software.`);
        } else if (!el.value || /\d{2,}[a-z]+|[a-z]+\d{2,}/i.test(el.value)) {
          setVal(el, `${candTitle} with ${candYears} years of experience developing scalable solutions.`);
        }
      } else if (isSelect) {
        const opts = Array.from(el.options);
        let matchIdx = -1;
        if (/additional\s*month/i.test(labelText)) {
          matchIdx = opts.findIndex(o => o.text.includes('0'));
        } else if (/month/i.test(labelText)) {
          matchIdx = opts.findIndex(o => /january|jan|^1$/i.test(o.text.trim()));
          if (matchIdx === -1 && opts.length > 1) matchIdx = 1;
        } else if (/year/i.test(labelText)) {
          matchIdx = opts.findIndex(o => /2022|2021|2023|2024|2025|2026/i.test(o.text));
          if (matchIdx === -1 && opts.length > 1) matchIdx = 1;
        } else if (/proficiency|skill\s*level|knowledge/i.test(labelText)) {
          matchIdx = opts.findIndex(o => /expert|advanced|intermediate|proficient/i.test(o.text.trim()));
          if (matchIdx === -1 && opts.length > 1) matchIdx = 1;
        } else {
          matchIdx = opts.findIndex(o => /^(yes|agree|accept|confirm|true)$/i.test(o.text.trim()) || o.text.includes('Yes'));
        }
        if (matchIdx !== -1 && el.selectedIndex !== matchIdx) {
          el.selectedIndex = matchIdx;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else if (el.type === 'radio') {
        let parentBox = el.parentElement;
        let radioText = '';
        while (parentBox && parentBox.tagName !== 'FIELDSET' && parentBox.tagName !== 'FORM') {
          if (parentBox.innerText && parentBox.innerText.trim()) { radioText = parentBox.innerText.trim(); break; }
          parentBox = parentBox.parentElement;
        }
        const isNo = /sponsorship|require.*visa|criminal|disability|terminated/i.test(labelText + ' ' + radioText);
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

    // C. Select Typeahead Dropdown Option dynamically based on candidate's city
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
      const targetCity = (prof.personal?.city || '').toLowerCase();
      const cityOpt = openOptions.find(o => {
        const txt = (o.innerText || '').toLowerCase();
        return targetCity ? txt.includes(targetCity) : false;
      }) || openOptions[0];
      cityOpt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      cityOpt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      cityOpt.click();
    }

    // D. Validation Error Auto-Correction Pass
    // Strips invalid alphanumeric formats like "234as" to pure digits "234" for numeric fields
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

      const isNumeric = el.type === 'number' || /salary|ctc|notice|experience|year|month|day|phone|postal|zip|pin/i.test(labelText);

      if (isNumeric) {
        // Strip out any non-digits like "234as" -> "234"
        const current = el.value || '';
        let digits = current.replace(/\D/g, '');

        if (/salary|ctc/i.test(labelText)) {
          if (labelText.includes('expected')) {
            const isLpa = /lpa|lakh/i.test(labelText) || (el.maxLength > 0 && el.maxLength <= 4);
            digits = isLpa ? String(prof.experience?.expectedSalaryLpa || '4.5') : String(prof.experience?.expectedSalary || '450000');
          } else {
            const isLpa = /lpa|lakh/i.test(labelText) || (el.maxLength > 0 && el.maxLength <= 4);
            digits = isLpa ? String(prof.experience?.currentSalaryLpa || '2') : String(prof.experience?.currentSalary || '200000');
          }
        } else if (/notice/i.test(labelText)) {
          digits = String(prof.experience?.noticePeriodDays || '15');
        } else if (/experience|year/i.test(labelText)) {
          digits = String(prof.experience?.totalYears || '2');
        } else if (/phone|mobile/i.test(labelText)) {
          digits = String(prof.personal?.phone || '').replace(/\D/g, '');
        } else if (!digits) {
          digits = '1';
        }
        setVal(el, digits);
      } else {
        // Text field error: replace any invalid alphanumeric strings with valid label answers
        if (/city|location|where|residence/i.test(labelText) || el.getAttribute('data-testid') === 'typeahead-input' || /city|location/i.test(el.placeholder || '')) {
          const loc = prof.personal?.location || prof.personal?.city || '';
          if (loc) setVal(el, loc);
        } else if (el.tagName === 'TEXTAREA') {
          const candTitle = prof.experience?.currentTitle || 'Software Engineer';
          const candYears = prof.experience?.totalYears || '2';
          setVal(el, `${candTitle} with ${candYears} years of experience developing scalable solutions.`);
        } else {
          setVal(el, prof.experience?.currentTitle || 'Software Engineer');
        }
      }
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    });
  })()`);
}

async function trySubmitLinkedInModal(ws, cdpEval) {
  // Ensure "Remove from your application?" confirmation is cleared if open
  await handleRemoveConfirmationDialog(ws, cdpEval);

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

  if (submitInfo.x && submitInfo.y) {
    ws.send(JSON.stringify({
      id: Math.floor(Math.random() * 1000000),
      method: 'Input.dispatchMouseEvent',
      params: { type: 'mousePressed', x: submitInfo.x, y: submitInfo.y, button: 'left', clickCount: 1 }
    }));
    setTimeout(() => {
      ws.send(JSON.stringify({
        id: Math.floor(Math.random() * 1000000),
        method: 'Input.dispatchMouseEvent',
        params: { type: 'mouseReleased', x: submitInfo.x, y: submitInfo.y, button: 'left', clickCount: 1 }
      }));
    }, 40);
  }

  // Step 2: Verify that LinkedIn accepted the submission
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
      break;
    }
  }

  return verified;
}

async function tryAdvanceLinkedInModal(ws, cdpEval) {
  // First, check if "Remove from your application?" modal is open and clear it
  await handleRemoveConfirmationDialog(ws, cdpEval);

  const advanceInfo = await cdpEval(ws, `(() => {
    const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
    if (!modal) return { found: false };

    // If unneeded draft experience card is open or errored, click Delete experience
    const deleteExpBtn = Array.from(modal.querySelectorAll('button, a[role="button"]')).find(b => {
      const t = (b.innerText || b.getAttribute('aria-label') || '').toLowerCase().trim();
      return (t.includes('delete experience') || t === 'delete experience') && (b.offsetWidth > 0 || b.offsetHeight > 0);
    });
    if (deleteExpBtn) {
      deleteExpBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
      deleteExpBtn.click();
      const r = deleteExpBtn.getBoundingClientRect();
      return { found: true, type: 'delete_experience', x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    }

    const reviewBtn = Array.from(modal.querySelectorAll('button')).find(b => /review/i.test(b.innerText.trim()) && b.offsetWidth > 0);
    if (reviewBtn) {
      reviewBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
      reviewBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      reviewBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      reviewBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
      reviewBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      reviewBtn.click();
      const r = reviewBtn.getBoundingClientRect();
      return { found: true, type: 'review', x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    }

    const nextBtn = Array.from(modal.querySelectorAll('button')).find(b => /next|continue/i.test(b.innerText.trim()) && b.offsetWidth > 0);
    if (nextBtn) {
      nextBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
      nextBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      nextBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      nextBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
      nextBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      nextBtn.click();
      const r = nextBtn.getBoundingClientRect();
      return { found: true, type: 'next', x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    }

    return { found: false };
  })()`);

  if (advanceInfo && advanceInfo.found && advanceInfo.x && advanceInfo.y) {
    ws.send(JSON.stringify({
      id: Math.floor(Math.random() * 1000000),
      method: 'Input.dispatchMouseEvent',
      params: { type: 'mousePressed', x: advanceInfo.x, y: advanceInfo.y, button: 'left', clickCount: 1 }
    }));
    await new Promise(r => setTimeout(r, 40));
    ws.send(JSON.stringify({
      id: Math.floor(Math.random() * 1000000),
      method: 'Input.dispatchMouseEvent',
      params: { type: 'mouseReleased', x: advanceInfo.x, y: advanceInfo.y, button: 'left', clickCount: 1 }
    }));

    if (advanceInfo.type === 'delete_experience') {
      // Wait for "Remove from your application?" modal to appear and click Remove
      await new Promise(r => setTimeout(r, 400));
      await handleRemoveConfirmationDialog(ws, cdpEval);
      await new Promise(r => setTimeout(r, 250));
      await handleRemoveConfirmationDialog(ws, cdpEval);
      return 'deleted_experience';
    }

    await handleRemoveConfirmationDialog(ws, cdpEval);
    return advanceInfo.type;
  }
  return false;
}

async function dismissPostSubmitDialogs(ws, cdpEval) {
  for (let round = 0; round < 3; round++) {
    const dialogAction = await cdpEval(ws, `(() => {
      const dialogs = Array.from(document.querySelectorAll('dialog, [role="dialog"], .artdeco-modal, .artdeco-modal-overlay, div[class*="artdeco-modal"]'));

      for (const d of dialogs) {
        // Guard: Do not dismiss active Easy Apply form with inputs
        if (d.querySelector('.jobs-easy-apply-form-section__grouping, .jobs-easy-apply-modal__content form')) {
          continue;
        }

        const txt = (d.innerText || '').toLowerCase();
        const isPostSubmitPrompt = 
          txt.includes('turn your resume into a profile') ||
          txt.includes('recruiters notice') ||
          txt.includes('keep track of your application') ||
          txt.includes('application was sent') ||
          txt.includes('application sent') ||
          txt.includes('save to your profile') ||
          txt.includes('update your profile') ||
          txt.includes('update profile') ||
          txt.includes('job alert') ||
          txt.includes('rate your application') ||
          txt.includes('how was your experience') ||
          txt.includes('remember this') ||
          txt.includes('next best action') ||
          txt.includes('feedback');

        if (isPostSubmitPrompt) {
          // Priority 1: Top-Right "X" Close Button (Image 2)
          const closeBtn = d.querySelector('button[aria-label="Dismiss"], button[aria-label="Close"], button[aria-label*="dismiss" i], button[aria-label*="close" i], .artdeco-modal__dismiss, [data-test-modal-close-btn]')
            || Array.from(d.querySelectorAll('button')).find(b => {
              const aria = (b.getAttribute('aria-label') || '').toLowerCase();
              return aria === 'dismiss' || aria === 'close' || b.querySelector('svg#cancel-small, svg[id*="cancel"], svg[id*="close"]');
            });

          if (closeBtn && closeBtn.offsetWidth > 0) {
            closeBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
            const r = closeBtn.getBoundingClientRect();
            closeBtn.click();
            return {
              found: true,
              type: 'close_x_button',
              x: Math.round(r.left + r.width / 2),
              y: Math.round(r.top + r.height / 2)
            };
          }

          // Priority 2: "Not now" button
          const notNowBtn = Array.from(d.querySelectorAll('button')).find(b => {
            const t = b.innerText.trim().toLowerCase();
            return (t === 'not now' || t === 'no thanks' || t === 'done' || t === 'dismiss' || t === 'close' || t === 'no') && b.offsetWidth > 0;
          });

          if (notNowBtn) {
            notNowBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
            const r = notNowBtn.getBoundingClientRect();
            notNowBtn.click();
            return {
              found: true,
              type: 'not_now_button',
              x: Math.round(r.left + r.width / 2),
              y: Math.round(r.top + r.height / 2)
            };
          }
        }
      }

      // 2. Any overlay dialog close button outside active form
      const anyCloseX = document.querySelector('.artdeco-modal:not(:has(.jobs-easy-apply-form-section__grouping)) button[aria-label="Dismiss"], .artdeco-modal:not(:has(.jobs-easy-apply-form-section__grouping)) button[aria-label="Close"], .artdeco-modal:not(:has(.jobs-easy-apply-form-section__grouping)) .artdeco-modal__dismiss, button[data-test-modal-close-btn]');
      if (anyCloseX && anyCloseX.offsetWidth > 0) {
        anyCloseX.scrollIntoView({ behavior: 'instant', block: 'center' });
        const r = anyCloseX.getBoundingClientRect();
        anyCloseX.click();
        return {
          found: true,
          type: 'generic_close_x',
          x: Math.round(r.left + r.width / 2),
          y: Math.round(r.top + r.height / 2)
        };
      }

      // 3. Any "Not now" button outside active form
      const anyNotNow = Array.from(document.querySelectorAll('button')).find(b => {
        if (b.closest('.jobs-easy-apply-form-section__grouping')) return false;
        const t = b.innerText.trim().toLowerCase();
        return (t === 'not now' || t === 'no thanks') && b.offsetWidth > 0;
      });
      if (anyNotNow) {
        const r = anyNotNow.getBoundingClientRect();
        anyNotNow.click();
        return {
          found: true,
          type: 'generic_not_now',
          x: Math.round(r.left + r.width / 2),
          y: Math.round(r.top + r.height / 2)
        };
      }

      return { found: false };
    })()`);

    if (dialogAction && dialogAction.found && dialogAction.x && dialogAction.y) {
      ws.send(JSON.stringify({
        id: Math.floor(Math.random() * 1000000),
        method: 'Input.dispatchMouseEvent',
        params: { type: 'mousePressed', x: dialogAction.x, y: dialogAction.y, button: 'left', clickCount: 1 }
      }));
      await new Promise(r => setTimeout(r, 40));
      ws.send(JSON.stringify({
        id: Math.floor(Math.random() * 1000000),
        method: 'Input.dispatchMouseEvent',
        params: { type: 'mouseReleased', x: dialogAction.x, y: dialogAction.y, button: 'left', clickCount: 1 }
      }));
      await new Promise(r => setTimeout(r, 400));
    } else {
      break;
    }
  }
}

async function discardIncompleteModal(ws, cdpEval) {
  // First dismiss any post-submit prompt if present
  await dismissPostSubmitDialogs(ws, cdpEval);

  const dismissTarget = await cdpEval(ws, `(() => {
    const modal = document.querySelector('dialog, [role="dialog"], .artdeco-modal');
    if (!modal) return { found: false };

    const dismissBtn = modal.querySelector('.artdeco-modal__dismiss, [data-test-modal-close-btn], button[aria-label="Dismiss"], button[aria-label="Close"]')
      || document.querySelector('.artdeco-modal__dismiss, button[aria-label="Dismiss"]');
    if (dismissBtn && dismissBtn.offsetWidth > 0) {
      const r = dismissBtn.getBoundingClientRect();
      dismissBtn.click();
      return { found: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    }
    return { found: false };
  })()`);

  if (dismissTarget && dismissTarget.found && dismissTarget.x && dismissTarget.y) {
    ws.send(JSON.stringify({
      id: Math.floor(Math.random() * 1000000),
      method: 'Input.dispatchMouseEvent',
      params: { type: 'mousePressed', x: dismissTarget.x, y: dismissTarget.y, button: 'left', clickCount: 1 }
    }));
    await new Promise(r => setTimeout(r, 40));
    ws.send(JSON.stringify({
      id: Math.floor(Math.random() * 1000000),
      method: 'Input.dispatchMouseEvent',
      params: { type: 'mouseReleased', x: dismissTarget.x, y: dismissTarget.y, button: 'left', clickCount: 1 }
    }));
    await new Promise(r => setTimeout(r, 400));

    // Confirm Discard application
    const discardTarget = await cdpEval(ws, `(() => {
      const discardBtn = document.querySelector('[data-control-name="discard_application_confirm_btn"], button[data-test-dialog-primary-btn]')
        || Array.from(document.querySelectorAll('button')).find(b => /discard/i.test(b.innerText.trim()) && b.offsetWidth > 0);
      if (discardBtn) {
        const r = discardBtn.getBoundingClientRect();
        discardBtn.click();
        return { found: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      }
      return { found: false };
    })()`);

    if (discardTarget && discardTarget.found && discardTarget.x && discardTarget.y) {
      ws.send(JSON.stringify({
        id: Math.floor(Math.random() * 1000000),
        method: 'Input.dispatchMouseEvent',
        params: { type: 'mousePressed', x: discardTarget.x, y: discardTarget.y, button: 'left', clickCount: 1 }
      }));
      await new Promise(r => setTimeout(r, 40));
      ws.send(JSON.stringify({
        id: Math.floor(Math.random() * 1000000),
        method: 'Input.dispatchMouseEvent',
        params: { type: 'mouseReleased', x: discardTarget.x, y: discardTarget.y, button: 'left', clickCount: 1 }
      }));
      await new Promise(r => setTimeout(r, 300));
    }
    return true;
  }
  return false;
}

async function solveLocationTypeahead(ws, cdpEval, targetCity = '') {
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const cityQuery = targetCity ? targetCity.replace(/[^a-zA-Z0-9\s]/g, '').trim() : '';

  // Step 1: Check if the typeahead dropdown options are ALREADY visible on the page
  const openSelected = await cdpEval(ws, `(() => {
    const cityStr = ${JSON.stringify(cityQuery.toLowerCase())};
    const optionSelectors = [
      '[role="listbox"] [role="option"]',
      '[role="listbox"] li',
      '[role="listbox"] div',
      'div[role="option"]',
      'li[role="option"]',
      '.basic-typeahead__selectable-list li',
      '.search-basic-typeahead__results li',
      '.search-basic-typeahead__result',
      'ul[id*="typeahead"] li',
      'div[id*="typeahead"] li',
      '[class*="typeahead"] [role="option"]',
      '[class*="typeahead"] li',
      '[class*="typeahead"] div',
      '.artdeco-typeahead__results li'
    ];

    const options = Array.from(document.querySelectorAll(optionSelectors.join(', '))).filter(o => {
      return (o.offsetWidth > 0 || o.offsetHeight > 0) && (o.innerText || '').trim().length > 0;
    });

    if (options.length === 0) return { selected: false };

    const target = options.find(o => cityStr ? (o.innerText || '').toLowerCase().includes(cityStr) : false)
      || options[0];

    if (target) {
      target.scrollIntoView({ behavior: 'instant', block: 'nearest' });
      target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      target.click();
      return { selected: true, text: target.innerText.trim() };
    }
    return { selected: false };
  })()`);

  if (openSelected && openSelected.selected) {
    // Commit selection via Enter key
    ws.send(JSON.stringify({
      id: Math.floor(Math.random() * 1000000),
      method: 'Input.dispatchKeyEvent',
      params: { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }
    }));
    await delay(50);
    ws.send(JSON.stringify({
      id: Math.floor(Math.random() * 1000000),
      method: 'Input.dispatchKeyEvent',
      params: { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }
    }));
    await delay(200);
    return true;
  }

  // Step 2: Locate the location/city typeahead input
  const locInput = await cdpEval(ws, `(() => {
    const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal') || document.body;
    const ti = modal.querySelector('input[data-testid="typeahead-input"]')
      || modal.querySelector('input[role="combobox"]')
      || modal.querySelector('input[placeholder*="city" i], input[placeholder*="location" i]')
      || Array.from(modal.querySelectorAll('input[type="text"], input:not([type])')).find(i => {
           const label = (i.closest('div, label, .fb-dash-form-element')?.innerText || '').toLowerCase();
           return label.includes('city') || label.includes('location') || label.includes('where');
         });

    if (!ti) return { found: false };

    const r = ti.getBoundingClientRect();
    ti.focus();
    ti.select();
    return {
      found: true,
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top + r.height / 2),
      currentVal: (ti.value || '').trim()
    };
  })()`);

  if (!locInput || !locInput.found) {
    return false;
  }

  // Step 3: Clear any existing text using Ctrl+A + Backspace
  ws.send(JSON.stringify({
    id: Math.floor(Math.random() * 1000000),
    method: 'Input.dispatchKeyEvent',
    params: { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2 }
  }));
  await delay(50);
  ws.send(JSON.stringify({
    id: Math.floor(Math.random() * 1000000),
    method: 'Input.dispatchKeyEvent',
    params: { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2 }
  }));
  await delay(50);
  ws.send(JSON.stringify({
    id: Math.floor(Math.random() * 1000000),
    method: 'Input.dispatchKeyEvent',
    params: { type: 'rawKeyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 }
  }));
  await delay(50);
  ws.send(JSON.stringify({
    id: Math.floor(Math.random() * 1000000),
    method: 'Input.dispatchKeyEvent',
    params: { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 }
  }));
  await delay(100);

  // Step 4: Type target city via CDP Input.insertText to trigger live dropdown search
  if (cityQuery) {
    ws.send(JSON.stringify({
      id: Math.floor(Math.random() * 1000000),
      method: 'Input.insertText',
      params: { text: cityQuery }
    }));
  }

  // Wait 700ms for LinkedIn search results dropdown to populate
  await delay(700);

  // Step 5: Click the matching option from the dropdown list
  const selected = await cdpEval(ws, `(() => {
    const cityStr = ${JSON.stringify(cityQuery.toLowerCase())};
    const optionSelectors = [
      '[role="listbox"] [role="option"]',
      '[role="listbox"] li',
      '[role="listbox"] div',
      'div[role="option"]',
      'li[role="option"]',
      '.basic-typeahead__selectable-list li',
      '.search-basic-typeahead__results li',
      '.search-basic-typeahead__result',
      'ul[id*="typeahead"] li',
      'div[id*="typeahead"] li',
      '[class*="typeahead"] [role="option"]',
      '[class*="typeahead"] li',
      '[class*="typeahead"] div',
      '.artdeco-typeahead__results li'
    ];

    const options = Array.from(document.querySelectorAll(optionSelectors.join(', '))).filter(o => {
      return (o.offsetWidth > 0 || o.offsetHeight > 0) && (o.innerText || '').trim().length > 0;
    });

    if (options.length === 0) return { selected: false };

    const targetOpt = options.find(o => cityStr ? (o.innerText || '').toLowerCase().includes(cityStr) : false)
      || options[0];

    if (targetOpt) {
      targetOpt.scrollIntoView({ behavior: 'instant', block: 'nearest' });
      targetOpt.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      targetOpt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      targetOpt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      targetOpt.click();
      return { selected: true, text: targetOpt.innerText.trim() };
    }
    return { selected: false };
  })()`);

  // Step 6: Also send ArrowDown + Enter key combination to guarantee selection
  ws.send(JSON.stringify({
    id: Math.floor(Math.random() * 1000000),
    method: 'Input.dispatchKeyEvent',
    params: { type: 'rawKeyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 }
  }));
  await delay(60);
  ws.send(JSON.stringify({
    id: Math.floor(Math.random() * 1000000),
    method: 'Input.dispatchKeyEvent',
    params: { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 }
  }));
  await delay(100);

  ws.send(JSON.stringify({
    id: Math.floor(Math.random() * 1000000),
    method: 'Input.dispatchKeyEvent',
    params: { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }
  }));
  await delay(60);
  ws.send(JSON.stringify({
    id: Math.floor(Math.random() * 1000000),
    method: 'Input.dispatchKeyEvent',
    params: { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }
  }));
  await delay(150);

  // Tab key to commit and move focus out
  ws.send(JSON.stringify({
    id: Math.floor(Math.random() * 1000000),
    method: 'Input.dispatchKeyEvent',
    params: { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }
  }));
  await delay(50);
  ws.send(JSON.stringify({
    id: Math.floor(Math.random() * 1000000),
    method: 'Input.dispatchKeyEvent',
    params: { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }
  }));
  await delay(200);

  return Boolean(selected?.selected || openSelected?.selected);
}

module.exports = {
  getLinkedInModalStatus,
  handleRemoveConfirmationDialog,
  handleProfilePrompt,
  handleSafetyReminder,
  handleDeleteExperience,
  pruneEducation,
  solveFormFields,
  solveLocationTypeahead,
  trySubmitLinkedInModal,
  tryAdvanceLinkedInModal,
  dismissPostSubmitDialogs,
  discardIncompleteModal
};

