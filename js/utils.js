export async function poll(draftId) {
  try {
    await loadPlayersMap();

    // Fetch draft picks
    const url = `https://api.sleeper.app/v1/draft/${draftId}/picks`;
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error('Failed to fetch picks');
    const picks = await res.json();

    // Clear previous picks
    draftedIds.clear();
    const picksList = document.getElementById('picksList');
    picksList.innerHTML = '';

    picks.forEach(p => {
      const pid = p.player_id || (p.metadata && p.metadata.player_id);
      if (pid) draftedIds.add(String(pid));

      const pl = pid ? (playersById[String(pid)] || {}) : {};
      const fullName = pl.full_name || [pl.first_name, pl.last_name].filter(Boolean).join(' ').trim();
      const who = fullName || (p.metadata ? `${p.metadata.first_name || ''} ${p.metadata.last_name || ''}`.trim() : 'Unknown');

      const li = document.createElement('li');
      li.textContent = `${who || 'Unknown'}${p.metadata && p.metadata.team ? ' (' + p.metadata.team + ')' : ''}`;
      picksList.appendChild(li);
    });

    // Re-render available table
    renderAvailable();
    setCounts();

    // Update sync status
    const status = document.getElementById('syncStatus');
    if (status) status.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
  } catch (e) {
    console.error(e);
    const status = document.getElementById('syncStatus');
    if (status) status.textContent = 'Sync error: ' + e.message;
  }
}

