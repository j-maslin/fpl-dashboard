const DATA_URL = "data/fpl-data.json";

const CHIPS = {
  wildcard: { label: "WC", cls: "wildcard", full: "Wildcard" },
  freehit: { label: "FH", cls: "freehit", full: "Free Hit" },
  bboost: { label: "BB", cls: "bboost", full: "Bench Boost" },
  "3xc": { label: "TC", cls: "triple", full: "Triple Captain" },
  triple_captain: { label: "TC", cls: "triple", full: "Triple Captain" }
};

const CHART_COLOURS = ["#6b25e8", "#00c976", "#00bfe8", "#2383de", "#ff8b3d", "#ed23a9"];
let latestData = null;

const byId = (id) => document.getElementById(id);
const setText = (id, value) => {
  const element = byId(id);
  if (element) element.textContent = value ?? "—";
};
const fmt = (value) => Number.isFinite(Number(value)) ? Number(value).toLocaleString("en-GB") : "—";
const pct = (value) => `${Math.round(Number(value) || 0)}%`;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[character]));

async function loadDashboard() {
  try {
    const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    latestData = await response.json();
    render(latestData);
    byId("errorBanner").hidden = true;
  } catch (error) {
    const banner = byId("errorBanner");
    banner.hidden = false;
    banner.textContent = `Could not load FPL data (${error.message}). Run the GitHub Actions workflow and check that data/fpl-data.json was generated successfully.`;
  }
}

function render(data) {
  const standings = [...(data.standings || [])].sort((a, b) => Number(a.rank) - Number(b.rank));
  const summary = data.summary || {};
  const players = data.players || {};
  const gameweek = data.gameweek || {};
  const leagueId = data.league?.id || 1112007;

  setText("pageTitle", data.league?.name || "Virtuoso FPL");
  document.title = `${data.league?.name || "Virtuoso FPL"} · FPL`;
  setText("leagueId", leagueId);
  setText("currentGw", gameweek.id);
  setText("gameweekState", gameweek.finished ? "Complete" : (gameweek.is_current === false ? "Latest" : "Live"));
  byId("leagueLink").href = `https://fantasy.premierleague.com/leagues/${leagueId}/standings/c`;
  renderFreshness(data.generated_at);

  setText("leaderTeam", summary.leader?.team);
  setText("leaderManager", summary.leader?.manager);
  setText("leaderPoints", fmt(summary.leader?.total));
  setText("gwKingTeam", summary.gw_king?.team);
  setText("gwKingManager", summary.gw_king?.manager);
  setText("gwKingPoints", fmt(summary.gw_king?.gw_points));
  setText("averageGw", Number(summary.average_gw || 0).toFixed(1));
  setText("averageGwNumber", gameweek.id);
  setText("managerCount", summary.manager_count ?? standings.length);

  renderQuickMetrics(summary, standings);
  renderStandings(standings);
  renderChipKey(standings);

  setText("mostCaptained", players.most_captained?.name);
  setText("mostCaptainedPct", pct(players.most_captained?.percent));
  setText("mostOwned", players.most_owned?.name);
  setText("mostOwnedPct", pct(players.most_owned?.percent));
  setText("differential", players.top_differential?.name);
  setText("differentialPoints", `${fmt(players.top_differential?.points)} pts`);
  setText("differentialOwned", `${pct(players.top_differential?.percent)} league ownership`);
  renderCaptainDonut(players.captain_popularity || []);

  renderFormLeader(summary);
  renderMovers(summary, standings);
  renderPerformanceChart(data.charts?.performance, standings);
  renderPositionChart(data.charts?.positions, standings);
  renderWinners(data.gameweek_winners || [], standings, gameweek.id);

  setText("highestGwLabel", `(GW ${gameweek.id || "—"})`);
  setText("highestPlayer", players.highest_scoring?.name);
  setText("highestPlayerPoints", fmt(players.highest_scoring?.points));
  setText("highestPlayerTeam", players.highest_scoring?.team);
}

function renderFreshness(value) {
  const pill = byId("freshnessPill");
  pill.classList.remove("is-stale", "is-old");

  if (!value) {
    setText("freshnessLabel", "Awaiting data");
    setText("lastUpdated", "—");
    return;
  }

  const updated = new Date(value);
  const ageMinutes = Math.max(0, Math.floor((Date.now() - updated.getTime()) / 60000));
  let relative;

  if (ageMinutes < 2) relative = "Updated just now";
  else if (ageMinutes < 60) relative = `Updated ${ageMinutes}m ago`;
  else if (ageMinutes < 1440) relative = `Updated ${Math.floor(ageMinutes / 60)}h ago`;
  else relative = `Updated ${Math.floor(ageMinutes / 1440)}d ago`;

  if (ageMinutes >= 180) pill.classList.add("is-old");
  else if (ageMinutes >= 35) pill.classList.add("is-stale");

  setText("freshnessLabel", relative);
  setText("lastUpdated", formatExactTime(updated));
  pill.title = `Latest generated data: ${updated.toLocaleString("en-GB")}`;
}

