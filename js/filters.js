import { renderAvailable, setCounts } from './utils.js';

export function initFilters() {
  const filters = document.getElementById('filters');
  filters.innerHTML = `
    <div class="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow mb-6">
      <label class="text-sm">Filter positions:</label>
      <div class="flex gap-2 text-sm" id="posButtons"></div>
      <input id="searchInput" type="text" placeholder="Search players..." class="border rounded-xl px-3 py-1 text-sm dark:bg-slate-700 dark:border-slate-600 mt-2" />
    </div>
  `;

  const posButtons = document.getElementById('posButtons');
  ['ALL','QB','RB','WR','TE','K','DEF'].forEach(pos => {
    const btn = document.createElement('button');
    btn.textContent = pos;
    btn.dataset.pos = pos;
    btn.className = 'px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-700 dark:text-slate-100';
    btn.addEventListener('click', () => {
      window.currentPosFilter = pos;
      renderAvailable();
      setCounts();
    });
    posButtons.appendChild(btn);
  });

  document.getElementById('searchInput').addEventListener('input', () => { renderAvailable(); setCounts(); });
}
