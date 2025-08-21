import { loadPlayersMap, poll, timer } from './utils.js';

export function initDraftSync() {
  const controls = document.getElementById('controls');
  controls.innerHTML += `
    <div class="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow mb-4">
      <h2 class="font-semibold mb-2">2) Enter Sleeper draft URL or ID</h2>
      <input id="draftInput" type="text" placeholder="Draft URL or ID" class="w-full border rounded-xl px-3 py-2 text-sm dark:bg-slate-700 dark:border-slate-600" />
      <div class="mt-3 flex items-center gap-2">
        <button id="startBtn" class="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold">Start Sync</button>
        <button id="stopBtn" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm font-semibold" disabled>Stop</button>
        <span id="syncStatus" class="text-xs text-slate-600 dark:text-slate-300"></span>
      </div>
    </div>
  `;

  document.getElementById('startBtn').addEventListener('click', async () => {
    const draftInput = document.getElementById('draftInput').value.trim();
    const draftId = draftInput.match(/(\d{10,})/)?.[1];
    if (!draftId) return alert('Invalid draft ID');

    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;

    await poll(draftId);
    timer.interval = setInterval(() => poll(draftId), 10_000);
  });

  document.getElementById('stopBtn').addEventListener('click', () => {
    clearInterval(timer.interval);
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
  });
}
