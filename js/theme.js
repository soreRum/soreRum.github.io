export function initTheme() {
  const themeToggle = document.createElement('button');
  themeToggle.id = 'themeToggle';
  themeToggle.className = 'px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm font-semibold';
  themeToggle.textContent = document.documentElement.classList.contains('dark') ? '☀️ Light Mode' : '🌙 Dark Mode';
  document.body.prepend(themeToggle);

  themeToggle.addEventListener('click', () => {
    const dark = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', dark);
    themeToggle.textContent = dark ? '☀️ Light Mode' : '🌙 Dark Mode';
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  });
}
