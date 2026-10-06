/**
 * BioTailr AI StandBy - HUD Manager
 * Injects and manages the live on-screen StandBy HUD directly inside Google Chrome via CDP.
 * Built with pure DOM Nodes to guarantee 100% CSP and Trusted Types compliance on LinkedIn.
 * Features:
 * - Collapsed: Floating Pill ("BioTailr AI Agent") with pulsating emerald status dot
 * - Expanded: Panel ("BioTailr Autonomous Agent") positioned smoothly above pill
 * - Proper Hide and Drop: Clicking pill opens/drops panel; clicking [x] or pill hides panel
 * - Normal 1px uniform border all around (#e2e8f0) with NO colored top-border highlight
 * - Bottom-anchored 60fps dragging all over the screen with glass overlay
 */

const { cdpEval } = require('./cdp-client');

async function ensureHudInjected(ws) {
  await cdpEval(ws, `(() => {
    // Remove any existing HUD instances to avoid duplicates
    const extHud = document.getElementById('biotailr-agent-hud');
    if (extHud) extHud.remove();

    const existing = document.getElementById('biotailr-standby-hud');
    const savedLeft = (existing && existing.style.left && existing.style.left !== 'auto') ? existing.style.left : '';
    const savedBottom = (existing && existing.style.bottom && existing.style.bottom !== 'auto') ? existing.style.bottom : '24px';
    const wasClosed = existing ? !existing.querySelector('.bt-hud-panel')?.classList.contains('open') : false;

    if (existing) {
      existing.remove();
    }

    const host = document.createElement('div');
    host.id = 'biotailr-standby-hud';
    host.style.position = 'fixed';
    host.style.bottom = savedBottom;
    if (savedLeft) {
      host.style.left = savedLeft;
      host.style.right = 'auto';
    } else {
      host.style.right = '24px';
      host.style.left = 'auto';
    }
    host.style.zIndex = '9999999';
    host.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    host.style.userSelect = 'none';
    host.style.color = '#0f172a';

    // 1. Inject Stylesheet via Pure DOM Node
    const style = document.createElement('style');
    style.textContent = \`
      #biotailr-standby-hud * {
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
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .bt-hud-pill:hover {
        border-color: #059669;
        color: #059669;
        box-shadow: 0 6px 16px rgba(5, 150, 105, 0.15);
        transform: translateY(-1px);
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
        cursor: grab;
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
      .bt-hud-close {
        background: transparent;
        border: none;
        color: #64748b;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 16px;
        line-height: 1;
      }
      .bt-hud-close:hover {
        color: #0f172a;
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
        font-size: 12px;
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
        gap: 6px;
      }
      .bt-hud-feed {
        height: 120px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 8px 10px;
        overflow-y: auto;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 11px;
        color: #334155;
        display: flex;
        flex-direction: column;
        gap: 4px;
        line-height: 1.4;
        word-break: break-all;
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
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        transition: all 0.15s ease;
      }
      .bt-btn-primary:hover {
        background: #047857;
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
        cursor: pointer;
        transition: all 0.15s ease;
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
        cursor: pointer;
        transition: all 0.15s ease;
      }
    \`;
    host.appendChild(style);

    // Helper: SVG Builder
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

    // 2. Build Panel (Expanded State)
    const panel = document.createElement('div');
    panel.className = 'bt-hud-panel' + (wasClosed ? '' : ' open');
    panel.id = 'bt-hud-panel';

    // Header
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
    badge.id = 'bt-status-pill';
    badge.textContent = 'STANDBY';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'bt-hud-close';
    closeBtn.id = 'bt-close-btn';
    closeBtn.setAttribute('aria-label', 'Close panel');
    closeBtn.textContent = '×';

    rightBox.appendChild(badge);
    rightBox.appendChild(closeBtn);

    header.appendChild(titleBox);
    header.appendChild(rightBox);

    // Body
    const body = document.createElement('div');
    body.className = 'bt-hud-body';

    // Target Box
    const info = document.createElement('div');
    info.className = 'bt-hud-info';
    const jobTitle = document.createElement('div');
    jobTitle.className = 'bt-hud-job-title';
    jobTitle.id = 'bt-target-job';
    jobTitle.textContent = 'LinkedIn Job Search Feed';

    const model = document.createElement('div');
    model.className = 'bt-hud-model';
    const sparkleSvg = makeSvg(12, 12, '0 0 24 24', '<path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14"/>');
    const compText = document.createElement('span');
    compText.id = 'bt-target-company';
    compText.textContent = 'Google Gemini Engine (Project Key)';
    model.appendChild(sparkleSvg);
    model.appendChild(compText);

    info.appendChild(jobTitle);
    info.appendChild(model);

    // Feed Box
    const feed = document.createElement('div');
    feed.className = 'bt-hud-feed';
    feed.id = 'bt-log-stream';

    const line1 = document.createElement('div');
    line1.innerHTML = '<span style="color:#94a3b8;">[INIT]</span> Screen Agent initialized on LinkedIn.';
    const line2 = document.createElement('div');
    line2.innerHTML = '<span style="color:#94a3b8;">[READY]</span> Autonomous perception engine ready.';
    feed.appendChild(line1);
    feed.appendChild(line2);

    // Actions
    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';

    const mainBtn = document.createElement('button');
    mainBtn.className = 'bt-btn-primary';
    mainBtn.id = 'bt-main-start-btn';
    const playSvg = makeSvg(12, 12, '0 0 24 24', '<polygon points="6 4 20 12 6 20 6 4"/>');
    playSvg.setAttribute('fill', 'currentColor');
    playSvg.setAttribute('stroke', 'none');
    const btnText = document.createElement('span');
    btnText.id = 'bt-main-start-text';
    btnText.textContent = 'AUTO-APPLY NOW';
    mainBtn.appendChild(playSvg);
    mainBtn.appendChild(btnText);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'bt-btn-secondary';
    nextBtn.id = 'bt-next-btn';
    nextBtn.setAttribute('title', 'Skip to next job');
    const nextText = document.createElement('span');
    nextText.textContent = 'Next Job';
    const nextSvg = makeSvg(12, 12, '0 0 24 24', '<path d="M5 12h14M12 5l7 7-7 7"/>');
    nextBtn.appendChild(nextText);
    nextBtn.appendChild(nextSvg);

    actions.appendChild(mainBtn);
    actions.appendChild(nextBtn);

    // Download Button
    const dlBtn = document.createElement('button');
    dlBtn.className = 'bt-btn-dl';
    dlBtn.id = 'bt-dl-btn';
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

    // 3. Build Pill (Collapsed State)
    const pill = document.createElement('div');
    pill.className = 'bt-hud-pill';
    pill.id = 'bt-hud-pill';
    const pillDot = document.createElement('span');
    pillDot.className = 'bt-pulse-dot';
    pillDot.id = 'bt-pill-dot';
    const pillText = document.createElement('span');
    pillText.textContent = 'BioTailr AI Agent';
    pill.appendChild(pillDot);
    pill.appendChild(pillText);

    host.appendChild(panel);
    host.appendChild(pill);
    document.body.appendChild(host);

    window.__bioTailrState = window.__bioTailrState || {
      isStarted: false,
      isPaused: false,
      logCount: 2
    };

    // 4. Hide and Drop Feature Controller
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
      e.preventDefault();
      togglePanel(false);
    };

    pill.onclick = (e) => {
      if (didDrag) {
        didDrag = false;
        return;
      }
      togglePanel();
    };

    // 5. Smooth 60fps Bottom-Anchored Dragging
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialLeft = 0;
    let initialBottom = 0;
    let dragOverlay = null;

    host.addEventListener('mousedown', (e) => {
      if (e.target.closest('button, input, textarea, select, a, .bt-hud-feed, [role="button"]')) return;
      if (e.button !== 0) return;

      didDrag = false;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;

      const rect = host.getBoundingClientRect();
      initialLeft = rect.left;
      initialBottom = window.innerHeight - rect.bottom;

      host.style.left = initialLeft + 'px';
      host.style.bottom = initialBottom + 'px';
      host.style.right = 'auto';
      host.style.top = 'auto';
      host.style.transition = 'none';

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

      const onMouseMove = (moveEv) => {
        if (!isDragging) return;
        const dx = moveEv.clientX - dragStartX;
        const dy = moveEv.clientY - dragStartY;

        if (Math.hypot(dx, dy) > 4) {
          didDrag = true;
        }

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
    });

    // 6. Automation State Syncing
    function syncStateUI() {
      if (!window.__bioTailrState.isStarted) {
        badge.innerText = 'STANDBY';
        badge.style.background = '#f1f5f9';
        badge.style.color = '#475569';
        badge.style.borderColor = '#cbd5e1';
        panelDot.style.background = '#059669';
        pillDot.style.background = '#059669';
        btnText.innerText = 'AUTO-APPLY NOW';
        mainBtn.style.background = '#059669';
      } else if (window.__bioTailrState.isPaused) {
        badge.innerText = 'PAUSED';
        badge.style.background = '#fef3c7';
        badge.style.color = '#92400e';
        badge.style.borderColor = '#fde68a';
        panelDot.style.background = '#f59e0b';
        pillDot.style.background = '#f59e0b';
        btnText.innerText = 'RESUME AUTO APPLY';
        mainBtn.style.background = '#f59e0b';
      } else {
        badge.innerText = 'RUNNING';
        badge.style.background = '#ecfdf5';
        badge.style.color = '#047857';
        badge.style.borderColor = '#a7f3d0';
        panelDot.style.background = '#10b981';
        pillDot.style.background = '#10b981';
        btnText.innerText = 'PAUSE AUTO APPLY';
        mainBtn.style.background = '#374151';
      }
    }

    mainBtn.onclick = () => {
      if (!window.__bioTailrState.isStarted) {
        window.__bioTailrState.isStarted = true;
        window.__bioTailrState.isPaused = false;
        window.__bioTailrAppendLog('START', 'Auto-Apply started by user from StandBy HUD.');
      } else {
        window.__bioTailrState.isPaused = !window.__bioTailrState.isPaused;
        window.__bioTailrAppendLog(window.__bioTailrState.isPaused ? 'PAUSE' : 'RESUME', window.__bioTailrState.isPaused ? 'Execution paused by user.' : 'Execution resumed.');
      }
      syncStateUI();
    };

    // 7. Telemetry Updates
    window.__bioTailrUpdateHud = (data) => {
      const job = document.getElementById('bt-target-job');
      const comp = document.getElementById('bt-target-company');

      if (job && data.jobTitle) job.innerText = data.jobTitle;
      if (comp && data.company) comp.innerText = data.company;

      if (data.status === 'COMPLETE') {
        window.__bioTailrState.isStarted = false;
        badge.innerText = 'DONE';
        badge.style.background = '#f1f5f9';
        badge.style.color = '#374151';
        btnText.innerText = 'SESSION COMPLETE';
        mainBtn.disabled = true;
        mainBtn.style.background = '#6b7280';
      }
    };

    window.__bioTailrAppendLog = (tag, message) => {
      const logStream = document.getElementById('bt-log-stream');
      if (!logStream) return;

      const row = document.createElement('div');
      row.style.lineHeight = '1.4';
      row.style.wordBreak = 'break-word';

      let tagColor = '#059669';
      if (/err|fail/i.test(tag)) tagColor = '#ef4444';
      else if (/skip|warn/i.test(tag)) tagColor = '#d97706';
      else if (/submit|success/i.test(tag)) tagColor = '#059669';
      else if (/step|form/i.test(tag)) tagColor = '#0284c7';
      else if (/standby/i.test(tag)) tagColor = '#94a3b8';

      row.innerHTML = '<span style="color:#94a3b8; font-weight:600;">[' + tag + ']</span> ' + message;
      logStream.appendChild(row);
      logStream.scrollTop = logStream.scrollHeight;
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
    return Boolean(window.__bioTailrState?.isStarted);
  })()`);
}

async function isHudPaused(ws) {
  return await cdpEval(ws, `(() => {
    return Boolean(window.__bioTailrState?.isPaused);
  })()`);
}

module.exports = {
  ensureHudInjected,
  updateHud,
  appendHudLog,
  isHudStarted,
  isHudPaused
};
