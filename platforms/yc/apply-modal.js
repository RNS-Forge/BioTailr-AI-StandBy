/**
 * BioTailr AI StandBy - YC Apply Modal Solver
 *
 * Handles the "Reach out to X at Y" popup modal on workatastartup.com/jobs/NNNN:
 *  1. Detect modal open state & extract recruiter/company
 *  2. Click textarea input box area to focus it
 *  3. Paste/insert generated message (satisfies 50-char minimum & React onChange)
 *  4. Check location acknowledgement checkbox if present
 *  5. Click the Send button (CDP mouse events + click)
 *  6. Verify application sent & close modal if needed
 */

/**
 * Check if the YC apply modal is open on the current page.
 */
async function getYCModalStatus(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    // 1. Check for textarea in document
    const textarea = document.querySelector('textarea');
    
    // Check if there is an open modal/dialog or popup container
    const modalContainers = Array.from(document.querySelectorAll('div[role="dialog"], div.fixed, div[class*="fixed"], div[class*="modal"], div.bg-white.rounded-lg, div.bg-white.shadow'));
    const modal = modalContainers.find(d => {
      if (d.offsetWidth <= 0 || d.offsetHeight <= 0) return false;
      const txt = (d.innerText || '').toLowerCase();
      return (txt.includes('reach out to') || txt.includes('start a conversation') || (txt.includes('send') && txt.includes('close'))) && d.querySelector('textarea');
    }) || (textarea ? textarea.closest('div.fixed, div[role="dialog"], div.bg-white') || textarea.parentElement?.parentElement?.parentElement : null);

    if (!textarea && !modal) {
      return { open: false };
    }

    const container = modal || document.body;
    const allText = container.innerText || '';

    // Heading text: "Reach out to {Name} at {Company}"
    const headEl = container.querySelector('h1, h2, h3, [class*="heading"], [class*="title"]') ||
                   Array.from(container.querySelectorAll('div')).find(d => (d.innerText || '').includes('Reach out to'));
    const headingText = headEl ? headEl.innerText.trim() : '';
    const match = headingText.match(/reach out to (.+?) at (.+)/i);

    // Send button: orange button with text "Send"
    const sendBtn = Array.from(container.querySelectorAll('button, input[type="submit"], a')).find(b => {
      const txt = (b.innerText || '').trim().toLowerCase();
      return txt === 'send' && b.offsetWidth > 0;
    });

    // Close button
    const closeBtn = Array.from(container.querySelectorAll('button, a')).find(b => {
      const txt = (b.innerText || '').trim().toLowerCase();
      return (txt === 'close' || txt === 'cancel' || txt === '×') && b.offsetWidth > 0;
    });

    // Location / acknowledgement checkbox
    const checkbox = container.querySelector('input[type="checkbox"]');

    // Error text (e.g. "Please write at least 50 characters")
    const errorEl = Array.from(container.querySelectorAll('p, span, div')).find(el => {
      const txt = (el.innerText || '').toLowerCase();
      return (txt.includes('at least') && txt.includes('character')) || txt.includes('required') || txt.includes('error');
    });

    // Success detection
    const isSent = /thank you for applying|application sent|conversation started|your message was sent/i.test(allText);

    // Textarea coordinates for clicking
    let taX = 0, taY = 0;
    if (textarea) {
      textarea.scrollIntoView({ behavior: 'instant', block: 'center' });
      const r = textarea.getBoundingClientRect();
      taX = Math.round(r.left + r.width / 2);
      taY = Math.round(r.top + r.height / 2);
    }

    // Send button coordinates
    let sendX = 0, sendY = 0;
    if (sendBtn) {
      const r = sendBtn.getBoundingClientRect();
      sendX = Math.round(r.left + r.width / 2);
      sendY = Math.round(r.top + r.height / 2);
    }

    return {
      open: Boolean(textarea || modal),
      headingText,
      recruiterName: match ? match[1].trim() : '',
      companyName: match ? match[2].trim() : '',
      hasTextarea: Boolean(textarea),
      textareaValue: textarea ? textarea.value : '',
      textareaX: taX,
      textareaY: taY,
      hasSendBtn: Boolean(sendBtn),
      sendX,
      sendY,
      hasCloseBtn: Boolean(closeBtn),
      hasLocationCheckbox: Boolean(checkbox),
      locationChecked: checkbox ? checkbox.checked : false,
      errorText: errorEl ? errorEl.innerText.trim() : '',
      isSent
    };
  })()`);
}

/**
 * Click inside the textarea input box area and paste/insert the generated text.
 */
async function fillYCMessageTextarea(ws, cdpEval, message) {
  const delay = ms => new Promise(r => setTimeout(r, ms));

  // 1. Get textarea location
  const status = await getYCModalStatus(ws, cdpEval);
  if (!status || !status.open || !status.hasTextarea) {
    return { filled: false, reason: 'no_textarea' };
  }

  const { textareaX, textareaY } = status;

  // 2. Click inside the input box area (CDP mouse events)
  if (textareaX && textareaY) {
    ws.send(JSON.stringify({
      id: Math.floor(Math.random() * 1e6),
      method: 'Input.dispatchMouseEvent',
      params: { type: 'mousePressed', x: textareaX, y: textareaY, button: 'left', clickCount: 1 }
    }));
    await delay(60);
    ws.send(JSON.stringify({
      id: Math.floor(Math.random() * 1e6),
      method: 'Input.dispatchMouseEvent',
      params: { type: 'mouseReleased', x: textareaX, y: textareaY, button: 'left', clickCount: 1 }
    }));
    await delay(150);
  }

  // 3. Focus and select all to clear any placeholder
  await cdpEval(ws, `(() => {
    const ta = document.querySelector('textarea');
    if (ta) {
      ta.focus();
      ta.select();
    }
  })()`);
  await delay(100);

  // 4. Select all (Ctrl+A) and Backspace via CDP key events
  ws.send(JSON.stringify({
    id: Math.floor(Math.random() * 1e6),
    method: 'Input.dispatchKeyEvent',
    params: { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2 }
  }));
  await delay(50);
  ws.send(JSON.stringify({
    id: Math.floor(Math.random() * 1e6),
    method: 'Input.dispatchKeyEvent',
    params: { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2 }
  }));
  await delay(50);
  ws.send(JSON.stringify({
    id: Math.floor(Math.random() * 1e6),
    method: 'Input.dispatchKeyEvent',
    params: { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 }
  }));
  await delay(50);
  ws.send(JSON.stringify({
    id: Math.floor(Math.random() * 1e6),
    method: 'Input.dispatchKeyEvent',
    params: { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 }
  }));
  await delay(100);

  // 5. Type / insert text via CDP Input.insertText (triggers React state updates)
  ws.send(JSON.stringify({
    id: Math.floor(Math.random() * 1e6),
    method: 'Input.insertText',
    params: { text: message }
  }));
  await delay(400);

  // 6. Native value setter backup to ensure React state is 100% synchronized
  await cdpEval(ws, `(() => {
    const ta = document.querySelector('textarea');
    if (ta && ta.value.length < 50) {
      const proto = window.HTMLTextAreaElement.prototype;
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (nativeSetter) {
        nativeSetter.call(ta, ${JSON.stringify(message)});
      } else {
        ta.value = ${JSON.stringify(message)};
      }
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
    }
  })()`);
  await delay(200);

  // 7. Verify final text value and length
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
 * Click the Send button inside the modal using CDP mouse events + native click.
 */
async function clickYCSendButton(ws, cdpEval) {
  const delay = ms => new Promise(r => setTimeout(r, ms));

  // Find Send button coordinates
  const sendInfo = await cdpEval(ws, `(() => {
    const btn = Array.from(document.querySelectorAll('button, input[type="submit"]')).find(b => {
      const txt = (b.innerText || '').trim().toLowerCase();
      return txt === 'send' && b.offsetWidth > 0;
    });
    if (!btn) return { found: false };

    btn.scrollIntoView({ behavior: 'instant', block: 'center' });
    const r = btn.getBoundingClientRect();
    return {
      found: true,
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top + r.height / 2),
      className: btn.className,
      disabled: btn.disabled
    };
  })()`);

  if (!sendInfo || !sendInfo.found) {
    return { clicked: false, reason: 'send_button_not_found' };
  }

  if (sendInfo.disabled) {
    return { clicked: false, reason: 'send_button_disabled' };
  }

  // 1. CDP mouse click on Send button
  if (sendInfo.x && sendInfo.y) {
    ws.send(JSON.stringify({
      id: Math.floor(Math.random() * 1e6),
      method: 'Input.dispatchMouseEvent',
      params: { type: 'mousePressed', x: sendInfo.x, y: sendInfo.y, button: 'left', clickCount: 1 }
    }));
    await delay(80);
    ws.send(JSON.stringify({
      id: Math.floor(Math.random() * 1e6),
      method: 'Input.dispatchMouseEvent',
      params: { type: 'mouseReleased', x: sendInfo.x, y: sendInfo.y, button: 'left', clickCount: 1 }
    }));
  }

  await delay(100);

  // 2. Also dispatch DOM click event as guarantee
  await cdpEval(ws, `(() => {
    const btn = Array.from(document.querySelectorAll('button, input[type="submit"]')).find(b => {
      return (b.innerText || '').trim().toLowerCase() === 'send' && b.offsetWidth > 0;
    });
    if (btn) btn.click();
  })()`);

  return { clicked: true, x: sendInfo.x, y: sendInfo.y };
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
