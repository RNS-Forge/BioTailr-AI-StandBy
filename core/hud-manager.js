/**
 * BioTailr AI StandBy - HUD Manager
 * Injects and manages the live on-screen StandBy HUD directly inside Google Chrome via CDP.
 * Features:
 * - Fully Draggable Container (smooth viewport-bounded drag)
 * - Explicit "START AUTO APPLY" gate button (automation only starts when clicked)
 * - In-HUD Real-Time Execution Log Stream
 * - Pause / Resume controls & Session Counters
 * - Zero emojis, max 6px border-radius, clean emerald theme.
 */

const { cdpEval } = require('./cdp-client');

async function ensureHudInjected(ws) {
  await cdpEval(ws, `(() => {
    if (document.getElementById('biotailr-standby-hud')) return;

    const hud = document.createElement('div');
    hud.id = 'biotailr-standby-hud';
    hud.style.cssText = \`
      position: fixed;
      top: 16px;
      right: 16px;
      width: 340px;
      max-width: calc(100vw - 32px);
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-top: 3px solid #10b981;
      border-radius: 6px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      z-index: 9999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      color: #111827;
      overflow: hidden;
      user-select: none;
    \`;

    hud.innerHTML = \`
      <!-- Draggable Header -->
      <div id="bt-hud-header" style="padding: 10px 14px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between; cursor: grab;">
        <div style="display: flex; align-items: center; gap: 8px; pointer-events: none;">
          <div id="bt-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #9ca3af; box-shadow: 0 0 0 2px rgba(156, 163, 175, 0.2);"></div>
          <span style="font-weight: 700; color: #111827; letter-spacing: -0.2px;">BioTailr StandBy</span>
          <span id="bt-status-pill" style="font-size: 10px; font-weight: 600; text-transform: uppercase; background: #f3f4f6; color: #4b5563; border: 1px solid #d1d5db; padding: 2px 6px; border-radius: 4px;">STANDBY</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <button id="bt-ctrl-btn" style="border: 1px solid #d1d5db; background: #ffffff; cursor: pointer; color: #374151; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 4px; display: none;">PAUSE</button>
          <button id="bt-min-btn" style="border: none; background: transparent; cursor: pointer; color: #6b7280; font-size: 16px; line-height: 1; padding: 2px 4px;">_</button>
        </div>
      </div>

      <div id="bt-hud-body" style="padding: 12px 14px; user-select: text;">
        <!-- Primary Action / Gate Button -->
        <button id="bt-main-start-btn" style="width: 100%; padding: 9px 12px; background: #10b981; color: #ffffff; border: none; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: background 0.15s ease;">
          START AUTO APPLY
        </button>

        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 11px; color: #4b5563;">
          <span>Session Progress</span>
          <span style="font-weight: 600; color: #059669;" id="bt-stats">Page 1 | Applied: 0</span>
        </div>

        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px 10px; margin-bottom: 10px; border-left: 3px solid #10b981;">
          <div style="font-size: 10px; text-transform: uppercase; color: #6b7280; font-weight: 600;">Current Target</div>
          <div id="bt-target-job" style="font-weight: 600; color: #111827; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">StandBy Ready</div>
          <div id="bt-target-company" style="font-size: 11px; color: #4b5563; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Waiting to start...</div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; padding: 6px 8px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; margin-bottom: 10px;">
          <span style="color: #166534; font-weight: 500;">Status</span>
          <span id="bt-status-text" style="font-weight: 600; color: #059669;">StandBy - Click Start</span>
        </div>

        <!-- In-HUD Live Event Log Box -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: #6b7280;">Live Execution Log</span>
            <span id="bt-log-count" style="font-size: 9px; color: #9ca3af;">1 entry</span>
          </div>
          <div id="bt-log-stream" style="height: 100px; max-height: 100px; overflow-y: auto; background: #111827; color: #e5e7eb; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; padding: 6px 8px; border-radius: 4px; line-height: 1.45; word-break: break-all;">
            <div style="color: #9ca3af;">[STANDBY] Click "START AUTO APPLY" to begin.</div>
          </div>
        </div>
      </div>
    \`;

    document.body.appendChild(hud);

    window.__bioTailrState = {
      isStarted: false,
      isPaused: false,
      logCount: 1
    };

    // 1. Draggable implementation
    const header = document.getElementById('bt-hud-header');
    let isDragging = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return; // ignore button clicks
      isDragging = true;
      header.style.cursor = 'grabbing';
      startX = e.clientX;
      startY = e.clientY;
      const rect = hud.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;

      // Lock current position to left/top and remove right positioning
      hud.style.left = startLeft + 'px';
      hud.style.top = startTop + 'px';
      hud.style.right = 'auto';

      const onMouseMove = (moveEv) => {
        if (!isDragging) return;
        const dx = moveEv.clientX - startX;
        const dy = moveEv.clientY - startY;

        const maxLeft = window.innerWidth - hud.offsetWidth - 8;
        const maxTop = window.innerHeight - hud.offsetHeight - 8;

        const newLeft = Math.max(8, Math.min(maxLeft, startLeft + dx));
        const newTop = Math.max(8, Math.min(maxTop, startTop + dy));

        hud.style.left = newLeft + 'px';
        hud.style.top = newTop + 'px';
      };

      const onMouseUp = () => {
        isDragging = false;
        header.style.cursor = 'grab';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    // 2. Start / Pause Gate Controller
    const mainStartBtn = document.getElementById('bt-main-start-btn');
    const ctrlBtn = document.getElementById('bt-ctrl-btn');
    const statusPill = document.getElementById('bt-status-pill');
    const dot = document.getElementById('bt-status-dot');
    const statusText = document.getElementById('bt-status-text');

    function syncStateUI() {
      if (!window.__bioTailrState.isStarted) {
        statusPill.innerText = 'STANDBY';
        statusPill.style.background = '#f3f4f6';
        statusPill.style.color = '#4b5563';
        statusPill.style.borderColor = '#d1d5db';
        dot.style.background = '#9ca3af';
        mainStartBtn.innerText = 'START AUTO APPLY';
        mainStartBtn.style.background = '#10b981';
        ctrlBtn.style.display = 'none';
        statusText.innerText = 'StandBy - Click Start';
      } else if (window.__bioTailrState.isPaused) {
        statusPill.innerText = 'PAUSED';
        statusPill.style.background = '#fef3c7';
        statusPill.style.color = '#92400e';
        statusPill.style.borderColor = '#fde68a';
        dot.style.background = '#f59e0b';
        mainStartBtn.innerText = 'RESUME AUTO APPLY';
        mainStartBtn.style.background = '#f59e0b';
        ctrlBtn.style.display = 'block';
        ctrlBtn.innerText = 'RESUME';
        statusText.innerText = 'Paused by user';
      } else {
        statusPill.innerText = 'RUNNING';
        statusPill.style.background = '#ecfdf5';
        statusPill.style.color = '#047857';
        statusPill.style.borderColor = '#a7f3d0';
        dot.style.background = '#10b981';
        mainStartBtn.innerText = 'PAUSE AUTO APPLY';
        mainStartBtn.style.background = '#374151';
        ctrlBtn.style.display = 'block';
        ctrlBtn.innerText = 'PAUSE';
        statusText.innerText = 'Auto-Applying active';
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

    if (ctrlBtn) {
      ctrlBtn.onclick = () => {
        window.__bioTailrState.isPaused = !window.__bioTailrState.isPaused;
        syncStateUI();
        window.__bioTailrAppendLog(window.__bioTailrState.isPaused ? 'PAUSE' : 'RESUME', window.__bioTailrState.isPaused ? 'Execution paused by user.' : 'Execution resumed.');
      };
    }

    const minBtn = document.getElementById('bt-min-btn');
    const body = document.getElementById('bt-hud-body');
    if (minBtn && body) {
      minBtn.onclick = () => {
        const isHidden = body.style.display === 'none';
        body.style.display = isHidden ? 'block' : 'none';
        minBtn.innerText = isHidden ? '_' : '+';
      };
    }

    // 3. Telemetry Updates
    window.__bioTailrUpdateHud = (data) => {
      const stats = document.getElementById('bt-stats');
      const job = document.getElementById('bt-target-job');
      const comp = document.getElementById('bt-target-company');
      const sText = document.getElementById('bt-status-text');

      if (stats && data.page !== undefined) stats.innerText = 'Page ' + data.page + ' | Applied: ' + (data.appliedCount || 0);
      if (job && data.jobTitle) job.innerText = data.jobTitle;
      if (comp && data.company) comp.innerText = data.company;
      if (sText && data.status) sText.innerText = data.status;

      if (data.status === 'COMPLETE') {
        window.__bioTailrState.isStarted = false;
        statusPill.innerText = 'DONE';
        statusPill.style.background = '#f3f4f6';
        statusPill.style.color = '#374151';
        dot.style.background = '#6b7280';
        mainStartBtn.innerText = 'SESSION COMPLETE';
        mainStartBtn.disabled = true;
        mainStartBtn.style.background = '#6b7280';
        ctrlBtn.style.display = 'none';
      }
    };

    window.__bioTailrAppendLog = (tag, message) => {
      const logStream = document.getElementById('bt-log-stream');
      const logCountEl = document.getElementById('bt-log-count');
      if (!logStream) return;

      window.__bioTailrState.logCount = (window.__bioTailrState.logCount || 0) + 1;
      if (logCountEl) logCountEl.innerText = window.__bioTailrState.logCount + ' entries';

      const row = document.createElement('div');
      row.style.marginTop = '2px';
      const ts = new Date().toLocaleTimeString([], { hour12: false });

      let tagColor = '#10b981';
      if (/err|fail/i.test(tag)) tagColor = '#ef4444';
      else if (/skip|warn/i.test(tag)) tagColor = '#f59e0b';
      else if (/submit|success/i.test(tag)) tagColor = '#34d399';
      else if (/step|form/i.test(tag)) tagColor = '#60a5fa';
      else if (/standby/i.test(tag)) tagColor = '#9ca3af';

      row.innerHTML = \`<span style="color:#6b7280;">[\${ts}]</span> <span style="color:\${tagColor}; font-weight:600;">[\${tag}]</span> \${message}\`;
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
