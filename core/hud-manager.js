/**
 * BioTailr AI StandBy - HUD Manager
 * Injects and manages the live on-screen StandBy HUD directly inside Google Chrome via CDP.
 * Harmonized with Chrome Extension screen-hud.js (100% unified IDs and styles).
 * Features:
 * - Single-instance enforcement (removes duplicate or competing HUDs)
 * - Pure DOM Nodes (100% immune to LinkedIn CSP / Trusted Types innerHTML sanitization)
 * - Collapsed: Floating Pill ("BioTailr AI Agent") with pulsating emerald status dot
 * - Expanded: Panel ("BioTailr Autonomous Agent") positioned smoothly above pill
 * - Proper Hide and Drop: Clicking pill opens/drops panel; clicking [x] hides panel
 * - Direct Start on Click: Clicking "AUTO-APPLY NOW" or clicking the Ready pill triggers auto-apply
 * - Normal 1px uniform border all around (#e2e8f0) with NO colored top-border highlight
 * - Bottom-anchored 60fps dragging with lazy glass overlay (no mousedown interference)
 */

const { cdpEval } = require('./cdp-client');

async function ensureHudInjected(ws) {
  await cdpEval(ws, `(() => {
    // 1. Initialize State
    window.__bioTailrState = window.__bioTailrState || {
      isStarted: false,
      isPaused: false,
      logCount: 2
    };

    // 2. Remove any conflicting or stale StandBy HUDs so only ONE HUD is ever on screen
    const staleHuds = document.querySelectorAll('#biotailr-standby-hud');
    staleHuds.forEach(el => el.remove());

    // 3. Helper to trigger Auto-Apply across both DOM and Window state
    const triggerStart = (host) => {
      window.__bioTailrState = window.__bioTailrState || {};
      window.__bioTailrState.isStarted = true;
      window.__bioTailrState.isPaused = false;
      if (host) {
        host.setAttribute('data-bt-started', 'true');
        host.setAttribute('data-bt-paused', 'false');
      }
      document.body.setAttribute('data-bt-started', 'true');
      document.body.setAttribute('data-bt-paused', 'false');
      document.dispatchEvent(new CustomEvent('biotailr:start', { detail: { time: Date.now() } }));

      if (typeof window.__bioTailrAppendLog === 'function') {
        window.__bioTailrAppendLog('START', 'Auto-Apply started by user from StandBy HUD.');
      }
      if (typeof window.__bioTailrSyncUI === 'function') {
        window.__bioTailrSyncUI();
      }
    };

    // 4. Check if unified HUD already exists on the page
    let host = document.getElementById('biotailr-agent-hud');

    if (host) {
      // Connect to existing HUD and ensure click listeners are active
      const autoBtn = host.querySelector('#bt-btn-auto-apply, #bt-main-start-btn');
      if (autoBtn) {
        autoBtn.onclick = (e) => {
          e.stopPropagation();
          triggerStart(host);
        };
      }
      const pill = host.querySelector('#bt-hud-pill, .bt-hud-pill');
      if (pill) {
        pill.onclick = (e) => {
          e.stopPropagation();
          const panel = host.querySelector('#bt-hud-panel, .bt-hud-panel');
          if (panel && !panel.classList.contains('open')) {
            panel.classList.add('open');
          } else if (!window.__bioTailrState || !window.__bioTailrState.isStarted) {
            triggerStart(host);
          }
        };
      }
      return;
    }

    // 5. Create Fresh Unified HUD using Pure DOM Nodes
    host = document.createElement('div');
    host.id = 'biotailr-agent-hud';
    host.style.position = 'fixed';
    host.style.bottom = '24px';
    host.style.right = '24px';
    host.style.zIndex = '9999999';
    host.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    host.style.userSelect = 'none';
    host.style.color = '#0f172a';
    host.style.pointerEvents = 'auto';

    const style = document.createElement('style');
    style.textContent = \`
      #biotailr-agent-hud * {
        box-sizing: border-box;
      }
      .bt-hud-pill {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 8px 14px;
        color: #0f172a;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);
        cursor: pointer !important;
        pointer-events: auto !important;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        user-select: none;
      }
      .bt-hud-pill:hover {
        border-color: #059669 !important;
        color: #059669 !important;
        box-shadow: 0 6px 16px rgba(5, 150, 105, 0.2) !important;
        transform: translateY(-1px);
      }
      .bt-hud-pill:active {
        transform: translateY(0);
        box-shadow: 0 2px 6px rgba(5, 150, 105, 0.15) !important;
      }
      .bt-pulse-dot {
        width: 8px;
        height: 8px;
        background: #059669;
        border-radius: 50%;
        box-shadow: 0 0 0 2px #d1fae5;
        flex-shrink: 0;
        transition: all 0.2s ease;
      }
      .bt-pulse-dot.working {
        background: #2563eb;
        box-shadow: 0 0 0 2px #dbeafe;
        animation: bt-pulse 1.4s infinite;
      }
      @keyframes bt-pulse {
        0% { transform: scale(0.9); opacity: 0.8; }
        50% { transform: scale(1.15); opacity: 1; }
        100% { transform: scale(0.9); opacity: 0.8; }
      }
      .bt-hud-panel {
        display: none;
        flex-direction: column;
        width: 360px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        box-shadow: 0 12px 32px -4px rgba(15, 23, 42, 0.12), 0 4px 12px rgba(15, 23, 42, 0.06);
        overflow: hidden;
        margin-bottom: 10px;
        cursor: default;
        pointer-events: auto !important;
      }
      .bt-hud-panel.open {
        display: flex !important;
      }
      .bt-hud-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        border-radius: 6px 6px 0 0;
        cursor: grab !important;
        user-select: none;
      }
      .bt-hud-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 700;
        color: #0f172a;
        letter-spacing: -0.2px;
      }
      .bt-hud-badge {
        font-size: 10px;
        font-weight: 700;
        padding: 3px 6px;
        background: #f1f5f9;
        color: #475569;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .bt-hud-badge.active {
        background: #ecfdf5;
        color: #047857;
      }
      .bt-hud-close {
        background: transparent;
        border: none;
        color: #64748b;
        cursor: pointer !important;
        pointer-events: auto !important;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 16px;
        line-height: 1;
        transition: all 0.15s ease;
      }
      .bt-hud-close:hover {
        color: #0f172a !important;
        background: #e2e8f0;
      }
      .bt-hud-body {
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .bt-hud-info {
        background: #f8fafc;
        padding: 10px 12px;
        border-radius: 6px;
        border: 1px solid #e2e8f0;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .bt-hud-job-title {
        font-size: 13px;
        font-weight: 600;
        color: #0f172a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .bt-hud-model {
        font-size: 11px;
        color: #059669;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .bt-hud-feed {
        height: 120px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 8px 10px;
        overflow-y: auto;
        font-family: "JetBrains Mono", Consolas, monospace;
        font-size: 11px;
        color: #334155;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .bt-btn-primary {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        background: #059669;
        border: 1px solid #047857;
        color: #ffffff;
        font-size: 12px;
        font-weight: 600;
        padding: 9px 14px;
        border-radius: 6px;
        cursor: pointer !important;
        pointer-events: auto !important;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        transition: all 0.15s ease;
      }
      .bt-btn-primary:hover {
        background: #047857 !important;
        box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3) !important;
      }
      .bt-btn-primary:active {
        transform: translateY(1px);
      }
      .bt-btn-secondary {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        color: #0f172a;
        font-size: 12px;
        font-weight: 600;
        padding: 9px 12px;
        border-radius: 6px;
        cursor: pointer !important;
        pointer-events: auto !important;
        transition: all 0.15s ease;
      }
      .bt-btn-secondary:hover {
        background: #f8fafc !important;
        border-color: #94a3b8 !important;
      }
      .bt-btn-dl {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        width: 100%;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        color: #0f172a;
        font-size: 11px;
        font-weight: 600;
        padding: 7px 10px;
        border-radius: 6px;
        cursor: pointer !important;
        pointer-events: auto !important;
        transition: all 0.15s ease;
      }
      .bt-btn-dl:hover {
        background: #f8fafc !important;
      }
    \`;
    host.appendChild(style);

    const makeSvg = (w, h, vb, inner) => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', String(w));
      svg.setAttribute('height', String(h));
      svg.setAttribute('viewBox', vb);
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.innerHTML = inner;
      return svg;
    };

    // Panel
    const panel = document.createElement('div');
    panel.className = 'bt-hud-panel open';
    panel.id = 'bt-hud-panel';

    const header = document.createElement('div');
    header.className = 'bt-hud-header';
    header.id = 'bt-panel-header';

    const titleBox = document.createElement('div');
    titleBox.className = 'bt-hud-title';
    const panelDot = document.createElement('span');
    panelDot.className = 'bt-pulse-dot';
    panelDot.id = 'bt-panel-dot';
    const titleText = document.createElement('span');
    titleText.textContent = 'BioTailr Autonomous Agent';
    titleBox.appendChild(panelDot);
    titleBox.appendChild(titleText);

    const rightBox = document.createElement('div');
    rightBox.style.display = 'flex';
    rightBox.style.alignItems = 'center';
    rightBox.style.gap = '8px';

    const badge = document.createElement('span');
    badge.className = 'bt-hud-badge';
    badge.id = 'bt-hud-badge';
    badge.textContent = 'STANDBY';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'bt-hud-close';
    closeBtn.id = 'bt-hud-close-btn';
    closeBtn.setAttribute('aria-label', 'Close panel');
    closeBtn.textContent = '×';

    rightBox.appendChild(badge);
    rightBox.appendChild(closeBtn);
    header.appendChild(titleBox);
    header.appendChild(rightBox);

    // Body
    const body = document.createElement('div');
    body.className = 'bt-hud-body';

    const info = document.createElement('div');
    info.className = 'bt-hud-info';
    const jobTitle = document.createElement('div');
    jobTitle.className = 'bt-hud-job-title';
    jobTitle.id = 'bt-hud-job-title';
    jobTitle.textContent = 'LinkedIn Job Search Feed';

    const model = document.createElement('div');
    model.className = 'bt-hud-model';
    const sparkleSvg = makeSvg(12, 12, '0 0 24 24', '<path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14"/>');
    const compText = document.createElement('span');
    compText.id = 'bt-hud-model-text';
    compText.textContent = 'Google Gemini Engine (Project Key)';
    model.appendChild(sparkleSvg);
    model.appendChild(compText);

    info.appendChild(jobTitle);
    info.appendChild(model);

    const feed = document.createElement('div');
    feed.className = 'bt-hud-feed';
    feed.id = 'bt-hud-feed';

    const line1 = document.createElement('div');
    line1.innerHTML = '<span style="color:#94a3b8;">[INIT]</span> Screen Agent initialized on LinkedIn.';
    const line2 = document.createElement('div');
    line2.innerHTML = '<span style="color:#94a3b8;">[READY]</span> Autonomous perception engine ready.';
    feed.appendChild(line1);
    feed.appendChild(line2);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';

    const autoBtn = document.createElement('button');
    autoBtn.className = 'bt-btn-primary';
    autoBtn.id = 'bt-btn-auto-apply';
    const playSvg = makeSvg(12, 12, '0 0 24 24', '<polygon points="6 4 20 12 6 20 6 4"/>');
    playSvg.setAttribute('fill', 'currentColor');
    playSvg.setAttribute('stroke', 'none');
    const btnText = document.createElement('span');
    btnText.id = 'bt-btn-text';
    btnText.textContent = 'AUTO-APPLY NOW';
    autoBtn.appendChild(playSvg);
    autoBtn.appendChild(btnText);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'bt-btn-secondary';
    nextBtn.id = 'bt-btn-next-job';
    nextBtn.setAttribute('title', 'Skip to next job');
    const nextText = document.createElement('span');
    nextText.textContent = 'Next Job';
    const nextSvg = makeSvg(12, 12, '0 0 24 24', '<path d="M5 12h14M12 5l7 7-7 7"/>');
    nextBtn.appendChild(nextText);
    nextBtn.appendChild(nextSvg);

    actions.appendChild(autoBtn);
    actions.appendChild(nextBtn);

    const dlBtn = document.createElement('button');
    dlBtn.className = 'bt-btn-dl';
    dlBtn.id = 'bt-btn-download-runner';
    const dlSvg = makeSvg(12, 12, '0 0 24 24', '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>');
    const dlText = document.createElement('span');
    dlText.textContent = 'Download Desktop Runner (ZIP)';
    dlBtn.appendChild(dlSvg);
    dlBtn.appendChild(dlText);

    body.appendChild(info);
    body.appendChild(feed);
    body.appendChild(actions);
    body.appendChild(dlBtn);

    panel.appendChild(header);
    panel.appendChild(body);

    // Pill
    const pill = document.createElement('div');
    pill.className = 'bt-hud-pill';
    pill.id = 'bt-hud-pill';
    pill.setAttribute('role', 'button');
    pill.setAttribute('tabindex', '0');
    const pillDot = document.createElement('span');
    pillDot.className = 'bt-pulse-dot';
    pillDot.id = 'bt-pill-dot';
    const pillText = document.createElement('span');
    pillText.id = 'bt-pill-text';
    pillText.textContent = 'BioTailr AI Agent';
    pill.appendChild(pillDot);
    pill.appendChild(pillText);

    host.appendChild(panel);
    host.appendChild(pill);
    document.body.appendChild(host);

    // Toggle Hide / Drop
    let didDrag = false;

    const togglePanel = (open) => {
      if (open === undefined) {
        panel.classList.toggle('open');
      } else if (open) {
        panel.classList.add('open');
      } else {
        panel.classList.remove('open');
      }
    };

    closeBtn.onclick = (e) => {
      e.stopPropagation();
      togglePanel(false);
    };

    pill.onclick = (e) => {
      if (didDrag) {
        didDrag = false;
        return;
      }
      e.preventDefault();
      e.stopPropagation();

      const isOpen = panel.classList.contains('open');
      if (!isOpen) {
        togglePanel(true);
      } else {
        if (!window.__bioTailrState.isStarted) {
          triggerStart(host);
        } else {
          togglePanel(false);
        }
      }
    };

    // Smooth Dragging: header (when open) or pill (when collapsed)
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialLeft = 0;
    let initialBottom = 0;
    let dragOverlay = null;

    const startDrag = (e) => {
      if (e.target.closest('button, input, textarea, select, a, .bt-hud-close, .bt-hud-feed')) return;
      if (e.button !== 0) return;

      didDrag = false;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;

      const rect = host.getBoundingClientRect();
      initialLeft = rect.left;
      initialBottom = window.innerHeight - rect.bottom;

      const onMouseMove = (moveEv) => {
        if (!isDragging) return;
        const dx = moveEv.clientX - dragStartX;
        const dy = moveEv.clientY - dragStartY;

        if (!didDrag && Math.hypot(dx, dy) > 8) {
          didDrag = true;
          if (!dragOverlay) {
            dragOverlay = document.createElement('div');
            dragOverlay.id = 'bt-standby-drag-overlay';
            dragOverlay.style.position = 'fixed';
            dragOverlay.style.top = '0';
            dragOverlay.style.left = '0';
            dragOverlay.style.width = '100vw';
            dragOverlay.style.height = '100vh';
            dragOverlay.style.zIndex = '99999999';
            dragOverlay.style.cursor = 'grabbing';
            dragOverlay.style.userSelect = 'none';
            dragOverlay.style.background = 'transparent';
            document.body.appendChild(dragOverlay);
          }
          host.style.transition = 'none';
        }

        if (!didDrag) return;

        let newLeft = initialLeft + dx;
        let newBottom = initialBottom - dy;

        const minLeft = 8;
        const maxLeft = Math.max(8, window.innerWidth - host.offsetWidth - 8);
        const minBottom = 8;
        const maxBottom = Math.max(8, window.innerHeight - host.offsetHeight - 8);

        newLeft = Math.max(minLeft, Math.min(maxLeft, newLeft));
        newBottom = Math.max(minBottom, Math.min(maxBottom, newBottom));

        host.style.left = newLeft + 'px';
        host.style.bottom = newBottom + 'px';
        host.style.right = 'auto';
        host.style.top = 'auto';
      };

      const onMouseUp = () => {
        isDragging = false;
        if (dragOverlay && dragOverlay.parentNode) {
          dragOverlay.parentNode.removeChild(dragOverlay);
          dragOverlay = null;
        }
        window.removeEventListener('mousemove', onMouseMove, { capture: true });
        window.removeEventListener('mouseup', onMouseUp, { capture: true });
      };

      window.addEventListener('mousemove', onMouseMove, { capture: true, passive: false });
      window.addEventListener('mouseup', onMouseUp, { capture: true });
    };

    header.addEventListener('mousedown', startDrag);
    pill.addEventListener('mousedown', startDrag);

    // State UI Synchronization
    function syncStateUI() {
      if (!window.__bioTailrState.isStarted) {
        badge.innerText = 'STANDBY';
        badge.style.background = '#f1f5f9';
        badge.style.color = '#475569';
        btnText.innerText = 'AUTO-APPLY NOW';
        autoBtn.style.background = '#059669';
      } else if (window.__bioTailrState.isPaused) {
        badge.innerText = 'PAUSED';
        badge.style.background = '#fef3c7';
        badge.style.color = '#92400e';
        btnText.innerText = 'RESUME AUTO APPLY';
        autoBtn.style.background = '#f59e0b';
      } else {
        badge.innerText = 'RUNNING';
        badge.style.background = '#ecfdf5';
        badge.style.color = '#047857';
        btnText.innerText = 'PAUSE AUTO APPLY';
        autoBtn.style.background = '#374151';
      }
    }
    window.__bioTailrSyncUI = syncStateUI;

    autoBtn.onclick = (e) => {
      e.stopPropagation();
      if (!window.__bioTailrState.isStarted) {
        triggerStart(host);
      } else {
        window.__bioTailrState.isPaused = !window.__bioTailrState.isPaused;
        const isPaused = window.__bioTailrState.isPaused;
        host.setAttribute('data-bt-paused', String(isPaused));
        document.body.setAttribute('data-bt-paused', String(isPaused));
        window.__bioTailrAppendLog(isPaused ? 'PAUSE' : 'RESUME', isPaused ? 'Execution paused by user.' : 'Execution resumed.');
      }
      syncStateUI();
    };

    // Global Hooks
    window.__bioTailrUpdateHud = (data) => {
      const job = host.querySelector('#bt-hud-job-title');
      const comp = host.querySelector('#bt-hud-model-text');
      const statusBadge = host.querySelector('#bt-hud-badge');

      if (job && data.jobTitle) job.innerText = data.jobTitle;
      if (comp && data.company) comp.innerText = data.company;

      if (data.status === 'COMPLETE') {
        window.__bioTailrState.isStarted = false;
        host.removeAttribute('data-bt-started');
        document.body.removeAttribute('data-bt-started');
        if (statusBadge) {
          statusBadge.innerText = 'DONE';
          statusBadge.style.background = '#f1f5f9';
          statusBadge.style.color = '#374151';
        }
        btnText.innerText = 'SESSION COMPLETE';
        autoBtn.disabled = true;
        autoBtn.style.background = '#6b7280';
      }
    };

    window.__bioTailrAppendLog = (tag, message) => {
      const logFeed = host.querySelector('#bt-hud-feed');
      if (!logFeed) return;

      const row = document.createElement('div');
      row.style.lineHeight = '1.4';
      row.style.wordBreak = 'break-word';

      row.innerHTML = '<span style="color:#94a3b8; font-weight:600;">[' + tag + ']</span> ' + message;
      logFeed.appendChild(row);
      logFeed.scrollTop = logFeed.scrollHeight;
    };
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

async function appendHudLog(ws, tag, message) {
  const safeTag = JSON.stringify(tag);
  const safeMsg = JSON.stringify(message);
  await cdpEval(ws, `(() => {
    if (typeof window.__bioTailrAppendLog === 'function') {
      window.__bioTailrAppendLog(${safeTag}, ${safeMsg});
    }
  })()`);
}

async function isHudStarted(ws) {
  return await cdpEval(ws, `(() => {
    const host = document.getElementById('biotailr-agent-hud') || document.getElementById('biotailr-standby-hud');
    const attrStarted = host?.getAttribute('data-bt-started') === 'true' || document.body.getAttribute('data-bt-started') === 'true';
    const propStarted = Boolean(window.__bioTailrState?.isStarted);
    return attrStarted || propStarted;
  })()`);
}

async function isHudPaused(ws) {
  return await cdpEval(ws, `(() => {
    const host = document.getElementById('biotailr-agent-hud') || document.getElementById('biotailr-standby-hud');
    const attrPaused = host?.getAttribute('data-bt-paused') === 'true' || document.body.getAttribute('data-bt-paused') === 'true';
    const propPaused = Boolean(window.__bioTailrState?.isPaused);
    return attrPaused || propPaused;
  })()`);
}

async function resetHudToStandby(ws) {
  await cdpEval(ws, `(() => {
    window.__bioTailrState = {
      isStarted: false,
      isPaused: false,
      logCount: 0
    };
    const host = document.getElementById('biotailr-agent-hud') || document.getElementById('biotailr-standby-hud');
    if (host) {
      host.removeAttribute('data-bt-started');
      host.removeAttribute('data-bt-paused');
      const badge = host.querySelector('#bt-hud-badge');
      const btn = host.querySelector('#bt-btn-auto-apply, #bt-main-start-btn');
      const btnText = host.querySelector('#bt-btn-text');
      const pillText = host.querySelector('#bt-pill-text');
      if (badge) {
        badge.innerText = 'STANDBY';
        badge.className = 'bt-hud-badge';
        badge.style.background = '#f1f5f9';
        badge.style.color = '#475569';
      }
      if (btn) {
        btn.style.background = '#059669';
        btn.disabled = false;
      }
      if (btnText) btnText.innerText = 'AUTO-APPLY NOW';
      if (pillText) pillText.innerText = 'BioTailr AI Agent';
    }
    document.body.removeAttribute('data-bt-started');
    document.body.removeAttribute('data-bt-paused');
    if (typeof window.__bioTailrSyncUI === 'function') {
      window.__bioTailrSyncUI();
    }
  })()`);
}

module.exports = {
  ensureHudInjected,
  resetHudToStandby,
  updateHud,
  appendHudLog,
  isHudStarted,
  isHudPaused
};
