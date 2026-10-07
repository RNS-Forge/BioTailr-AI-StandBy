/**
 * Debug: Inspect YC listing page buttons (when on /companies? or /jobs? page)
 */
const { log, sleep, getBrowserTabs, connectWebSocket, cdpEval } = require('../core/cdp-client');

async function main() {
  const tabs = await getBrowserTabs(9222);
  console.log('\nAll open tabs:');
  tabs.filter(t => t.type === 'page').forEach((t, i) => {
    console.log(`  [${i}] ${t.url}`);
  });

  // Find the listing tab
  const listingTab = tabs.find(t => t.type === 'page' && t.url && 
    (t.url.includes('workatastartup.com/companies') || 
     t.url.includes('workatastartup.com/jobs?') ||
     t.url.includes('workatastartup.com/companies?')));

  if (!listingTab) {
    console.log('\nNo listing tab found! Open workatastartup.com/companies?... in Chrome');
    // Use first YC tab
    const anyYcTab = tabs.find(t => t.type === 'page' && t.url && t.url.includes('workatastartup.com'));
    if (!anyYcTab) { console.log('No YC tab at all!'); process.exit(1); }
    console.log('\nUsing YC tab:', anyYcTab.url);
    const ws = await connectWebSocket(anyYcTab.webSocketDebuggerUrl);
    await debugPage(ws);
    ws.close();
    return;
  }

  const ws = await connectWebSocket(listingTab.webSocketDebuggerUrl);
  await debugPage(ws);
  ws.close();
}

async function debugPage(ws) {
  await sleep(500);
  const result = await cdpEval(ws, `(() => {
    // All interactive elements
    const allInteractive = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]'));
    
    // Apply buttons specifically
    const applyEls = allInteractive.filter(el => {
      const txt = (el.innerText || el.textContent || el.value || '').trim();
      return /^apply$/i.test(txt) && el.offsetWidth > 0;
    });

    // View job links
    const viewJobLinks = allInteractive.filter(el => {
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      const href = el.href || '';
      return (txt.includes('view job') || href.includes('/jobs/')) && el.offsetWidth > 0;
    });

    // Job title links (blue links)
    const jobTitleLinks = Array.from(document.querySelectorAll('a[href*="/jobs/"]')).filter(el => {
      return el.offsetWidth > 0 && el.innerText.trim().length > 5;
    });

    const mapEl = (el) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        text: (el.innerText || el.textContent || el.value || '').trim().substring(0, 50),
        href: (el.href || '').substring(0, 80),
        className: el.className.substring(0, 80),
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2),
        inViewport: r.top >= 0 && r.top < window.innerHeight
      };
    };

    return {
      url: window.location.href,
      totalInteractive: allInteractive.length,
      applyCount: applyEls.length,
      viewJobCount: viewJobLinks.length,
      jobTitleCount: jobTitleLinks.length,
      applyEls: applyEls.slice(0, 8).map(mapEl),
      viewJobEls: viewJobLinks.slice(0, 5).map(mapEl),
      jobTitleEls: jobTitleLinks.slice(0, 5).map(mapEl),
      bodySnippet: document.body.innerText.substring(0, 400).replace(/\\n/g, ' | ')
    };
  })()`);

  console.log('\n=== YC LISTING PAGE DEBUG ===');
  console.log('URL:', result?.url);
  console.log('Apply buttons found:', result?.applyCount);
  console.log('View job links:', result?.viewJobCount);
  console.log('Job title links (a[href*=/jobs/]):', result?.jobTitleCount);

  console.log('\n--- Apply Buttons ---');
  (result?.applyEls || []).forEach((el, i) => {
    console.log(`  [${i}] <${el.tag}> "${el.text}" | x=${el.x} y=${el.y} | inView=${el.inViewport}`);
    console.log(`       href="${el.href}"`);
    console.log(`       class="${el.className}"`);
  });

  console.log('\n--- Job Title Links ---');
  (result?.jobTitleEls || []).forEach((el, i) => {
    console.log(`  [${i}] "${el.text}" | href="${el.href}" | x=${el.x} y=${el.y}`);
  });

  console.log('\nPage snippet:', result?.bodySnippet?.substring(0, 200));
}

main().catch(console.error);
