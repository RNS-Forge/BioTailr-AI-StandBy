/**
 * BioTailr AI StandBy - HUD Manager
 * Injects and manages the live on-screen StandBy HUD directly inside Google Chrome via CDP.
 * Pixel-perfect implementation matching executive design (Zero emojis, max 6px radius, uniform border):
 * - Collapsed: Floating Pill ("BioTailr AI Agent") with pulsating emerald status dot
 * - Expanded: Panel ("BioTailr Autonomous Agent") positioned smoothly above pill
 * - Proper Hide and Drop: Clicking pill opens/drops panel; clicking [x] or pill hides panel
 * - Normal 1px uniform border all around (#e2e8f0) with NO colored top-border highlight
 * - Bottom-anchored 60fps dragging all over the screen with glass overlay
 */

const { cdpEval } = require('./cdp-client');

async function ensureHudInjected(ws) {
  await cdpEval(ws, `(() => {
    const existing = document.getElementById('biotailr-standby-hud');
    const savedLeft = existing ? existing.style.left : '';
    const savedBottom = existing ? existing.style.bottom : '';
    const wasOpen = existing ? (existing.querySelector('#bt-hud-panel')?.style.display !== 'none') : true;

    if (existing) {
      existing.remove();
    }

    const host = document.createElement('div');
    host.id = 'biotailr-standby-hud';
    host.style.cssText = \`
      position: fixed;
      bottom: \${savedBottom || '24px'};
      left: \${savedLeft || 'auto'};
      right: \${savedLeft ? 'auto' : '24px'};
      z-index: 9999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      user-select: none;
      color: #0f172a;
    \`;

    host.innerHTML = \`
      <!-- Dropdown / Pop-up Panel (Image 2) -->
      <div id="bt-hud-panel" style="display: \${wasOpen ? 'flex' : 'none'}; flex-direction: column; width: 360px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; box-shadow: 0 12px 32px -4px rgba(15, 23, 42, 0.12), 0 4px 12px rgba(15, 23, 42, 0.06); overflow: hidden; margin-bottom: 10px; cursor: default;">
        <!-- Panel Header: Normal 1px border, no top highlight -->
        <div id="bt-panel-header" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; border-radius: 6px 6px 0 0; cursor: grab; user-select: none;">
          <div style="display: flex; align-items: center; gap: 8px; pointer-events: none;">
            <div id="bt-panel-dot" style="width: 8px; height: 8px; background: #059669; border-radius: 50%; box-shadow: 0 0 0 2px #d1fae5; flex-shrink: 0;"></div>
            <span style="font-size: 13px; font-weight: 700; color: #0f172a; letter-spacing: -0.2px;">BioTailr Autonomous Agent</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span id="bt-status-pill" style="font-size: 10px; font-weight: 700; padding: 3px 6px; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">STANDBY</span>
            <button id="bt-close-btn" style="border: none; background: transparent; cursor: pointer; color: #64748b; font-size: 16px; line-height: 1; padding: 2px 4px; border-radius: 4px; transition: color 0.15s ease;" title="Hide panel" aria-label="Close panel">&times;</button>
          </div>
        </div>

        <!-- Panel Body -->
        <div id="bt-panel-body" style="padding: 14px; display: flex; flex-direction: column; gap: 10px;">
          <!-- Target Info Box -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; display: flex; flex-direction: column; gap: 3px;">
            <div id="bt-target-job" style="font-size: 12px; font-weight: 600; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">LinkedIn Job Search Feed</div>
            <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: #059669; font-weight: 500;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14"/>
              </svg>
              <span id="bt-target-company" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Google Gemini Engine (Project Key)</span>
            </div>
          </div>

          <!-- Live Event Terminal Feed -->
          <div id="bt-log-stream" style="height: 120px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; overflow-y: auto; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; color: #334155; display: flex; flex-direction: column; gap: 4px; line-height: 1.4; word-break: break-all;">
            <div><span style="color: #94a3b8;">[INIT]</span> Screen Agent initialized on LinkedIn.</div>
            <div><span style="color: #94a3b8;">[READY]</span> Autonomous perception engine ready.</div>
          </div>

          <!-- Actions Row: Start Auto-Apply + Next Job -->
          <div style="display: flex; gap: 8px;">
            <button id="bt-main-start-btn" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; background: #059669; border: 1px solid #047857; color: #ffffff; font-size: 12px; font-weight: 600; padding: 9px 14px; border-radius: 6px; cursor: pointer; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); transition: all 0.15s ease;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <polygon points="6 4 20 12 6 20 6 4"/>
              </svg>
              <span id="bt-main-start-text">AUTO-APPLY NOW</span>
            </button>
            <button id="bt-next-btn" style="display: flex; align-items: center; justify-content: center; gap: 5px; background: #ffffff; border: 1px solid #cbd5e1; color: #0f172a; font-size: 12px; font-weight: 600; padding: 9px 12px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;" title="Next Job in search feed">
              <span>Next Job</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

          <!-- Tools Row: Download Runner -->
          <button id="bt-dl-btn" style="display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; background: #ffffff; border: 1px solid #cbd5e1; color: #0f172a; font-size: 11px; font-weight: 600; padding: 7px 10px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;" title="Download Standalone Desktop Auto-Apply Runner (.zip)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Download Desktop Runner (ZIP)</span>
          </button>
        </div>
      </div>

      <!-- Collapsed / Floating Pill (Image 1) -->
      <div id="bt-hud-pill" style="display: flex; align-items: center; gap: 8px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 14px; color: #0f172a; font-size: 13px; font-weight: 600; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04); cursor: pointer; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
        <div id="bt-pill-dot" style="width: 8px; height: 8px; background: #059669; border-radius: 50%; box-shadow: 0 0 0 2px #d1fae5; flex-shrink: 0;"></div>
        <span id="bt-pill-text">BioTailr AI Agent</span>
      </div>
    \`;

    document.body.appendChild(host);

    window.__bioTailrState = window.__bioTailrState || {
      isStarted: false,
      isPaused: false,
      logCount: 2
    };

    const panel = document.getElementById('bt-hud-panel');
    const pill = document.getElementById('bt-hud-pill');
    const closeBtn = document.getElementById('bt-close-btn');
    const mainStartBtn = document.getElementById('bt-main-start-btn');
    const mainStartText = document.getElementById('bt-main-start-text');
    const statusPill = document.getElementById('bt-status-pill');
    const panelDot = document.getElementById('bt-panel-dot');
    const pillDot = document.getElementById('bt-pill-dot');

    // 1. Hide and Drop Feature Controller
    let isPanelOpen = wasOpen;

    const togglePanel = (open) => {
      isPanelOpen = (open !== undefined) ? open : !isPanelOpen;
      panel.style.display = isPanelOpen ? 'flex' : 'none';
    };

    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        togglePanel(false);
      };
    }

    // 2. Smooth 60fps Bottom-Anchored Dragging (drag from header, pill, or card edge)
    let isDragging = false;
    let didDrag = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialLeft = 0;
    let initialBottom = 0;
    let dragOverlay = null;

    host.addEventListener('mousedown', (e) => {
      if (e.target.closest('button, input, textarea, select, a, #bt-log-stream, [role="button"]')) return;
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
        dragOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999999;cursor:grabbing;user-select:none;background:transparent;';
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

    if (pill) {
      pill.onclick = (e) => {
        if (didDrag) {
          didDrag = false;
          return;
        }
        togglePanel();
      };
    }

    // 3. Automation State Syncing
    function syncStateUI() {
      if (!window.__bioTailrState.isStarted) {
        statusPill.innerText = 'STANDBY';
        statusPill.style.background = '#f1f5f9';
        statusPill.style.color = '#475569';
        statusPill.style.borderColor = '#cbd5e1';
        panelDot.style.background = '#059669';
        pillDot.style.background = '#059669';
        mainStartText.innerText = 'AUTO-APPLY NOW';
        mainStartBtn.style.background = '#059669';
      } else if (window.__bioTailrState.isPaused) {
        statusPill.innerText = 'PAUSED';
        statusPill.style.background = '#fef3c7';
        statusPill.style.color = '#92400e';
        statusPill.style.borderColor = '#fde68a';
        panelDot.style.background = '#f59e0b';
        pillDot.style.background = '#f59e0b';
        mainStartText.innerText = 'RESUME AUTO APPLY';
        mainStartBtn.style.background = '#f59e0b';
      } else {
        statusPill.innerText = 'RUNNING';
        statusPill.style.background = '#ecfdf5';
        statusPill.style.color = '#047857';
        statusPill.style.borderColor = '#a7f3d0';
        panelDot.style.background = '#10b981';
        pillDot.style.background = '#10b981';
        mainStartText.innerText = 'PAUSE AUTO APPLY';
        mainStartBtn.style.background = '#374151';
      }
    }

    if (mainStartBtn) {
      mainStartBtn.onclick = () => {
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
    }

    // 4. Telemetry Updates
    window.__bioTailrUpdateHud = (data) => {
      const job = document.getElementById('bt-target-job');
      const comp = document.getElementById('bt-target-company');

      if (job && data.jobTitle) job.innerText = data.jobTitle;
      if (comp && data.company) comp.innerText = data.company;

      if (data.status === 'COMPLETE') {
        window.__bioTailrState.isStarted = false;
        statusPill.innerText = 'DONE';
        statusPill.style.background = '#f1f5f9';
        statusPill.style.color = '#374151';
        mainStartText.innerText = 'SESSION COMPLETE';
        mainStartBtn.disabled = true;
        mainStartBtn.style.background = '#6b7280';
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

      row.innerHTML = \`<span style="color:#94a3b8; font-weight:600;">[\${tag}]</span> \${message}\`;
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
