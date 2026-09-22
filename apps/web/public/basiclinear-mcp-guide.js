// Keep public documentation useful on self-hosted deployments without reading
// login state, contacting the API, or including callback query parameters.
(() => {
  const endpoint = new URL('/mcp', window.location.href).href;
  for (const code of document.querySelectorAll('[data-mcp-endpoint], [data-mcp-commands]')) {
    code.textContent = code.textContent.replaceAll('https://basiclinear.qiaosun.me/mcp', endpoint);
  }
})();
