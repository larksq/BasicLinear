(() => {
  try {
    const preference = localStorage.getItem('appearance.theme.v1');
    const explicit = preference === 'light' || preference === 'dark' ? preference : null;
    if (explicit) document.documentElement.dataset.theme = explicit;
    const dark = explicit === 'dark' || (explicit === null && matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#171719' : '#f7f7f8');
  } catch {}
})();
