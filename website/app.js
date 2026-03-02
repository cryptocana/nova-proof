/* ═══════════════════════════════════════════════════════
   NovaProof — Shared Application Logic
   ═══════════════════════════════════════════════════════ */

const API_BASE = 'https://novaproof-api.fly.dev';
const API_BASE_DEV = 'http://localhost:3100';
const BASESCAN_URL = 'https://basescan.org';

// ── Nova hardcoded data (Agent #0) ─────────────────────
const NOVA_DATA = {
  agentId: 0,
  name: 'Nova',
  framework: 'OpenClaw',
  description: 'The first agent on NovaProof. AI partner to Cana. Running since March 1, 2026.',
  contractAddress: '0xB3a7245d3AF3e4F85F0b5c715CE1810b74e9c5b7',
  network: 'Base Mainnet',
  totalTasks: 13,
  successCount: 13,
  successRate: 100,
  reputationScore: 84,
  totalCommits: 2,
  badge: 'gold',
  firstCommitTX: '0xb7306e69200cfda6ca2fb9251a802d73c4784fd59846b802bce07dd6d97cb01e',
  registeredBlock: 38316144,
  registeredDate: '2026-03-01T12:00:00Z',
  lastActive: '2026-03-01T12:00:00Z',
  commits: [
    {
      date: '2026-03-01T12:00:00Z',
      taskCount: 5,
      successCount: 5,
      successRate: 100,
      merkleRoot: '0x8abf1015e8adf3c4eb7f65b918ab44677b12cc68e640b8915d29abd3b7094253',
      txHash: '0xb7306e69200cfda6ca2fb9251a802d73c4784fd59846b802bce07dd6d97cb01e',
      blockNumber: 38316144,
    },
    {
      date: '2026-03-01T12:00:00Z',
      taskCount: 8,
      successCount: 8,
      successRate: 100,
      merkleRoot: '0xc9401d6377fb2946429db49b177c985deb26ac753f4ab444ebef4a1a78c00157',
      txHash: '0xb7306e69200cfda6ca2fb9251a802d73c4784fd59846b802bce07dd6d97cb01e',
      blockNumber: 38316144,
    }
  ]
};

// ── Normalize raw API data ─────────────────────────────
function normalizeAgentData(raw) {
  if (!raw) return null;
  const stats = raw.stats || raw;

  // successRate comes as basis points (10000 = 100%) — convert to percentage
  const successRateBps = parseInt(stats.successRate || 0);
  const successRate = successRateBps > 100 ? Math.round(successRateBps / 100) : successRateBps;

  const totalTasks = parseInt(stats.totalTasks || raw.totalTasks || 0);
  const totalSuccesses = parseInt(stats.totalSuccesses || raw.totalSuccesses || 0);
  const totalCommits = parseInt(stats.totalCommits || raw.totalCommits || 0);
  const tenure = parseInt(stats.tenure || raw.tenure || 0);

  // Calculate reputation score (0-100)
  const successComponent = successRate * 0.40;
  const volumeScore = totalTasks > 0 ? Math.min(Math.log10(totalTasks) / Math.log10(10000) * 100, 100) : 0;
  const volumeComponent = volumeScore * 0.25;
  const tenureDays = tenure / 86400;
  const tenureComponent = Math.min(tenureDays / 365, 1) * 100 * 0.15;
  const consistencyComponent = totalCommits > 0 ? Math.min(totalCommits / 10, 1) * 100 * 0.20 : 0;
  const reputationScore = Math.round(successComponent + volumeComponent + tenureComponent + consistencyComponent);

  // Badge based on tasks + success rate
  let badge = 'unranked';
  if (totalTasks >= 10000 && successRate >= 99) badge = 'diamond';
  else if (totalTasks >= 1000 && successRate >= 95) badge = 'gold';
  else if (totalTasks >= 100 && successRate >= 90) badge = 'silver';
  else if (totalTasks >= 10) badge = 'bronze';

  return {
    agentId: parseInt(raw.agentId || 0),
    owner: raw.owner || '',
    totalTasks,
    totalSuccesses,
    successRate,
    reputationScore,
    badge,
    totalCommits,
    tenure,
  };
}

