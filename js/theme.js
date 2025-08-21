export function initTheme() {
  const header = document.getElementById('header');
  header.innerHTML = `
    <div class="flex items-center gap-3">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-slate-700 dark:text-slate-300">
        <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 14.59l-3.3-3.3 1.42-1.42L13 13.76l4.88-4.88 1.42 1.42L13 16.59z"/>
      </svg>
      <div>
        <h1 class="text-2xl font-bold">Sleeper Draft Sync + Custom Rankings</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          Upload your own CSV rankings, paste a Sleeper draft URL or ID, and auto-sync every 10s during live drafts.
        </p>
      </div>
    </div>
    <button id="themeToggle" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm font-semibold">
      🌙 Dark Mode
    </button>
  `;

  const themeToggle = document.getElementById('themeToggle');
  function setTheme(dark) {
    document.documentElement.classList.toggle('dark', dark);
    themeToggle.textContent = dark ? '☀️ Light Mode' : '🌙 Dark Mode';
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }

  themeToggle.addEventListener('click', () => setTheme(!document.documentElement.classList.contains('dark')));
  setTheme(document.documentElement.classList.contains('dark'));
}

