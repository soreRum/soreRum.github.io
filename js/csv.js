import { normalizeRankings, renderAvailable, setCounts } from './utils.js';

export function initCSV() {
  const controls = document.getElementById('controls');

  controls.innerHTML += `
    <div class="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow mb-4">
      <h2 class="font-semibold mb-2">1) Upload your rankings (.csv)</h2>
      <input id="csvFile" type="file" accept=".csv" class="block w-full text-sm" />
      <div id="uploadStatus" class="mt-2 text-sm"></div>
    </div>
  `;

  const uploadStatus = document.getElementById('uploadStatus');
  document.getElementById('csvFile').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadStatus.textContent = 'Parsing CSV...';

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => normalizeRankings(res.data, uploadStatus)
    });
  });
}
