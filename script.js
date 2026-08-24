const DATA_URL = `data/fpl-data.json?v=${Date.now()}`;

const els = {
  leagueName: document.getElementById('leagueName'),
  leaderTeam: document.getElementById('leaderTeam'),
  leaderManager: document.getElementById('leaderManager'),
  gwLeader: document.getElementById('gwLeader'),
  gwLeaderScore: document.getElementById('gwLeaderScore'),
  averageGw: document.getElementById('averageGw'),
  currentGameweek: document.getElementById('currentGameweek'),
  managerCount: document.getElementById('managerCount'),
  standingsBody: document.getElementById('standingsBody'),
  searchInput: document.getElementById('searchInput'),
  emptyState: document.getElementById('emptyState'),
  lastUpdated: document.getElementById('lastUpdated'),
  statusBanner: document.getElementById('statusBanner'),
  refreshButton: document.getElementById('refreshButton'),
};

let standings = [];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function movement(current, previous) {
  if (!previous || current === previous) return { text: '—', cls: 'move-flat' };
  const delta = previous - current;
  return delta > 0
    ? { text: `▲ ${delta}`, cls: 'move-up' }
    : { text: `▼ ${Math.abs(delta)}`, cls: 'move-down' };
}

function renderRows(rows) {
  els.standingsBody.innerHTML = rows.map((row) => {
    const move = movement(row.rank, row.last_rank);
    return `
      <tr>
        <td><span class="rank-badge ${row.rank === 1 ? 'top' : ''}">${escapeHtml(row.rank)}</span></td>
        <td class="team-name">${escapeHtml(row.entry_name)}</td>
        <td class="manager-name">${escapeHtml(row.player_name)}</td>
        <td class="number-col">${escapeHtml(row.event_total ?? '—')}</td>
        <td class="number-col">${escapeHtml(Number(row.total ?? 0).toLocaleString('en-GB'))}</td>
        <td class="movement-col ${move.cls}">${move.text}</td>
      </tr>`;
  }).join('');
  els.emptyState.hidden = rows.length !== 0;
}

function updateSummary(data) {
  standings = [...(data.standings || [])].sort((a, b) => a.rank - b.rank);
  const leader = standings[0];
  const gwLeader = [...standings].sort((a, b) => (b.event_total ?? -1) - (a.event_total ?? -1))[0];
  const validGwScores = standings.map(x => Number(x.event_total)).filter(Number.isFinite);
  const average = validGwScores.length
    ? validGwScores.reduce((sum, x) => sum + x, 0) / validGwScores.length
    : 0;

  document.title = `${data.league?.name || 'FPL League'} | FPL Dashboard`;
  els.leagueName.textContent = data.league?.name || 'FPL League Dashboard';
  els.leaderTeam.textContent = leader?.entry_name || '—';
  els.leaderManager.textContent = leader ? `${leader.player_name} · ${Number(leader.total).toLocaleString('en-GB')} pts` : '—';
  els.gwLeader.textContent = gwLeader?.entry_name || '—';
  els.gwLeaderScore.textContent = gwLeader ? `${gwLeader.player_name} · ${gwLeader.event_total ?? '—'} pts` : '—';
  els.averageGw.textContent = validGwScores.length ? average.toFixed(1) : '—';
  els.currentGameweek.textContent = data.current_gameweek ? `Gameweek ${data.current_gameweek}` : 'Current gameweek unavailable';
  els.managerCount.textContent = standings.length.toLocaleString('en-GB');

  const updated = data.fetched_at ? new Date(data.fetched_at) : null;
  els.lastUpdated.textContent = updated && !Number.isNaN(updated.valueOf())
    ? `Data fetched: ${updated.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`
    : 'Data fetched: unknown';

  renderRows(standings);
  els.statusBanner.textContent = `Showing ${standings.length} managers from the latest successful FPL data refresh.`;
  els.statusBanner.className = 'status-banner success';
}

async function loadData() {
  try {
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data?.standings) throw new Error('Standings data is missing');
    updateSummary(data);
  } catch (error) {
    console.error(error);
    els.statusBanner.textContent = 'League data has not been generated yet. Run the “Update and deploy FPL dashboard” workflow in GitHub Actions, then reload this page.';
    els.statusBanner.className = 'status-banner error';
  }
}

els.searchInput.addEventListener('input', (event) => {
  const query = event.target.value.trim().toLowerCase();
  if (!query) return renderRows(standings);
  renderRows(standings.filter(row =>
    String(row.entry_name).toLowerCase().includes(query) ||
    String(row.player_name).toLowerCase().includes(query)
  ));
});

els.refreshButton.addEventListener('click', () => window.location.reload());

loadData();
setInterval(loadData, 120000);
