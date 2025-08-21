export let rankings = [];
export let rawRankings = [];
export let playersById = {};
export let draftedIds = new Set();
export let currentPosFilter = 'ALL';
export const timer = {};

export function normalizeRankings(rows, statusEl) {
  rankings = rows.map((r,i)=>({ rank:i+1, name:r.player||r.name, pos:r.pos?.toUpperCase(), adp:r.adp, teamOffense:r.teamOffense, olineGrade:r.olineGrade, player_id:null }));
  statusEl.innerHTML = `<span class="text-emerald-700 dark:text-emerald-400 font-medium">Loaded ${rankings.length} players.</span>`;
  renderAvailable();
  setCounts();
}

export function renderAvailable() {
  const tables = document.getElementById('tables');
  if (!tables.innerHTML) {
    tables.innerHTML = `
      <div class="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow mb-4">
        <h3 class="font-semibold mb-2">Best Available</h3>
        <table class="min-w-full text-sm" id="availableTable">
          <thead class="sticky top-0 bg-slate-100 dark:bg-slate-700">
            <tr>
              <th class="p-2 text-left">#</th>
              <th class="p-2 text-left">Player</th>
              <th class="p-2 text-left">POS</th>
              <th class="p-2 text-left">ADP</th>
              <th class="p-2 text-left">Team Offense</th>
              <th class="p-2 text-left">O-Line Grade</th>
            </tr>
          </thead>
          <tbody id="availableBody"></tbody>
        </table>
      </div>
      <div class="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow">
        <h3 class="font-semibold mb-2">Live Picks</h3>
        <ol id="picksList" class="text-sm list-decimal pl-5 space-y-1"></ol>
      </div>
    `;
  }

  const tbody = document.getElementById('availableBody');
  tbody.innerHTML = '';
  const filtered = rankings.filter(r => !draftedIds.has(r.player_id) && (currentPosFilter==='ALL'||r.pos===currentPosFilter));
  filtered.slice(0,300).forEach(r => {
    const tr = document.createElement('tr');
    tr.className = 'border-b last:border-0 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors';
    tr.innerHTML = `
      <td class="p-2 text-slate-500 dark:text-slate-300">${r.rank}</td>
      <td class="p-2 font-medium">${r.name}</td>
      <td class="p-2">${r.pos || ''}</td>
      <td class="p-2">${r.adp || ''}</td>
      <td class="p-2">${r.teamOffense || ''}</td>
      <td class="p-2">${r.olineGrade || ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

export function setCounts() {
  console.log(`Available: ${rankings.length} / Total: ${rankings.length}`);
}

export async function loadPlayersMap() {
  if (Object.keys(playersById).length) return;
  const res = await fetch('https://api.sleeper.app/v1/players/nfl');
  playersById = await res.json();
}

export async function poll(draftId) {
  await loadPlayersMap();
  console.log('Polling draft', draftId);
}
