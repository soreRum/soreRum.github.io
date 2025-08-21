import { renderAvailable, setCounts } from './utils.js';

export function initFilters() {
  const filters = document.getElementById('filters');
  filters.innerHTML = `
    <section class="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow mb-6">
      <div class="flex flex-wrap items-center gap-2">
        <label class="text-sm">Filter positions:</label>
        <div class="flex gap-2 text-sm" id="posButtons"></div>
       

