/**
 * BioTailr AI StandBy - YC Apply Modal Solver
 *
 * Handles the "Reach out to X at Y" popup modal on workatastartup.com/jobs/NNNN:
 *  1. Detect modal open state & extract recruiter/company
 *  2. Focus textarea and paste/insert generated message
 *  3. Check location acknowledgement checkbox if present
 *  4. Click the Send button
 *  5. Verify application sent
 */

/**
 * Check if the YC apply modal is open on the current page.
 */
async function getYCModalStatus(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    const textarea = document.querySelector('textarea');
    const sendBtn = Array.from(document.querySelectorAll('button, input[type="submit"]')).find(b => {
      const txt = (b.innerText || '').trim().toLowerCase();
      return txt === 'send' && b.offsetWidth > 0;
    });

    if (!textarea && !sendBtn) {
      return { open: false };
    }

    // Modal container
    const container = textarea?.closest('div[role="dialog"], div.fixed, div[class*="fixed"], div[class*="modal"], div.bg-white') || document.body;
    const allText = container.innerText || '';

    // Heading text: "Reach out to {Name} at {Company}"
    const headEl = container.querySelector('h1, h2, h3, [class*="heading"], [class*="title"]') ||
                   Array.from(container.querySelectorAll('div')).find(d => (d.innerText || '').includes('Reach out to'));
    const headingText = headEl ? headEl.innerText.trim() : '';
    const match = headingText.match(/reach out to (.+?) at (.+)/i);

    // Close button
    const closeBtn = Array.from(container.querySelectorAll('button, a')).find(b => {
      const txt = (b.innerText || '').trim().toLowerCase();
      return (txt === 'close' || txt === 'cancel' || txt === '×') && b.offsetWidth > 0;
    });

    // Location checkbox
    const checkbox = container.querySelector('input[type="checkbox"]');

    // Error text (e.g. "Please write at least 50 characters")
    const errorEl = Array.from(container.querySelectorAll('p, span, div')).find(el => {
      const txt = (el.innerText || '').toLowerCase();
      return (txt.includes('at least') && txt.includes('character')) || txt.includes('required') || txt.includes('error');
    });

    // Success detection
    const isSent = /thank you for applying|application sent|conversation started|your message was sent/i.test(allText);

    return {
      open: Boolean(textarea || sendBtn),
      headingText,
      recruiterName: match ? match[1].trim() : '',
      companyName: match ? match[2].trim() : '',
      hasTextarea: Boolean(textarea),
      textareaValue: textarea ? textarea.value : '',
      hasSendBtn: Boolean(sendBtn),
      hasCloseBtn: Boolean(closeBtn),
      hasLocationCheckbox: Boolean(checkbox),
      locationChecked: checkbox ? checkbox.checked : false,
      errorText: errorEl ? errorEl.innerText.trim() : '',
      isSent
    };
  })()`);
}

/**
 * Click inside the textarea and paste/insert the generated text.
 * Uses native property setter + input/change events + CDP insertText to guarantee React sync.
 */
async function fillYCMessageTextarea(ws, cdpEval, message) {
  const delay = ms => new Promise(r => setTimeout(r, ms));

  // Set value via native prototype setter and dispatch React events
  const setRes = await cdpEval(ws, `(() => {
    const ta = document.querySelector('textarea');
    if (!ta) return { found: false };
    ta.focus();
    ta.select();

    const proto = window.HTMLTextAreaElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(ta, ${JSON.stringify(message)});
    } else {
      ta.value = ${JSON.stringify(message)};
    }
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));
    return { found: true, length: ta.value.length };
  })()`);

  if (!setRes || !setRes.found) {
    return { filled: false, reason: 'no_textarea' };
  }

  // Send a tiny key event via CDP to trigger dirty-checking if needed
  ws.send(JSON.stringify({
    id: Math.floor(Math.random() * 1e6),
    method: 'Input.insertText',
    params: { text: ' ' }
  }));
  await delay(300);

  // Verify text is present and meets 50-char minimum
  const verify = await cdpEval(ws, `(() => {
    const ta = document.querySelector('textarea');
    return {
      length: ta ? ta.value.length : 0,
      value: ta ? ta.value : ''
    };
  })()`);

  const ok = Boolean(verify && verify.length >= 50);
  return { filled: ok, length: verify?.length || 0, value: verify?.value || '' };
}

/**
 * Handle any checkbox inside the modal (e.g. location acknowledgement).
 */
async function handleLocationCheckbox(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    let checkedCount = 0;
    checkboxes.forEach(cb => {
      if (!cb.checked && cb.offsetWidth > 0) {
        cb.click();
        cb.dispatchEvent(new Event('change', { bubbles: true }));
        checkedCount++;
      }
    });
    return { handled: true, checkedCount };
  })()`);
}

/**
 * Click the Send button inside the modal.
 */
async function clickYCSendButton(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    const sendBtn = Array.from(document.querySelectorAll('button, input[type="submit"]')).find(b => {
      return (b.innerText || '').trim().toLowerCase() === 'send' && b.offsetWidth > 0;
    });

    if (!sendBtn) return { clicked: false, reason: 'send_button_not_found' };

    sendBtn.focus();
    sendBtn.click();
    return { clicked: true, text: sendBtn.innerText };
  })()`);
}

/**
 * Dismiss the modal if needed (click Close or press Escape).
 */
async function dismissYCModal(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    const closeBtn = Array.from(document.querySelectorAll('button')).find(b => {
      const txt = (b.innerText || '').trim().toLowerCase();
      return (txt === 'close' || txt === 'cancel' || txt === '×') && b.offsetWidth > 0;
    });
    if (closeBtn) {
      closeBtn.click();
      return { dismissed: true, method: 'close_button' };
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    return { dismissed: true, method: 'escape' };
  })()`);
}

module.exports = {
  getYCModalStatus,
  fillYCMessageTextarea,
  handleLocationCheckbox,
  clickYCSendButton,
  dismissYCModal
};
