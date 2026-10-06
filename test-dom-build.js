const http = require('http');

async function testDomBuilding() {
  const tabs = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const li = tabs.find(t => t.url && t.url.includes('linkedin.com/jobs'));
  const ws = new WebSocket(li.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  const evalCDP = (expr) => new Promise(res => {
    const id = 123;
    ws.onmessage = (e) => {
      const p = JSON.parse(e.data);
      if (p.id === id) res(p.result?.result?.value);
    };
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
  });

  const res = await evalCDP(`(() => {
    const host = document.createElement('div');
    host.id = 'biotailr-agent-hud';

    // 1. Style
    const style = document.createElement('style');
    style.textContent = \`
      #biotailr-agent-hud {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        user-select: none;
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
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        cursor: pointer;
      }
      .bt-hud-pill:hover {
        border-color: #059669;
        color: #059669;
      }
      .bt-pulse-dot {
        width: 8px;
        height: 8px;
        background: #059669;
        border-radius: 50%;
        box-shadow: 0 0 0 2px #d1fae5;
      }
      .bt-hud-panel {
        display: none;
        flex-direction: column;
        width: 360px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        box-shadow: 0 12px 32px -4px rgba(15, 23, 42, 0.12);
        margin-bottom: 10px;
      }
      .bt-hud-panel.open {
        display: flex;
      }
      .bt-hud-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        border-radius: 6px 6px 0 0;
      }
      .bt-hud-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 700;
        color: #0f172a;
      }
      .bt-hud-badge {
        font-size: 10px;
        font-weight: 700;
        padding: 3px 6px;
        background: #f1f5f9;
        color: #475569;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
      }
      .bt-hud-badge.active {
        background: #ecfdf5;
        color: #047857;
        border-color: #a7f3d0;
      }
      .bt-hud-close {
        background: transparent;
        border: none;
        color: #64748b;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
      }
      .bt-hud-body {
        padding: 12px 14px;
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
        gap: 4px;
      }
      .bt-hud-job-title {
        font-size: 13px;
        font-weight: 600;
        color: #0f172a;
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
        font-family: monospace;
        font-size: 11px;
        color: #334155;
      }
      .bt-hud-actions {
        display: flex;
        gap: 8px;
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
      }
      .bt-btn-secondary {
        display: flex;
        align-items: center;
        justify-content: center;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        color: #334155;
        font-size: 12px;
        font-weight: 600;
        padding: 9px 14px;
        border-radius: 6px;
        cursor: pointer;
      }
    \`;
    host.appendChild(style);

    // Panel
    const panel = document.createElement('div');
    panel.className = 'bt-hud-panel open';
    panel.id = 'bt-hud-panel';

    const header = document.createElement('div');
    header.className = 'bt-hud-header';

    const titleBox = document.createElement('div');
    titleBox.className = 'bt-hud-title';
    const panelDot = document.createElement('span');
    panelDot.className = 'bt-pulse-dot';
    panelDot.id = 'bt-panel-dot';
    const titleText = document.createElement('span');
    titleText.textContent = 'BioTailr Autonomous Agent';
    titleBox.appendChild(panelDot);
    titleBox.appendChild(titleText);

    const badge = document.createElement('span');
    badge.className = 'bt-hud-badge';
    badge.id = 'bt-hud-badge';
    badge.textContent = 'STANDBY';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'bt-hud-close';
    closeBtn.id = 'bt-hud-close-btn';
    closeBtn.textContent = '✕';

    header.appendChild(titleBox);
    header.appendChild(badge);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'bt-hud-body';

    const info = document.createElement('div');
    info.className = 'bt-hud-info';
    const jobTitle = document.createElement('div');
    jobTitle.className = 'bt-hud-job-title';
    jobTitle.id = 'bt-hud-job-title';
    jobTitle.textContent = 'Backend Developer (Remote)';
    const model = document.createElement('div');
    model.className = 'bt-hud-model';
    model.textContent = 'Google Gemini Engine (Project Key)';
    info.appendChild(jobTitle);
    info.appendChild(model);

    const feed = document.createElement('div');
    feed.className = 'bt-hud-feed';
    feed.id = 'bt-hud-feed';
    feed.textContent = '[INIT] Screen Agent initialized on LinkedIn.';

    const actions = document.createElement('div');
    actions.className = 'bt-hud-actions';

    const primaryBtn = document.createElement('button');
    primaryBtn.className = 'bt-btn-primary';
    primaryBtn.id = 'bt-btn-auto-apply';
    primaryBtn.textContent = 'AUTO-APPLY NOW';

    const secondaryBtn = document.createElement('button');
    secondaryBtn.className = 'bt-btn-secondary';
    secondaryBtn.id = 'bt-btn-next-job';
    secondaryBtn.textContent = 'Next Job';

    actions.appendChild(primaryBtn);
    actions.appendChild(secondaryBtn);

    body.appendChild(info);
    body.appendChild(feed);
    body.appendChild(actions);

    panel.appendChild(header);
    panel.appendChild(body);

    // Pill
    const pill = document.createElement('div');
    pill.className = 'bt-hud-pill';
    pill.id = 'bt-hud-pill';
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

    const panelStyle = window.getComputedStyle(panel);
    const pillStyle = window.getComputedStyle(pill);
    const btnStyle = window.getComputedStyle(primaryBtn);

    return {
      success: true,
      panelBackground: panelStyle.backgroundColor,
      panelBorderRadius: panelStyle.borderRadius,
      pillBackground: pillStyle.backgroundColor,
      pillBorderRadius: pillStyle.borderRadius,
      btnBackground: btnStyle.backgroundColor,
      btnBorderRadius: btnStyle.borderRadius
    };
  })()`);

  console.log('DOM API Direct Build Result:', res);
  ws.close();
}

testDomBuilding();
