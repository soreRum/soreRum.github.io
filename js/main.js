import { initTheme } from './theme.js';
import { initCSV } from './csv.js';
import { initDraftSync } from './draft.js';
import { initFilters } from './filters.js';

document.addEventListener('DOMContentLoaded', () => {
  // Build basic structure
  const app = document.getElementById('app');
  app.innerHTML = `
    <header></header>
    <section id="controls"></section>
    <section id="filters"></section>
    <section id="tables"></section>
    <footer class="text-xs text-slate-500 dark:text-slate-300 mt-8">
      Open-source prototype. Sleeper API © their owners. Not affiliated with Sleeper.
    </footer>
  `;

  initTheme();
  initCSV();
  initDraftSync();
  initFilters();
});