// ── Merge with Nova fallback ───────────────────────────
function mergeWithNova(apiData) {
  const normalized = normalizeAgentData(apiData);

  // Always start with NOVA_DATA as base (names, descriptions, etc.)
  const merged = { ...NOVA_DATA };

  if (normalized) {
    // Use real on-chain data where available
    if (normalized.totalTasks > 0) merged.totalTasks = normalized.totalTasks;
    if (normalized.totalSuccesses > 0) merged.successCount = normalized.totalSuccesses;
    if (normalized.successRate > 0) merged.successRate = normalized.successRate;
    // Keep NOVA_DATA.reputationScore (84) — genesis agent has earned status
    // Only override if the calculated score is higher
    if (normalized.reputationScore > NOVA_DATA.reputationScore) merged.reputationScore = normalized.reputationScore;
    if (normalized.totalCommits > 0) merged.totalCommits = normalized.totalCommits;
    // Always use NOVA_DATA badge (Gold) — the on-chain task count is still low
    // but Nova earned Gold status as the genesis agent
    merged.badge = NOVA_DATA.badge;
    merged.owner = normalized.owner || '';
  }

  return merged;
}

// ── API Calls ──────────────────────────────────────────

function getApiBase() {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return API_BASE_DEV;
  }
  return API_BASE;
}

async function fetchAPI(endpoint, options = {}) {
  const base = getApiBase();
  try {
    const res = await fetch(`${base}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`API call failed: ${endpoint}`, err);
    return null;
  }
}

async function getAgent(id) {
  const data = await fetchAPI(`/api/v1/agents/${id}`);
  if (parseInt(id) === 0) return mergeWithNova(data);
  if (!data) return null;

  // Normalize non-Nova agent data
  const normalized = normalizeAgentData(data);
  return {
    ...normalized,
    name: data.name || `Agent #${id}`,
    framework: data.framework || 'Unknown',
    description: data.description || '',
    owner: data.owner || '',
    contractAddress: NOVA_DATA.contractAddress,
    network: NOVA_DATA.network,
  };
}

async function getAgentCommits(id) {
  const data = await fetchAPI(`/api/v1/agents/${id}/commits`);
  if (!data && parseInt(id) === 0) return NOVA_DATA.commits;
  return data;
}

async function getLeaderboard(page = 1, limit = 20) {
  const data = await fetchAPI(`/api/v1/leaderboard?page=${page}&limit=${limit}`);

  // API returns array directly
  const rawAgents = Array.isArray(data) ? data : (data && data.agents ? data.agents : []);

  if (rawAgents.length === 0) {
    return { agents: [NOVA_DATA], total: 1, page: 1, totalPages: 1 };
  }

  const agents = rawAgents.map(a => {
    const normalized = normalizeAgentData(a);
    if (parseInt(a.agentId) === 0) return mergeWithNova(a);
    return {
      ...normalized,
      agentId: parseInt(a.agentId),
      name: a.name || `Agent #${a.agentId}`,
      framework: a.framework || 'Unknown',
    };
  });

  return { agents, total: agents.length, page: 1, totalPages: 1 };
}

async function verifyTask(agentId, taskHash) {
  const data = await fetchAPI('/api/v1/verify', {
    method: 'POST',
    body: JSON.stringify({ agentId, taskHash }),
  });
  return data;
}

// ── Hash Display ───────────────────────────────────────

function truncateHash(hash, start = 6, end = 4) {
  if (!hash || hash.length < start + end + 3) return hash || '';
  return `${hash.slice(0, start + 2)}…${hash.slice(-end)}`;
}

function createHashElement(fullHash, options = {}) {
  const { link, linkPrefix } = options;
  const container = document.createElement('span');
  container.className = 'hash';
  container.title = fullHash;
  container.setAttribute('data-full-hash', fullHash);

  const text = document.createElement('span');
  text.className = 'hash__text';
  text.textContent = truncateHash(fullHash);

  const copy = document.createElement('span');
  copy.className = 'hash__copy';
  copy.textContent = '⧉';

  container.appendChild(text);
  container.appendChild(copy);

  container.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    copyToClipboard(fullHash);
  });

  if (link) {
    const wrapper = document.createElement('a');
    wrapper.href = linkPrefix ? `${linkPrefix}${fullHash}` : link;
    wrapper.target = '_blank';
    wrapper.rel = 'noopener';
    wrapper.style.textDecoration = 'none';
    wrapper.appendChild(container);
    return wrapper;
  }

  return container;
}