function formatExactTime(date) {
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderQuickMetrics(summary, rows) {
  const calculated = calculateLeagueMetrics(rows);
  const leadGap = Number(summary.lead_gap ?? calculated.leadGap ?? 0);
  const medianScore = Number(summary.median_gw ?? calculated.medianGw ?? 0);
  const activeChips = Number(summary.active_chips ?? calculated.activeChips ?? 0);
  const benchPain = summary.bench_pain || calculated.benchPain || {};

  setText("leadGapValue", `${fmt(leadGap)} pts`);
  setText("leadGapDetail", rows.length > 1 ? "1st to 2nd" : "only manager");
  setText("medianGwValue", medianScore.toFixed(1));
  setText("activeChipsValue", fmt(activeChips));
  setText("activeChipsDetail", activeChips ? compactChipSummary(rows) : "none this gameweek");
  setText("benchPainValue", `${fmt(benchPain.points ?? benchPain.bench_points ?? 0)} pts`);
  setText("benchPainDetail", Number(benchPain.points ?? benchPain.bench_points ?? 0) > 0 ? (benchPain.manager || benchPain.team || "points benched") : "no points benched");
}

function calculateLeagueMetrics(rows) {
  const totals = rows.map((row) => Number(row.total) || 0).sort((a, b) => b - a);
  const scores = rows.map((row) => Number(row.gw_points) || 0).sort((a, b) => a - b);
  const middle = Math.floor(scores.length / 2);
  const medianGw = scores.length === 0 ? 0 : (scores.length % 2 ? scores[middle] : (scores[middle - 1] + scores[middle]) / 2);
  const benchPain = rows.reduce((best, row) => Number(row.bench_points || 0) > Number(best.bench_points || 0) ? row : best, {});

  return {
    leadGap: totals.length > 1 ? totals[0] - totals[1] : 0,
    leagueSpread: totals.length > 1 ? totals[0] - totals[totals.length - 1] : 0,
    medianGw,
    activeChips: rows.filter((row) => row.active_chip).length,
    benchPain
  };
}

function chipInfo(name) {
  if (!name) return null;
  return CHIPS[name] || {
    label: String(name).slice(0, 3).toUpperCase(),
    cls: "other",
    full: String(name).replaceAll("_", " ")
  };
}

function compactChipSummary(rows) {
  const counts = new Map();
  rows.filter((row) => row.active_chip).forEach((row) => {
    const chip = chipInfo(row.active_chip);
    counts.set(chip.label, (counts.get(chip.label) || 0) + 1);
  });
  return [...counts.entries()].map(([label, count]) => `${label} ×${count}`).join(" · ");
}

function renderStandings(rows) {
  const body = byId("standingsBody");

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="7" class="table-empty">No standings data is available yet.</td></tr>';
    return;
  }

  body.innerHTML = rows.map((row) => {
    const movement = Number(row.movement) || 0;
    const movementClass = movement > 0 ? "move-up" : movement < 0 ? "move-down" : "move-flat";
    const movementText = movement > 0 ? `▲ ${movement}` : movement < 0 ? `▼ ${Math.abs(movement)}` : "—";
    const chip = chipInfo(row.active_chip);
    const chipHtml = chip ? `<span class="chip-badge ${chip.cls}" title="${escapeHtml(chip.full)}">${chip.label}</span>` : "";
    const chipRowClass = chip ? `chip-row-${chip.cls}` : "";
    const podiumClass = Number(row.rank) <= 3 ? "podium-row" : "";
    const hitCost = Number(row.hit_cost || 0);
    const hitHtml = hitCost > 0 ? `<span class="hit-badge" title="Transfer hit: -${hitCost} points">-${hitCost}</span>` : "";

    return `<tr class="${podiumClass} ${chipRowClass}">
      <td><div class="rank-cell"><span class="rank-disc ${Number(row.rank) === 1 ? "first" : ""}">${fmt(row.rank)}</span></div></td>
      <td class="team-name" title="${escapeHtml(row.team)}">${escapeHtml(row.team)}</td>
      <td title="${escapeHtml(row.manager)}">${escapeHtml(row.manager)}</td>
      <td class="num"><div class="gw-score-cell"><span class="score-num">${fmt(row.gw_points)}</span>${hitHtml}</div></td>
      <td class="num score-num">${fmt(row.total)}</td>
      <td class="num ${movementClass}">${movementText}</td>
      <td>${chipHtml}</td>
    </tr>`;
  }).join("");
}

