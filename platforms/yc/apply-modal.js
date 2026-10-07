/**
 * BioTailr AI StandBy - YC Apply Modal Solver
 * Handles the "Reach out to [recruiter] at [company]" popup modal:
 *  - Fills the personalized message textarea
 *  - Checks the location/relocation checkbox if present
 *  - Clicks "Send"
 *  - Detects success / error states
 */

/**
 * Check if the YC apply modal is currently open.
 * Returns { open: bool, recruiterName, companyName, hasLocationCheckbox }
 */
async function getYCModalStatus(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    // Check for "Reach out to X at Y" modal
    const modal = document.querySelector('.apply-modal, [class*="apply-modal"], .modal-container, [class*="modal-container"]')
      || Array.from(document.querySelectorAll('div')).find(d => {
          const txt = (d.innerText || '').toLowerCase();
          return txt.includes('reach out to') && txt.includes('start a conversation') && d.offsetWidth > 0;
        });

    if (!modal) return { open: false };

    const heading = modal.querySelector('h1, h2, h3, [class*="heading"], [class*="title"]');
    const headingText = heading ? heading.innerText.trim() : '';

    // Parse "Reach out to [Name] at [Company]"
    const match = headingText.match(/reach out to (.+?) at (.+)/i);
    const recruiterName = match ? match[1].trim() : '';
    const companyName = match ? match[2].trim() : '';

    const textarea = modal.querySelector('textarea');
    const sendBtn = Array.from(modal.querySelectorAll('button')).find(b =>
      /send/i.test(b.innerText.trim()) && b.offsetWidth > 0
    );
    const closeBtn = Array.from(modal.querySelectorAll('button')).find(b =>
      /close|cancel|dismiss/i.test(b.innerText.trim()) && b.offsetWidth > 0
    );

    const locationCheckbox = modal.querySelector('input[type="checkbox"]');
    const hasLocationCheckbox = Boolean(locationCheckbox);
    const locationChecked = locationCheckbox ? locationCheckbox.checked : false;

    const errorMsg = modal.querySelector('[class*="error"], .error-text, [style*="color: red"]');
    const successMsg = modal.querySelector('[class*="success"], [class*="sent"], [class*="thank"]');

    return {
      open: true,
      headingText,
      recruiterName,
      companyName,
      hasTextarea: Boolean(textarea),
      textareaValue: textarea ? textarea.value : '',
      hasSendBtn: Boolean(sendBtn),
      hasCloseBtn: Boolean(closeBtn),
      hasLocationCheckbox,
      locationChecked,
      errorText: errorMsg ? errorMsg.innerText.trim() : '',
      successText: successMsg ? successMsg.innerText.trim() : '',
      isSent: Boolean(successMsg) || headingText.toLowerCase().includes('sent') || headingText.toLowerCase().includes('thank')
    };
  })()`);
}

/**
 * Fill the message textarea with the generated personalized message.
 * Uses native input setter to trigger React state updates.
 */
async function fillYCMessageTextarea(ws, cdpEval, message) {
  const result = await cdpEval(ws, `(() => {
    const modal = document.querySelector('.apply-modal, [class*="apply-modal"], .modal-container, [class*="modal-container"]')
      || Array.from(document.querySelectorAll('div')).find(d => {
          const txt = (d.innerText || '').toLowerCase();
          return txt.includes('reach out to') && txt.includes('start a conversation') && d.offsetWidth > 0;
        });

    if (!modal) return { filled: false, reason: 'no_modal' };

    const textarea = modal.querySelector('textarea');
    if (!textarea) return { filled: false, reason: 'no_textarea' };

    // Use React's native setter to properly trigger state update
    const nativeProto = window.HTMLTextAreaElement?.prototype;
    const setter = Object.getOwnPropertyDescriptor(nativeProto || {}, 'value')?.set
      || Object.getOwnPropertyDescriptor(textarea.__proto__ || {}, 'value')?.set;

    const msg = ${JSON.stringify(message)};

    if (setter) {
      setter.call(textarea, msg);
    } else {
      textarea.value = msg;
    }

    textarea.dispatchEvent(new Event('focus', { bubbles: true }));
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    const r = textarea.getBoundingClientRect();
    return {
      filled: true,
      length: textarea.value.length,
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top + r.height / 2)
    };
  })()`);

  return result;
}

/**
 * Check and tick the location/relocation checkbox if present and unchecked.
 */
async function handleLocationCheckbox(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    const modal = document.querySelector('.apply-modal, [class*="apply-modal"], .modal-container, [class*="modal-container"]')
      || Array.from(document.querySelectorAll('div')).find(d => {
          const txt = (d.innerText || '').toLowerCase();
          return txt.includes('reach out to') && txt.includes('start a conversation') && d.offsetWidth > 0;
        });

    if (!modal) return { handled: false };

    const checkbox = modal.querySelector('input[type="checkbox"]');
    if (!checkbox) return { handled: false, reason: 'no_checkbox' };

    if (!checkbox.checked) {
      checkbox.click();
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    }

    return { handled: true, checked: checkbox.checked };
  })()`);
}

/**
 * Click the Send button in the YC apply modal.
 * Returns { clicked, x, y } for CDP mouse dispatch.
 */
