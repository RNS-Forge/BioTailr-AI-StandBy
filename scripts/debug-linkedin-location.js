const { getTargetTab, connectWebSocket, cdpEval } = require('../core/cdp-client');

async function main() {
  const tab = await getTargetTab(9222, ['linkedin.com']);
  const ws = await connectWebSocket(tab.webSocketDebuggerUrl);

  const info = await cdpEval(ws, `(() => {
    const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
    if (!modal) return { hasModal: false };

    const inputs = Array.from(modal.querySelectorAll('input')).map(i => ({
      id: i.id,
      className: i.className,
      value: i.value,
      placeholder: i.placeholder,
      role: i.getAttribute('role'),
      dataTestId: i.getAttribute('data-testid'),
      ariaAutocomplete: i.getAttribute('aria-autocomplete'),
      ariaExpanded: i.getAttribute('aria-expanded'),
      ariaControls: i.getAttribute('aria-controls')
    }));

    // Find all potential dropdown lists or listboxes on the entire page
    const listboxes = Array.from(document.querySelectorAll('[role="listbox"], [role="menu"], ul.basic-typeahead__selectable-list, .search-basic-typeahead__results, [class*="typeahead"]')).map(lb => ({
      id: lb.id,
      className: lb.className,
      role: lb.getAttribute('role'),
      itemsCount: lb.children.length,
      innerTextSnippet: lb.innerText.substring(0, 200)
    }));

    // Find all visible option elements
    const options = Array.from(document.querySelectorAll([
      '[role="listbox"] [role="option"]',
      'div[role="option"]',
      'li[role="option"]',
      '.basic-typeahead__selectable-list li',
      '.search-basic-typeahead__results li',
      'ul[id*="typeahead"] li',
      'div[id*="typeahead"] li',
      '[role="listbox"] li'
    ].join(', '))).map(o => ({
      text: o.innerText.trim(),
      className: o.className,
      role: o.getAttribute('role'),
      offsetParent: Boolean(o.offsetParent)
    }));

    return {
      hasModal: true,
      inputs,
      listboxes,
      options
    };
  })()`);

  console.log(JSON.stringify(info, null, 2));
  ws.close();
}
main().catch(console.error);