function renderChipKey(rows) {
  const active = rows.filter((row) => row.active_chip);
  const usedNames = [...new Set(active.map((row) => row.active_chip))];
  const key = byId("chipKey");

  setText("chipSummary", active.length === 0 ? "No chips active" : `${active.length} chip${active.length === 1 ? "" : "s"} active`);
  key.innerHTML = usedNames.map((name) => {
    const chip = chipInfo(name);
    const count = active.filter((row) => row.active_chip === name).length;
    return `<span class="chip-pill ${chip.cls}" title="${escapeHtml(chip.full)}">${chip.label}${count > 1 ? ` ×${count}` : ""}</span>`;
  }).join("");
}

function renderCaptainDonut(items) {
  const donut = byId("captainDonut");
  const legend = byId("captainLegend");

  if (!items.length) {
    donut.style.background = "#ece8ef";
    legend.innerHTML = '<span class="legend-empty">Captain data unavailable</span>';
    return;
  }

  const displayed = items.slice(0, 4).map((item) => ({ ...item, percent: Math.max(0, Number(item.percent) || 0) }));
  const displayedTotal = displayed.reduce((sum, item) => sum + item.percent, 0);
  if (displayedTotal < 99.5) displayed.push({ name: "Other", percent: 100 - displayedTotal });

  let start = 0;
  const stops = [];
  displayed.forEach((item, index) => {
    const end = Math.min(100, start + item.percent);
    stops.push(`${CHART_COLOURS[index % CHART_COLOURS.length]} ${start}% ${end}%`);
    start = end;
  });
  if (start < 100) stops.push(`#e9e5ec ${start}% 100%`);

  donut.style.background = `conic-gradient(${stops.join(",")})`;
  donut.title = displayed.map((item) => `${item.name}: ${Math.round(item.percent)}%`).join(" · ");
  legend.innerHTML = displayed.map((item, index) => `<div class="legend-item">
    <span class="legend-swatch" style="background:${CHART_COLOURS[index % CHART_COLOURS.length]}"></span>
    <span class="legend-name">${escapeHtml(item.name)}</span>
    <span class="legend-value">${pct(item.percent)}</span>
  </div>`).join("");
}

function renderFormLeader(summary) {
  const form = summary.form_leader || summary.manager_of_month || {};
  const gameweeks = Number(form.gameweeks || 0);

  setText("formTitle", gameweeks >= 4 ? "4-GW form leader" : "Early form leader");
  setText("formName", form.manager || form.team);
  setText("formPoints", `${fmt(form.points)} pts`);
  setText("formDetail", gameweeks > 0 ? `${form.team || "League form"} · last ${gameweeks} GW${gameweeks === 1 ? "" : "s"}` : "form data unavailable");
}

function renderMovers(summary, rows) {
  const calculated = calculateLeagueMetrics(rows);
  const climber = summary.biggest_climber || {};
  const faller = summary.biggest_faller || {};
  const hasMovement = Boolean(summary.has_rank_movement ?? rows.some((row) => Number(row.movement) !== 0));
  const upperRow = byId("upperMoverRow");
  const lowerRow = byId("lowerMoverRow");

  upperRow.className = "mover-row up";
  lowerRow.className = "mover-row down";

  if (hasMovement && (Number(climber.movement) > 0 || Number(faller.movement) < 0)) {
    setText("moversTitle", "Biggest movers");
    setText("bigUp", Number(climber.movement) > 0 ? `▲ ${climber.movement}` : "—");
    setText("bigUpName", Number(climber.movement) > 0 ? climber.team : "No climber");
    setText("bigDown", Number(faller.movement) < 0 ? `▼ ${Math.abs(faller.movement)}` : "—");
    setText("bigDownName", Number(faller.movement) < 0 ? faller.team : "No faller");
    return;
  }

  upperRow.className = "mover-row neutral";
  lowerRow.className = "mover-row neutral";
  setText("moversTitle", "League spread");
  setText("bigUp", `${fmt(summary.lead_gap ?? calculated.leadGap)} pts`);
  setText("bigUpName", "1st to 2nd");
  setText("bigDown", `${fmt(summary.league_spread ?? calculated.leagueSpread)} pts`);
  setText("bigDownName", "1st to last");
}