async function clickYCSendButton(ws, cdpEval) {
  const result = await cdpEval(ws, `(() => {
    const modal = document.querySelector('.apply-modal, [class*="apply-modal"], .modal-container, [class*="modal-container"]')
      || Array.from(document.querySelectorAll('div')).find(d => {
          const txt = (d.innerText || '').toLowerCase();
          return txt.includes('reach out to') && txt.includes('start a conversation') && d.offsetWidth > 0;
        });

    if (!modal) return { clicked: false, reason: 'no_modal' };

    const sendBtn = Array.from(modal.querySelectorAll('button')).find(b =>
      /send/i.test(b.innerText.trim()) && b.offsetWidth > 0
    );
    if (!sendBtn) return { clicked: false, reason: 'no_send_btn' };

    sendBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
    const r = sendBtn.getBoundingClientRect();

    sendBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    sendBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    sendBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
    sendBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    sendBtn.click();

    return {
      clicked: true,
      btnText: sendBtn.innerText.trim(),
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top + r.height / 2)
    };
  })()`);

  if (result && result.clicked && result.x && result.y) {
    ws.send(JSON.stringify({
      id: Math.floor(Math.random() * 1000000),
      method: 'Input.dispatchMouseEvent',
      params: { type: 'mousePressed', x: result.x, y: result.y, button: 'left', clickCount: 1 }
    }));
    await new Promise(r => setTimeout(r, 50));
    ws.send(JSON.stringify({
      id: Math.floor(Math.random() * 1000000),
      method: 'Input.dispatchMouseEvent',
      params: { type: 'mouseReleased', x: result.x, y: result.y, button: 'left', clickCount: 1 }
    }));
  }

  return result;
}

/**
 * Dismiss the modal after sending (click Close if still open).
 */
async function dismissYCModal(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    const modal = document.querySelector('.apply-modal, [class*="apply-modal"], .modal-container, [class*="modal-container"]')
      || Array.from(document.querySelectorAll('div')).find(d => {
          const txt = (d.innerText || '').toLowerCase();
          return (txt.includes('reach out to') || txt.includes('sent') || txt.includes('application submitted')) && d.offsetWidth > 0;
        });

    if (!modal) return { dismissed: false, reason: 'no_modal' };

    const closeBtn = Array.from(modal.querySelectorAll('button')).find(b => {
      const t = b.innerText.trim().toLowerCase();
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      return t === 'close' || t === 'done' || t === 'cancel' || aria === 'close' || aria === 'dismiss';
    }) || modal.querySelector('[aria-label="Close"], [aria-label="Dismiss"], .close-btn, [class*="close"]');

    if (closeBtn && closeBtn.offsetWidth > 0) {
      closeBtn.click();
      return { dismissed: true };
    }

    // Try pressing Escape key via event
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    return { dismissed: true, method: 'escape' };
  })()`);
}

/**
 * Full apply flow: fill message → check location → click Send → verify
 * Returns 'submitted' | 'failed' | 'modal_not_open'
 */
async function solveYCApplyModal(ws, cdpEval, message) {
  const status = await getYCModalStatus(ws, cdpEval);
  if (!status || !status.open) return 'modal_not_open';

  // Fill the textarea with personalized message
  const filled = await fillYCMessageTextarea(ws, cdpEval, message);
  if (!filled || !filled.filled) return 'fill_failed';

  await new Promise(r => setTimeout(r, 300));

  // Tick location checkbox if present (means open to relocation)
  await handleLocationCheckbox(ws, cdpEval);
  await new Promise(r => setTimeout(r, 200));

  // Verify text was accepted (must be ≥50 chars)
  const statusAfterFill = await getYCModalStatus(ws, cdpEval);
  if (statusAfterFill && statusAfterFill.textareaValue.length < 50) {
    // Re-try fill
    await fillYCMessageTextarea(ws, cdpEval, message);
    await new Promise(r => setTimeout(r, 300));
  }

  // Click Send
  const sendResult = await clickYCSendButton(ws, cdpEval);
  if (!sendResult || !sendResult.clicked) return 'send_failed';

  // Wait and verify success
  await new Promise(r => setTimeout(r, 1200));

  const postStatus = await getYCModalStatus(ws, cdpEval);
  if (!postStatus || !postStatus.open || postStatus.isSent) {
    return 'submitted';
  }

  // Check for error message
  if (postStatus.errorText && postStatus.errorText.length > 0) {
    // If "write at least 50 characters" error, re-fill and retry
    if (postStatus.errorText.toLowerCase().includes('50') || postStatus.errorText.toLowerCase().includes('character')) {
      await fillYCMessageTextarea(ws, cdpEval, message + ' I am excited to connect and share more about my background and how I can contribute to your team.');
      await new Promise(r => setTimeout(r, 300));
      const retryResult = await clickYCSendButton(ws, cdpEval);
      await new Promise(r => setTimeout(r, 1200));
      const retryStatus = await getYCModalStatus(ws, cdpEval);
      if (!retryStatus || !retryStatus.open || retryStatus.isSent) return 'submitted';
    }
    return 'error: ' + postStatus.errorText;
  }

  return 'submitted';
}

module.exports = {
  getYCModalStatus,
  fillYCMessageTextarea,
  handleLocationCheckbox,
  clickYCSendButton,
  dismissYCModal,
  solveYCApplyModal
};
