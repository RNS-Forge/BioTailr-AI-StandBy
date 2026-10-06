/**
 * BioTailr AI StandBy - HUD Manager
 * StandBy Metrics Counter & Applied/Failed Jobs Inspector directly inside Google Chrome via CDP.
 * Features:
 * - Big Number Display: Shows successful applied jobs count in prominent emerald typography.
 * - Single-Click Tab Switcher: Clicking Applied count or Failed badge opens the drawer to that exact list.
 * - Interactive Dual Lists:
 *     1. Applied Jobs List: Displays company name, job role, and submission time for each applied role.
 *     2. Failed Jobs List: Displays company name, job role, and reason for each skipped/failed role.
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
      appliedJobs: [],
      failedJobs: [],
      jobTitle: 'Initializing...',
      company: 'LinkedIn Feed',
      status: 'ACTIVE'
    };

    // 2. Remove any stale HUD instances and old extension HUD designs
    const staleHuds = document.querySelectorAll('#biotailr-agent-hud, #biotailr-standby-hud, .bt-hud-panel, .bt-hud-pill');
    staleHuds.forEach(el => el.remove());

    // 3. Create Fresh StandBy HUD Container
    const host = document.createElement('div');
    host.id = 'biotailr-standby-hud';
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
      #biotailr-standby-hud * {
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
        cursor: pointer !important;
      }
      .bt-count-block:hover .bt-count-number {
        transform: scale(1.05);
      }
      .bt-count-number {
        font-size: 26px;
        font-weight: 800;
        line-height: 1;
        color: #059669;
        letter-spacing: -0.5px;
        font-variant-numeric: tabular-nums;
        transition: transform 0.15s ease;
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
        cursor: pointer !important;
        transition: all 0.15s ease;
      }
      .bt-failed-badge:hover {
        background: #fee2e2 !important;
        border-color: #fca5a5 !important;
        color: #b91c1c !important;
      }
      .bt-failed-badge.has-failed {
        background: #fef2f2;
        color: #b91c1c;
        border-color: #fecaca;
      }
      .bt-details-drawer {
        display: none;
        flex-direction: column;
        width: 400px;
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
        border: 2px solid transparent;
        border-radius: 6px;
        padding: 8px 12px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        cursor: pointer !important;
        transition: all 0.15s ease;
      }
      .bt-stat-box.success {
        background: #f0fdf4;
        border-color: #d1fae5;
      }
      .bt-stat-box.success.active {
        border-color: #059669 !important;
        box-shadow: 0 0 0 1px #059669;
      }
      .bt-stat-box.failed {
        background: #fef2f2;
        border-color: #fee2e2;
      }
      .bt-stat-box.failed.active {
        border-color: #b91c1c !important;
        box-shadow: 0 0 0 1px #b91c1c;
      }
      .bt-stat-val-big {
        font-size: 22px;
        font-weight: 800;
        line-height: 1.1;
      }
      .bt-stat-box.success .bt-stat-val-big {
        color: #059669;
      }
      .bt-stat-box.failed .bt-stat-val-big {
        color: #b91c1c;
      }
      .bt-stat-lbl {
        font-size: 10px;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .bt-list-section {
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .bt-section-heading {
        font-size: 11px;
        font-weight: 700;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .bt-items-container {
        max-height: 220px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-right: 4px;
      }
      .bt-job-item {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 8px 12px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        transition: border-color 0.15s ease;
      }
      .bt-job-item.success {
        border-left: 3px solid #059669;
      }
      .bt-job-item.failed {
        border-left: 3px solid #dc2626;
      }
      .bt-job-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .bt-job-company {
        font-size: 12px;
        font-weight: 700;
        color: #0f172a;
      }
      .bt-job-tag-success {
        font-size: 9px;
        font-weight: 700;
        padding: 2px 5px;
        border-radius: 3px;
        background: #d1fae5;
        color: #065f46;
        text-transform: uppercase;
      }
      .bt-job-tag-failed {
        font-size: 9px;
        font-weight: 700;
        padding: 2px 5px;
        border-radius: 3px;
        background: #fee2e2;
        color: #991b1b;
        text-transform: uppercase;
      }
      .bt-job-role {
        font-size: 11px;
        color: #334155;
      }
      .bt-job-meta {
        font-size: 10px;
        color: #64748b;
        margin-top: 1px;
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

    // Stats Grid / Tabs
    const statsGrid = document.createElement('div');
    statsGrid.className = 'bt-stats-grid';

    const statBoxSuccess = document.createElement('div');
    statBoxSuccess.className = 'bt-stat-box success active';
    statBoxSuccess.id = 'bt-tab-applied-box';
    const valSuccess = document.createElement('div');
    valSuccess.className = 'bt-stat-val-big';
    valSuccess.id = 'bt-drawer-applied-val';
    valSuccess.textContent = '0';
    const lblSuccess = document.createElement('div');
    lblSuccess.className = 'bt-stat-lbl';
    lblSuccess.textContent = 'Applied (Click to view)';
    statBoxSuccess.appendChild(valSuccess);
    statBoxSuccess.appendChild(lblSuccess);

    const statBoxFailed = document.createElement('div');
    statBoxFailed.className = 'bt-stat-box failed';
    statBoxFailed.id = 'bt-tab-failed-box';
    const valFailed = document.createElement('div');
    valFailed.className = 'bt-stat-val-big';
    valFailed.id = 'bt-drawer-failed-val';
    valFailed.textContent = '0';
    const lblFailed = document.createElement('div');
    lblFailed.className = 'bt-stat-lbl';
    lblFailed.textContent = 'Failed (Click to view)';
    statBoxFailed.appendChild(valFailed);
    statBoxFailed.appendChild(lblFailed);

    statsGrid.appendChild(statBoxSuccess);
    statsGrid.appendChild(statBoxFailed);

    // View 1: Applied Jobs Section
    const appliedSection = document.createElement('div');
    appliedSection.className = 'bt-list-section';
    appliedSection.id = 'bt-applied-view';

    const appliedHeading = document.createElement('div');
    appliedHeading.className = 'bt-section-heading';
    appliedHeading.innerHTML = '<span>Applied Jobs List</span><span style="font-size:10px; font-weight:normal; color:#059669;">Company & Role</span>';

    const appliedList = document.createElement('div');
    appliedList.className = 'bt-items-container';
    appliedList.id = 'bt-applied-list';

    const emptyApplied = document.createElement('div');
    emptyApplied.className = 'bt-empty-state';
    emptyApplied.id = 'bt-empty-applied';
    emptyApplied.textContent = 'No applied jobs yet in this session.';
    appliedList.appendChild(emptyApplied);

    appliedSection.appendChild(appliedHeading);
    appliedSection.appendChild(appliedList);

    // View 2: Failed Jobs Section
    const failedSection = document.createElement('div');
    failedSection.className = 'bt-list-section';
    failedSection.id = 'bt-failed-view';
    failedSection.style.display = 'none';

    const failedHeading = document.createElement('div');
    failedHeading.className = 'bt-section-heading';
    failedHeading.innerHTML = '<span>Failed / Skipped Jobs</span><span style="font-size:10px; font-weight:normal; color:#b91c1c;">Company & Reason</span>';

    const failedList = document.createElement('div');
    failedList.className = 'bt-items-container';
    failedList.id = 'bt-failed-list';

    const emptyFailed = document.createElement('div');
    emptyFailed.className = 'bt-empty-state';
    emptyFailed.id = 'bt-empty-failed';
    emptyFailed.textContent = 'No failed applications yet. All jobs submitted successfully.';
    failedList.appendChild(emptyFailed);

    failedSection.appendChild(failedHeading);
    failedSection.appendChild(failedList);

    // Current Job Footer
    const footer = document.createElement('div');
    footer.className = 'bt-current-footer';
    footer.id = 'bt-current-footer';
    footer.textContent = 'Active: Ready in StandBy';

    drawer.appendChild(dHeader);
    drawer.appendChild(statsGrid);
    drawer.appendChild(appliedSection);
    drawer.appendChild(failedSection);
    drawer.appendChild(footer);

    // 5. StandBy Count Tab (Collapsed / Default state)
    const tab = document.createElement('div');
    tab.className = 'bt-standby-tab';
    tab.id = 'bt-standby-tab';

    const countBlock = document.createElement('div');
    countBlock.className = 'bt-count-block';
    countBlock.id = 'bt-tab-applied-block';
    countBlock.title = 'Click to view applied jobs';
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
    failedBadge.title = 'Click to view failed jobs';
    failedBadge.textContent = 'Failed: 0';

    infoHeader.appendChild(pulseDot);
    infoHeader.appendChild(tabTitle);
    infoHeader.appendChild(failedBadge);

    const statusSub = document.createElement('div');
    statusSub.className = 'bt-status-sub';
    statusSub.id = 'bt-status-sub';
    statusSub.textContent = 'Click to view details';

    infoBlock.appendChild(infoHeader);
    infoBlock.appendChild(statusSub);

    tab.appendChild(countBlock);
    tab.appendChild(infoBlock);

    host.appendChild(drawer);
    host.appendChild(tab);
    document.body.appendChild(host);

    // Tab switching helpers
    const showAppliedTab = () => {
      statBoxSuccess.classList.add('active');
      statBoxFailed.classList.remove('active');
      appliedSection.style.display = 'flex';
      failedSection.style.display = 'none';
      drawer.classList.add('open');
    };

    const showFailedTab = () => {
      statBoxFailed.classList.add('active');
      statBoxSuccess.classList.remove('active');
      failedSection.style.display = 'flex';
      appliedSection.style.display = 'none';
      drawer.classList.add('open');
    };

    statBoxSuccess.onclick = (e) => {
      e.stopPropagation();
      showAppliedTab();
    };

    statBoxFailed.onclick = (e) => {
      e.stopPropagation();
      showFailedTab();
    };

    countBlock.onclick = (e) => {
      e.stopPropagation();
      showAppliedTab();
    };

    failedBadge.onclick = (e) => {
      e.stopPropagation();
      showFailedTab();
    };

    // Click Handler to toggle drawer
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

    // 6. Smooth Draggable Header / Tab Handle
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialLeft = 0;
    let initialBottom = 0;

    const startDrag = (e) => {
      if (e.target.closest('button, .bt-drawer-close, .bt-stat-box, .bt-failed-badge, .bt-count-block')) return;
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

    // 7. Global State Update Method
    window.__bioTailrUpdateHud = (data) => {
      const countEl = host.querySelector('#bt-hud-count');
      const drawerApplied = host.querySelector('#bt-drawer-applied-val');
      const drawerFailed = host.querySelector('#bt-drawer-failed-val');
      const failedBadgeEl = host.querySelector('#bt-tab-failed-badge');
      const statusSubEl = host.querySelector('#bt-status-sub');
      const currentFooter = host.querySelector('#bt-current-footer');
      const appliedListEl = host.querySelector('#bt-applied-list');
      const failedListEl = host.querySelector('#bt-failed-list');

      const applied = typeof data.appliedCount === 'number' ? data.appliedCount : (data.appliedJobs ? data.appliedJobs.length : 0);
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

      // Update Applied Jobs Listing
      if (Array.isArray(data.appliedJobs) && appliedListEl) {
        appliedListEl.innerHTML = '';
        if (data.appliedJobs.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'bt-empty-state';
          empty.innerText = 'No applied jobs yet in this session.';
          appliedListEl.appendChild(empty);
        } else {
          data.appliedJobs.forEach(item => {
            const card = document.createElement('div');
            card.className = 'bt-job-item success';

            const row = document.createElement('div');
            row.className = 'bt-job-row';

            const comp = document.createElement('div');
            comp.className = 'bt-job-company';
            comp.innerText = item.company || 'Unknown Company';

            const tag = document.createElement('span');
            tag.className = 'bt-job-tag-success';
            tag.innerText = 'Applied';

            row.appendChild(comp);
            row.appendChild(tag);

            const role = document.createElement('div');
            role.className = 'bt-job-role';
            role.innerText = item.title || 'Unknown Role';

            const meta = document.createElement('div');
            meta.className = 'bt-job-meta';
            meta.innerText = item.time ? 'Submitted at ' + item.time : 'Application Submitted';

            card.appendChild(row);
            card.appendChild(role);
            card.appendChild(meta);
            appliedListEl.appendChild(card);
          });
        }
      }

      // Update Failed Jobs Listing
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
            card.className = 'bt-job-item failed';

            const row = document.createElement('div');
            row.className = 'bt-job-row';

            const comp = document.createElement('div');
            comp.className = 'bt-job-company';
            comp.innerText = item.company || 'Unknown Company';

            const tag = document.createElement('span');
            tag.className = 'bt-job-tag-failed';
            tag.innerText = 'Skipped';

            row.appendChild(comp);
            row.appendChild(tag);

            const role = document.createElement('div');
            role.className = 'bt-job-role';
            role.innerText = item.title || 'Unknown Role';

            const meta = document.createElement('div');
            meta.className = 'bt-job-meta';
            meta.innerText = item.reason || 'Not Easy Apply';

            card.appendChild(row);
            card.appendChild(role);
            card.appendChild(meta);
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
  // Backward compatibility
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
    appliedJobs: [],
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