function renderPerformanceChart(chart, standings) {
  const labels = chart?.labels || [];
  const series = chart?.series || [];

  if (labels.length < 2) {
    setText("performanceTitle", "Current gameweek scores");
    setText("performanceNote", "(top 6)");
    const items = series.length ? series.map((item) => ({ name: item.name, value: Number(item.values?.[0]) || 0 })) : standings.slice(0, 6).map((row) => ({ name: row.team, value: Number(row.gw_points) || 0 }));
    renderHorizontalBarChart("performanceChart", items, { suffix: " pts", reverse: false });
    return;
  }

  setText("performanceTitle", "Gameweek performance");
  setText("performanceNote", `(top 6 · last ${labels.length} GW)`);
  renderLineChart("performanceChart", chart, false);
}

function renderPositionChart(chart, standings) {
  const labels = chart?.labels || [];

  if (labels.length < 2) {
    setText("positionTitle", "Gap to leader");
    setText("positionNote", "(top 6)");
    const leaderTotal = Math.max(...standings.map((row) => Number(row.total) || 0), 0);
    const items = standings.slice(0, 6).map((row) => ({ name: row.team, value: leaderTotal - (Number(row.total) || 0) }));
    renderHorizontalBarChart("positionChart", items, { suffix: " pts", reverse: true, zeroLabel: "Leader" });
    return;
  }

  setText("positionTitle", "League position trend");
  setText("positionNote", `(top 6 · last ${labels.length} GW)`);
  renderLineChart("positionChart", chart, true);
}

function renderHorizontalBarChart(id, items, options = {}) {
  const host = byId(id);
  const cleanItems = items.slice(0, 6).filter((item) => Number.isFinite(Number(item.value)));

  if (!cleanItems.length) {
    host.innerHTML = '<div class="empty-state"><div><strong>Waiting for data</strong>This panel will populate after the next refresh.</div></div>';
    return;
  }

  const width = 620;
  const height = 205;
  const left = 128;
  const right = 50;
  const top = 12;
  const rowHeight = 30;
  const barWidth = width - left - right;
  const maxValue = Math.max(...cleanItems.map((item) => Number(item.value)), 1);
  let svg = `<svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" role="img">`;

  cleanItems.forEach((item, index) => {
    const value = Number(item.value) || 0;
    const y = top + index * rowHeight;
    const normalized = options.reverse ? (maxValue === 0 ? 1 : value / maxValue) : value / maxValue;
    const visualWidth = value === 0 ? 3 : Math.max(5, normalized * barWidth);
    const valueLabel = value === 0 && options.zeroLabel ? options.zeroLabel : `${options.reverse && value > 0 ? "-" : ""}${fmt(value)}${options.suffix || ""}`;

    svg += `<text x="0" y="${y + 12}" font-size="11" font-weight="700" fill="#322738">${escapeHtml(shorten(item.name, 20))}</text>`;
    svg += `<rect x="${left}" y="${y + 2}" width="${barWidth}" height="12" rx="6" fill="#f0edf3"/>`;
    svg += `<rect x="${left}" y="${y + 2}" width="${visualWidth}" height="12" rx="6" fill="${CHART_COLOURS[index % CHART_COLOURS.length]}"/>`;
    svg += `<text x="${width - 2}" y="${y + 12}" font-size="10" font-weight="800" text-anchor="end" fill="#4b4051">${escapeHtml(valueLabel)}</text>`;
  });

  svg += "</svg>";
  host.innerHTML = svg;
}

