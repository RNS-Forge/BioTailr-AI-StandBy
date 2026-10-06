/**
 * BioTailr AI StandBy - HUD Manager
 * StandBy Metrics Counter & Failed Jobs Inspector directly inside Google Chrome via CDP.
 * Features:
 * - Big Number Display: Shows successful applied jobs count in prominent emerald typography.
 * - Single-Click Expansion: Clicking the StandBy tab opens/closes the failed jobs drawer.
 * - Failed Jobs Inspection: Lists company name and job role alone for all failed/skipped listings.
 * - Zero Emojis, max 6px border-radius, clean slate & emerald theme (#059669).
 * - Smooth 60fps dragging anywhere across the screen.
 * - 100% immune to LinkedIn CSP / Trusted Types.
 */

const { cdpEval } = require('./cdp-client');

async function ensureHudInjected(ws) {
  await cdpEval(ws, `(() => {
    // 1. Initialize State
    window.__bioTailrState = window.__bioTailrState || {
      appliedCount: 0,
      failedCount: 0,
      failedJobs: [],
      jobTitle: 'Initializing...',
      company: 'LinkedIn Feed',
      status: 'ACTIVE'
    };

    // 2. Remove any stale HUD instances
    const staleHuds = document.querySelectorAll('#biotailr-agent-hud, #biotailr-standby-hud');
    staleHuds.forEach(el => el.remove());

    // 3. Create Fresh StandBy HUD Container
    const host = document.createElement('div');
    host.id = 'biotailr-agent-hud';
    host.style.position = 'fixed';
    host.style.bottom = '24px';
    host.style.right = '24px';
    host.style.zIndex = '9999999';
    host.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    host.style.userSelect = 'none';
    host.style.color = '#0f172a';
    host.style.pointerEvents = 'none';

    const style = document.createElement('style');
    style.textContent = \`
      #biotailr-agent-hud * {
        box-sizing: border-box;
      }
      .bt-standby-tab {
        display: flex;
        align-items: center;
        gap: 12px;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 10px 16px;
        box-shadow: 0 4px 14px rgba(15, 23, 42, 0.1), 0 1px 3px rgba(15, 23, 42, 0.05);
        cursor: pointer !important;
        pointer-events: auto !important;
        transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
        user-select: none;
      }
      .bt-standby-tab:hover {
        border-color: #059669 !important;
        box-shadow: 0 6px 18px rgba(5, 150, 105, 0.18) !important;
        transform: translateY(-1px);
      }
      .bt-count-block {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding-right: 12px;
        border-right: 1px solid #e2e8f0;
      }
      .bt-count-number {
        font-size: 26px;
        font-weight: 800;
        line-height: 1;
        color: #059669;
        letter-spacing: -0.5px;
        font-variant-numeric: tabular-nums;
      }
      .bt-count-label {
        font-size: 9px;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        margin-top: 3px;
      }
      .bt-info-block {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .bt-info-header {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .bt-pulse-dot {
        width: 8px;
        height: 8px;
        background: #059669;
        border-radius: 50%;
        box-shadow: 0 0 0 2px #d1fae5;
        flex-shrink: 0;
        animation: bt-pulse 1.4s infinite;
      }
      @keyframes bt-pulse {
        0% { transform: scale(0.9); opacity: 0.8; }
        50% { transform: scale(1.15); opacity: 1; }
        100% { transform: scale(0.9); opacity: 0.8; }
      }
      .bt-tab-title {
        font-size: 13px;
        font-weight: 700;
        color: #0f172a;
        letter-spacing: -0.2px;
      }
      .bt-status-sub {
        font-size: 11px;
        color: #64748b;
        max-width: 170px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .bt-failed-badge {
        font-size: 10px;
        font-weight: 700;
        padding: 3px 7px;
        border-radius: 4px;
        background: #f1f5f9;
        color: #64748b;
        border: 1px solid #cbd5e1;
        margin-left: 6px;
        transition: all 0.15s ease;
      }
      .bt-failed-badge.has-failed {
        background: #fef2f2;
        color: #b91c1c;
        border-color: #fecaca;
      }
      .bt-details-drawer {
        display: none;
        flex-direction: column;
        width: 380px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        box-shadow: 0 14px 34px -4px rgba(15, 23, 42, 0.14), 0 4px 12px rgba(15, 23, 42, 0.06);
        overflow: hidden;
        margin-bottom: 10px;
        pointer-events: auto !important;
      }
      .bt-details-drawer.open {
        display: flex !important;
      }
      .bt-drawer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        cursor: grab !important;
      }
      .bt-drawer-title {
        font-size: 13px;
        font-weight: 700;
        color: #0f172a;
      }
      .bt-drawer-close {
        background: transparent;
        border: none;
        color: #64748b;
        font-size: 18px;
        line-height: 1;
        cursor: pointer !important;
        padding: 2px 6px;
        border-radius: 4px;
      }
      .bt-drawer-close:hover {
        background: #e2e8f0;
        color: #0f172a;
      }
      .bt-stats-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        padding: 12px 16px;
        background: #ffffff;
        border-bottom: 1px solid #f1f5f9;
      }
      .bt-stat-box {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 8px 12px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .bt-stat-box.success {
        border-color: #a7f3d0;
        background: #f0fdf4;
      }
      .bt-stat-val-big {
        font-size: 22px;
        font-weight: 800;
        color: #059669;
        line-height: 1.1;
      }
      .bt-stat-box.failed .bt-stat-val-big {
        color: #b91c1c;
      }
      .bt-stat-lbl {
        font-size: 10px;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .bt-failed-section {
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .bt-failed-heading {
        font-size: 11px;
        font-weight: 700;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .bt-failed-list {
        max-height: 200px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-right: 4px;
      }
      .bt-failed-item {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 8px 12px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .bt-failed-company {
        font-size: 12px;
        font-weight: 700;
        color: #0f172a;
      }
      .bt-failed-role {
        font-size: 11px;
        color: #475569;
      }
      .bt-empty-state {
        padding: 16px 12px;
        text-align: center;
        font-size: 12px;
        color: #64748b;
        background: #f8fafc;
        border: 1px dashed #cbd5e1;
        border-radius: 6px;
      }
      .bt-current-footer {
        padding: 10px 16px;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        font-size: 11px;
        color: #475569;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    \`;
    host.appendChild(style);

    // 4. Details Drawer (Opened on click)
    const drawer = document.createElement('div');
    drawer.className = 'bt-details-drawer';
    drawer.id = 'bt-details-drawer';

    const dHeader = document.createElement('div');
    dHeader.className = 'bt-drawer-header';
    dHeader.id = 'bt-drawer-header';

    const dTitle = document.createElement('div');
    dTitle.className = 'bt-drawer-title';
    dTitle.textContent = 'BioTailr StandBy - Application Monitor';

    const dClose = document.createElement('button');
    dClose.className = 'bt-drawer-close';
    dClose.id = 'bt-drawer-close-btn';
    dClose.textContent = '×';
    dClose.setAttribute('aria-label', 'Close drawer');

    dHeader.appendChild(dTitle);
    dHeader.appendChild(dClose);

    // Stats Grid
    const statsGrid = document.createElement('div');
    statsGrid.className = 'bt-stats-grid';

    const statBoxSuccess = document.createElement('div');
    statBoxSuccess.className = 'bt-stat-box success';
    const valSuccess = document.createElement('div');
    valSuccess.className = 'bt-stat-val-big';
    valSuccess.id = 'bt-drawer-applied-val';
    valSuccess.textContent = '0';
    const lblSuccess = document.createElement('div');
    lblSuccess.className = 'bt-stat-lbl';
    lblSuccess.textContent = 'Applied Successful';
    statBoxSuccess.appendChild(valSuccess);
    statBoxSuccess.appendChild(lblSuccess);

    const statBoxFailed = document.createElement('div');
    statBoxFailed.className = 'bt-stat-box failed';
    const valFailed = document.createElement('div');
    valFailed.className = 'bt-stat-val-big';
    valFailed.id = 'bt-drawer-failed-val';
    valFailed.textContent = '0';
    const lblFailed = document.createElement('div');
    lblFailed.className = 'bt-stat-lbl';
    lblFailed.textContent = 'Failed / Skipped';
    statBoxFailed.appendChild(valFailed);
    statBoxFailed.appendChild(lblFailed);

    statsGrid.appendChild(statBoxSuccess);
    statsGrid.appendChild(statBoxFailed);

    // Failed Jobs Section
    const failedSection = document.createElement('div');
    failedSection.className = 'bt-failed-section';

    const failedHeading = document.createElement('div');
    failedHeading.className = 'bt-failed-heading';
    failedHeading.innerHTML = '<span>Failed / Skipped Jobs</span><span style="font-size:10px; font-weight:normal; color:#64748b;">Company & Job Role</span>';

    const failedList = document.createElement('div');
    failedList.className = 'bt-failed-list';
    failedList.id = 'bt-failed-list';

    const emptyState = document.createElement('div');
    emptyState.className = 'bt-empty-state';
    emptyState.id = 'bt-empty-state';
    emptyState.textContent = 'No failed applications yet. All jobs submitted successfully.';
    failedList.appendChild(emptyState);

    failedSection.appendChild(failedHeading);
    failedSection.appendChild(failedList);

    // Current Job Footer
    const footer = document.createElement('div');
    footer.className = 'bt-current-footer';
    footer.id = 'bt-current-footer';
    footer.textContent = 'Active: Ready in StandBy';

    drawer.appendChild(dHeader);
    drawer.appendChild(statsGrid);
    drawer.appendChild(failedSection);
    drawer.appendChild(footer);

    // 5. StandBy Count Tab (Collapsed / Default state)
    const tab = document.createElement('div');
    tab.className = 'bt-standby-tab';
    tab.id = 'bt-standby-tab';

    const countBlock = document.createElement('div');
    countBlock.className = 'bt-count-block';
    const countNumber = document.createElement('div');
    countNumber.className = 'bt-count-number';
    countNumber.id = 'bt-hud-count';
    countNumber.textContent = '0';
    const countLabel = document.createElement('div');
    countLabel.className = 'bt-count-label';
    countLabel.textContent = 'APPLIED';
    countBlock.appendChild(countNumber);
    countBlock.appendChild(countLabel);

    const infoBlock = document.createElement('div');
    infoBlock.className = 'bt-info-block';
    const infoHeader = document.createElement('div');
    infoHeader.className = 'bt-info-header';
    const pulseDot = document.createElement('span');
    pulseDot.className = 'bt-pulse-dot';
    const tabTitle = document.createElement('span');
    tabTitle.className = 'bt-tab-title';
    tabTitle.textContent = 'BioTailr StandBy';

    const failedBadge = document.createElement('span');
    failedBadge.className = 'bt-failed-badge';
    failedBadge.id = 'bt-tab-failed-badge';
    failedBadge.textContent = 'Failed: 0';

    infoHeader.appendChild(pulseDot);
    infoHeader.appendChild(tabTitle);
    infoHeader.appendChild(failedBadge);

    const statusSub = document.createElement('div');
    statusSub.className = 'bt-status-sub';
    statusSub.id = 'bt-status-sub';
    statusSub.textContent = 'Click to view failed jobs';

    infoBlock.appendChild(infoHeader);
    infoBlock.appendChild(statusSub);

    tab.appendChild(countBlock);
    tab.appendChild(infoBlock);

    host.appendChild(drawer);
    host.appendChild(tab);
    document.body.appendChild(host);

    // 6. Click Handler to toggle failed jobs drawer
    let didDrag = false;
    tab.onclick = (e) => {
      if (didDrag) {
        didDrag = false;
        return;
      }
      e.stopPropagation();
      drawer.classList.toggle('open');
    };

    dClose.onclick = (e) => {
      e.stopPropagation();
      drawer.classList.remove('open');
    };

    // 7. Smooth Draggable Header / Tab Handle
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialLeft = 0;
    let initialBottom = 0;

    const startDrag = (e) => {
      if (e.target.closest('button, .bt-drawer-close')) return;
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
        window.removeEventListener('mousemove', onMouseMove, { capture: true });
        window.removeEventListener('mouseup', onMouseUp, { capture: true });
      };

      window.addEventListener('mousemove', onMouseMove, { capture: true, passive: false });
      window.addEventListener('mouseup', onMouseUp, { capture: true });
    };

    dHeader.addEventListener('mousedown', startDrag);
    tab.addEventListener('mousedown', startDrag);

    // 8. Global State Update Method
    window.__bioTailrUpdateHud = (data) => {
      const countEl = host.querySelector('#bt-hud-count');
      const drawerApplied = host.querySelector('#bt-drawer-applied-val');
      const drawerFailed = host.querySelector('#bt-drawer-failed-val');
      const failedBadgeEl = host.querySelector('#bt-tab-failed-badge');
      const statusSubEl = host.querySelector('#bt-status-sub');
      const currentFooter = host.querySelector('#bt-current-footer');
      const failedListEl = host.querySelector('#bt-failed-list');

      const applied = typeof data.appliedCount === 'number' ? data.appliedCount : 0;
      const failed = typeof data.failedCount === 'number' ? data.failedCount : (data.failedJobs ? data.failedJobs.length : 0);

      if (countEl) countEl.innerText = String(applied);
      if (drawerApplied) drawerApplied.innerText = String(applied);
      if (drawerFailed) drawerFailed.innerText = String(failed);

      if (failedBadgeEl) {
        failedBadgeEl.innerText = 'Failed: ' + failed;
        if (failed > 0) failedBadgeEl.classList.add('has-failed');
        else failedBadgeEl.classList.remove('has-failed');
      }

      if (data.jobTitle) {
        const text = (data.company ? data.company + ' - ' : '') + data.jobTitle;
        if (statusSubEl) statusSubEl.innerText = text;
        if (currentFooter) currentFooter.innerText = 'Active: ' + text;
      }

      // Update failed jobs listing (Company Name & Job Role alone)
      if (Array.isArray(data.failedJobs) && failedListEl) {
        failedListEl.innerHTML = '';
        if (data.failedJobs.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'bt-empty-state';
          empty.innerText = 'No failed applications yet. All jobs submitted successfully.';
          failedListEl.appendChild(empty);
        } else {
          data.failedJobs.forEach(item => {
            const card = document.createElement('div');
            card.className = 'bt-failed-item';

            const comp = document.createElement('div');
            comp.className = 'bt-failed-company';
            comp.innerText = item.company || 'Unknown Company';

            const role = document.createElement('div');
            role.className = 'bt-failed-role';
            role.innerText = item.title || 'Unknown Role';

            card.appendChild(comp);
            card.appendChild(role);
            failedListEl.appendChild(card);
          });
        }
      }
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
  // Maintained for backward compatibility
}

async function isHudStarted(ws) {
  return true;
}

async function isHudPaused(ws) {
  return false;
}

async function resetHudToStandby(ws) {
  await updateHud(ws, {
    appliedCount: 0,
    failedCount: 0,
    failedJobs: [],
    jobTitle: 'Ready in StandBy',
    company: 'LinkedIn Feed',
    status: 'ACTIVE'
  });
}

module.exports = {
  ensureHudInjected,
  resetHudToStandby,
  updateHud,
  appendHudLog,
  isHudStarted,
  isHudPaused
};