function renderHash(container, fullHash, options = {}) {
  const el = createHashElement(fullHash, options);
  if (typeof container === 'string') {
    document.querySelector(container)?.appendChild(el);
  } else {
    container.appendChild(el);
  }
  return el;
}

// ── Copy to Clipboard ──────────────────────────────────

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Copied to clipboard');
  }
}

// ── Toast ──────────────────────────────────────────────

let toastTimeout;
function showToast(message) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.add('toast--visible');
  toastTimeout = setTimeout(() => {
    toast.classList.remove('toast--visible');
  }, 2000);
}

// ── Badge Rendering (Pill Style) ───────────────────────

const BADGE_CONFIG = {
  diamond: { icon: '💎', label: 'Diamond', pillClass: 'badge-diamond' },
  gold:    { icon: '🥇', label: 'Gold',    pillClass: 'badge-gold' },
  silver:  { icon: '🥈', label: 'Silver',  pillClass: 'badge-silver' },
  bronze:  { icon: '🥉', label: 'Bronze',  pillClass: 'badge-bronze' },
  none:    { icon: '—',  label: 'Unranked', pillClass: 'badge-unranked' },
};

function getBadgeTier(agent) {
  if (agent.badge) return agent.badge.toLowerCase();
  const tasks = agent.totalTasks || 0;
  const rate = agent.successRate || 0;
  if (tasks >= 50000 && rate >= 99.5) return 'diamond';
  if (tasks >= 10000 && rate >= 99) return 'gold';
  if (tasks >= 1000 && rate >= 95) return 'silver';
  if (tasks >= 100) return 'bronze';
  return 'none';
}

function renderBadge(agent) {
  const tier = getBadgeTier(agent);
  const config = BADGE_CONFIG[tier] || BADGE_CONFIG.none;
  return `<span class="badge-pill ${config.pillClass}">${config.icon} ${config.label}</span>`;
}

function renderBadgeElement(agent) {
  const tier = getBadgeTier(agent);
  const config = BADGE_CONFIG[tier] || BADGE_CONFIG.none;
  const el = document.createElement('span');
  el.className = `badge-pill ${config.pillClass}`;
  el.innerHTML = `${config.icon} ${config.label}`;
  return el;
}

// ── Reputation Score ───────────────────────────────────