function renderLineChart(id, chart, invert) {
  const host = byId(id);
  if (!chart || !chart.labels?.length || !chart.series?.length) {
    host.innerHTML = '<div class="empty-state"><div><strong>Not enough history yet</strong>This chart will become more useful as gameweeks are completed.</div></div>';
    return;
  }

  const width = 620;
  const height = 205;
  const left = 42;
  const right = 150;
  const top = 14;
  const bottom = 28;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const values = chart.series.flatMap((series) => series.values.filter((value) => value !== null && value !== undefined).map(Number));

  if (!values.length) {
    host.innerHTML = '<div class="empty-state"><div><strong>Waiting for history</strong>No chart values are available yet.</div></div>';
    return;
  }

  let min = invert ? 1 : Math.min(0, Math.floor(Math.min(...values) / 10) * 10);
  let max = invert ? Math.max(...values, 2) : Math.ceil(Math.max(...values) / 10) * 10;
  if (max === min) max = min + 1;

  const x = (index) => left + (chart.labels.length === 1 ? plotWidth / 2 : index * plotWidth / (chart.labels.length - 1));
  const y = (value) => invert
    ? top + ((Number(value) - min) / (max - min)) * plotHeight
    : top + (1 - (Number(value) - min) / (max - min)) * plotHeight;

  let svg = `<svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" role="img">`;

  for (let index = 0; index < 4; index += 1) {
    const gridY = top + index * plotHeight / 3;
    const rawTick = invert ? min + index * (max - min) / 3 : max - index * (max - min) / 3;
    const tick = invert ? Math.max(1, Math.round(rawTick)) : Math.round(rawTick);
    svg += `<line x1="${left}" y1="${gridY}" x2="${left + plotWidth}" y2="${gridY}" stroke="#ebe7ee" stroke-width="1"/>`;
    svg += `<text x="${left - 7}" y="${gridY + 3}" font-size="8.5" text-anchor="end" fill="#837a87">${tick}</text>`;
  }

  chart.labels.forEach((label, index) => {
    svg += `<text x="${x(index)}" y="${height - 7}" font-size="8.5" text-anchor="middle" fill="#716978">${escapeHtml(String(label).replace("GW ", ""))}</text>`;
  });

  chart.series.slice(0, 6).forEach((series, seriesIndex) => {
    const points = series.values.map((value, index) => value === null || value === undefined ? null : [x(index), y(value)]).filter(Boolean);
    const colour = CHART_COLOURS[seriesIndex % CHART_COLOURS.length];

    if (points.length) {
      svg += `<polyline points="${points.map((point) => point.join(",")).join(" ")}" fill="none" stroke="${colour}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/>`;
      points.forEach((point) => {
        svg += `<circle cx="${point[0]}" cy="${point[1]}" r="3" fill="${colour}" stroke="#fff" stroke-width="1"/>`;
      });
    }

    const legendY = 20 + seriesIndex * 27;
    svg += `<circle cx="${left + plotWidth + 17}" cy="${legendY}" r="4" fill="${colour}"/>`;
    svg += `<text x="${left + plotWidth + 28}" y="${legendY + 3}" font-size="9.5" font-weight="600" fill="#322738">${escapeHtml(shorten(series.name, 20))}</text>`;
  });

  svg += `<text x="${left + plotWidth / 2}" y="${height - 1}" font-size="7.5" text-anchor="middle" fill="#8a818d">GAMEWEEK</text>`;
  svg += "</svg>";
  host.innerHTML = svg;
}

function renderWinners(items, standings, gameweek) {
  const host = byId("gwWinners");
  let rows;

  if (items.length <= 1) {
    setText("winnersTitle", "Current GW podium");
    rows = [...standings]
      .sort((a, b) => Number(b.gw_points) - Number(a.gw_points) || Number(a.rank) - Number(b.rank))
      .slice(0, 3)
      .map((row, index) => ({
        label: `${ordinal(index + 1)} · GW ${gameweek || "—"}`,
        name: row.manager || row.team,
        points: row.gw_points,
        medal: index + 1
      }));
  } else {
    setText("winnersTitle", "Recent GW winners");
    rows = items.slice(0, 4).map((winner) => ({
      label: `GW ${winner.gameweek} · ${winner.team || ""}`,
      name: winner.manager || winner.team,
      points: winner.points,
      medal: "🏅"
    }));
  }

  if (!rows.length) {
    host.innerHTML = '<div class="empty-state"><div><strong>No winner yet</strong>Gameweek winners will appear here.</div></div>';
    return;
  }

  host.innerHTML = rows.map((row) => `<div class="winner-row">
    <span class="medal">${row.medal}</span>
    <div><small>${escapeHtml(row.label)}</small><strong>${escapeHtml(row.name)}</strong></div>
    <b>${fmt(row.points)} pts</b>
  </div>`).join("");
}

function shorten(value, length) {
  const text = String(value ?? "");
  return text.length > length ? `${text.slice(0, Math.max(1, length - 1))}…` : text;
}

function ordinal(value) {
  const suffixes = ["th", "st", "nd", "rd"];
  const remainder = value % 100;
  return `${value}${suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0]}`;
}

loadDashboard();
setInterval(loadDashboard, 5 * 60 * 1000);
setInterval(() => {
  if (latestData?.generated_at) renderFreshness(latestData.generated_at);
}, 60 * 1000);
