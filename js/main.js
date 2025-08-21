import { initTheme } from './theme.js';
import { initCSV } from './csv.js';
import { initDraftSync } from './draft.js';
import { initFilters } from './filters.js';

document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');

  // Main structure
  app.innerHTML = `
    <div class="max-w-6xl mx-auto p-6">
      <header class="mb-6 flex items-center gap-3 justify-between" id="header"></header>
      <section class="grid md:grid-cols-2 gap-4 mb-6" id="controls"></section>
      <section id="filters"></section>
      <section class="grid md:grid-cols-3 gap-4" id="tables"></section>
      <footer class="text-xs text-slate-500 dark:text-slate-300 mt-8">
        Open-source prototype. Sleeper API © their owners. Not affiliated with Sleeper.
      </footer>
    </div>
  `;

  initTheme();
  initCSV();
  initDraftSync();
  initFilters();
});