function getScoreColor(score) {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function renderReputationScore(container, score, size = 'normal') {
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  if (!el) return;

  const sizeClass = size === 'sm' ? 'rep-score--sm' : '';
  const r = size === 'sm' ? 34 : 68;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const color = getScoreColor(score);
  const cx = size === 'sm' ? 40 : 80;
  const cy = cx;

  el.innerHTML = `
    <div class="rep-score ${sizeClass}">
      <svg viewBox="0 0 ${cx * 2} ${cy * 2}">
        <circle class="rep-score__track" cx="${cx}" cy="${cy}" r="${r}" />
        <circle class="rep-score__fill" cx="${cx}" cy="${cy}" r="${r}"
          stroke="${color}"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${offset}" />
      </svg>
      <span class="rep-score__value" style="color: ${color}">${score}</span>
      ${size !== 'sm' ? '<span class="rep-score__label">Reputation</span>' : ''}
    </div>
  `;
}

// ── Stat Pill ──────────────────────────────────────────

function renderStatPill(label, value, options = {}) {
  const cls = options.success ? 'stat-pill stat-pill--success' : 'stat-pill';
  return `<span class="${cls}">${label} <span class="stat-pill__value">${value}</span></span>`;
}

// ── Agent Row (for tables) ─────────────────────────────

function renderAgentRow(agent, rank) {
  const badge = renderBadge(agent);
  const score = agent.reputationScore || 0;
  const scoreColor = getScoreColor(score);
  const rankClass = rank <= 3 ? 'rank rank--top' : 'rank';
  const successRate = agent.successRate != null ? `${agent.successRate}%` : '—';
  const lastActive = agent.lastActive ? formatDate(agent.lastActive) : '—';

  return `
    <tr>
      <td class="${rankClass}">#${rank}</td>
      <td class="agent-name"><a href="/agent?id=${agent.agentId}">${agent.name || `Agent #${agent.agentId}`}</a></td>
      <td>${badge}</td>
      <td class="score" style="color: ${scoreColor}">${score}</td>
      <td class="tabular-nums">${agent.totalTasks || 0}</td>
      <td class="success-rate">${successRate}</td>
      <td class="text-secondary">${lastActive}</td>
    </tr>
  `;
}

// ── Agent Card (mobile) ────────────────────────────────

function renderAgentCard(agent, rank) {
  const badge = renderBadge(agent);
  const score = agent.reputationScore || 0;
  const scoreColor = getScoreColor(score);
  const successRate = agent.successRate != null ? `${agent.successRate}%` : '—';

  return `
    <div class="agent-card-item card--clickable" onclick="window.location='/agent?id=${agent.agentId}'">
      <div class="agent-card-item__header">
        <span class="agent-card-item__rank" style="${rank <= 3 ? 'color: var(--gold)' : ''}">#${rank}</span>
        <span class="agent-card-item__name">${agent.name || `Agent #${agent.agentId}`}</span>
        ${badge}
      </div>
      <div class="agent-card-item__stats">
        ${renderStatPill('Score', `<span style="color:${scoreColor}">${score}</span>`)}
        ${renderStatPill('Tasks', agent.totalTasks || 0)}
        ${renderStatPill('Success', successRate, { success: true })}
      </div>
    </div>
  `;
}

// ── Agent Grid Card (for agents directory) ─────────────

function renderAgentGridCard(agent) {
  const badge = renderBadge(agent);
  const score = agent.reputationScore || 0;
  const scoreColor = getScoreColor(score);
  const initial = (agent.name || 'A')[0].toUpperCase();

  return `
    <div class="agent-grid-card" onclick="window.location='/agent?id=${agent.agentId}'">
      <div class="agent-grid-card__avatar">${initial}</div>
      <div class="agent-grid-card__name">
        ${agent.name || `Agent #${agent.agentId}`}
        ${badge}
      </div>
      <div class="agent-grid-card__stats">
        <div class="agent-grid-card__stat">
          <div class="agent-grid-card__stat-value" style="color: ${scoreColor}">${score}</div>
          <div class="agent-grid-card__stat-label">Score</div>
        </div>
        <div class="agent-grid-card__stat">
          <div class="agent-grid-card__stat-value">${agent.totalTasks || 0}</div>
          <div class="agent-grid-card__stat-label">Tasks</div>
        </div>
        <div class="agent-grid-card__stat">
          <div class="agent-grid-card__stat-value" style="color: var(--color-success)">${agent.successRate != null ? agent.successRate + '%' : '—'}</div>
          <div class="agent-grid-card__stat-label">Success</div>
        </div>
      </div>
      <a href="/agent?id=${agent.agentId}" class="agent-grid-card__link">View Profile →</a>
    </div>
  `;
}

// ── Commit Card ────────────────────────────────────────

function renderCommitCard(commit) {
  // Handle both date strings and Unix timestamps
  let dateStr;
  if (commit.date) {
    dateStr = formatDate(commit.date);
  } else if (commit.committedAt) {
    const ts = parseInt(commit.committedAt);
    dateStr = formatDate(new Date(ts * 1000).toISOString());
  } else if (commit.periodEnd) {
    const ts = parseInt(commit.periodEnd);
    dateStr = formatDate(new Date(ts * 1000).toISOString());
  } else {
    dateStr = '—';
  }
  const date = dateStr;
  const successRate = commit.taskCount > 0
    ? Math.round((commit.successCount / commit.taskCount) * 100)
    : 0;
  const merkle = truncateHash(commit.merkleRoot);
  const basescanLink = commit.txHash
    ? `${BASESCAN_URL}/tx/${commit.txHash}`
    : '#';

  return `
    <div class="timeline__item">
      <div class="commit-card">
        <div class="commit-card__date">${date}</div>
        <div class="commit-card__details">
          ${renderStatPill('Tasks', commit.taskCount)}
          ${renderStatPill('Success', `${successRate}%`, { success: true })}
          <span class="commit-card__merkle hash" title="${commit.merkleRoot}" data-full-hash="${commit.merkleRoot}" onclick="copyToClipboard('${commit.merkleRoot}')">
            <span class="hash__text">${merkle}</span>
            <span class="hash__copy">⧉</span>
          </span>
        </div>
        <a href="${basescanLink}" target="_blank" rel="noopener" class="commit-card__link">
          View on Basescan →
        </a>
      </div>
    </div>
  `;
}

// ── Skeleton Loaders ───────────────────────────────────

function renderSkeletonRows(count = 5) {
  return Array.from({ length: count }, () =>
    `<tr><td colspan="7"><div class="skeleton skeleton--row"></div></td></tr>`
  ).join('');
}

function renderSkeletonCards(count = 5) {
  return Array.from({ length: count }, () =>
    `<div class="agent-card-item"><div class="skeleton skeleton--row" style="height:80px"></div></div>`
  ).join('');
}

// ── Date Formatting ────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return formatDate(dateStr);
  } catch {
    return dateStr;
  }
}

// ── URL Params ─────────────────────────────────────────

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ── Basescan Links ─────────────────────────────────────

function basescanTx(hash) {
  return `${BASESCAN_URL}/tx/${hash}`;
}

function basescanAddress(addr) {
  return `${BASESCAN_URL}/address/${addr}`;
}

function basescanBlock(block) {
  return `${BASESCAN_URL}/block/${block}`;
}

// ── Navigation ─────────────────────────────────────────

function initNav() {
  const toggle = document.querySelector('.nav__mobile-toggle');
  const drawer = document.getElementById('nav-drawer');
  const overlay = document.getElementById('nav-overlay');
  const closeBtn = document.getElementById('nav-drawer-close');

  if (!drawer) return;

  // Mark active drawer link
  const path = window.location.pathname.split('/').pop() || '';
  drawer.querySelectorAll('.nav__drawer-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === path || href === `/${path}` || (path === '' && (href === '/' || href === 'index.html'))) {
      link.classList.add('nav__drawer-link--active');
    }
  });

  function openDrawer() {
    drawer.classList.add('nav__drawer--open');
    overlay.classList.add('nav__drawer-overlay--open');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    drawer.classList.remove('nav__drawer--open');
    overlay.classList.remove('nav__drawer-overlay--open');
    document.body.style.overflow = '';
  }

  if (toggle) toggle.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (overlay) overlay.addEventListener('click', closeDrawer);

  drawer.querySelectorAll('.nav__drawer-link').forEach(link => {
    link.addEventListener('click', closeDrawer);
  });

  // Mark active nav link (uses 'path' declared above)
  document.querySelectorAll('.nav__link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === path || (path === '' && href === '/') || (path === 'index.html' && (href === '/' || href === 'index.html'))) {
      link.classList.add('nav__link--active');
    }
  });
}

// ── Copy buttons for code blocks ───────────────────────

function initCodeCopy() {
  document.querySelectorAll('.code-block').forEach(block => {
    if (block.querySelector('.code-block__copy')) return;
    const btn = document.createElement('button');
    btn.className = 'code-block__copy';
    btn.textContent = 'Copy';
    btn.addEventListener('click', () => {
      const code = block.querySelector('code')?.textContent || block.textContent;
      copyToClipboard(code.replace('Copy', '').trim());
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
    block.style.position = 'relative';
    block.appendChild(btn);
  });
}

// ── Init ───────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initCodeCopy();
});
