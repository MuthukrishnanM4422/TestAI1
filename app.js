/* ═══════════════════════════════════════════════════════════════
   BRD Test Case Generator — Enhanced app.js
   ═══════════════════════════════════════════════════════════════ */

const TYPE_META = {
  Positive:  { color: '#22d3a0', bg: 'rgba(34,211,160,.12)',  glow: 'rgba(34,211,160,.15)',  icon: '✓' },
  Negative:  { color: '#f05555', bg: 'rgba(240,85,85,.12)',   glow: 'rgba(240,85,85,.15)',   icon: '✗' },
  Edge:      { color: '#f59e0b', bg: 'rgba(245,158,11,.12)',  glow: 'rgba(245,158,11,.15)',  icon: '◈' },
  Boundary:  { color: '#9b7bff', bg: 'rgba(155,123,255,.12)', glow: 'rgba(155,123,255,.15)', icon: '⬡' },
  Security:  { color: '#06d6e0', bg: 'rgba(6,214,224,.12)',   glow: 'rgba(6,214,224,.15)',   icon: '⚿' },
};

const PRIORITY_META = {
  High:   { color: '#f05555' },
  Medium: { color: '#f59e0b' },
  Low:    { color: '#6b7280' },
};

// ── State ─────────────────────────────────────────────────────
let allTestCases     = [];
let allRequirements  = [];
let expandedIndex    = null;
let editingCell      = null;

const enabledTypes = new Set(['Positive', 'Negative', 'Edge']);
const typeCounts   = { Positive: 3, Negative: 3, Edge: 2, Boundary: 1, Security: 1 };

// ── Smart API URL ─────────────────────────────────────────────
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : '';

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildTypeGrid();
  const brdEl = document.getElementById('brdText');
  brdEl.addEventListener('input', () => {
    document.getElementById('charCount').textContent = brdEl.value.length.toLocaleString();
  });

  const zone = document.getElementById('uploadZone');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('has-file'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('has-file'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  });
});

// ── Tab switching ─────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  document.getElementById('tab-input').style.display   = tab === 'input'   ? '' : 'none';
  document.getElementById('tab-results').style.display = tab === 'results' ? '' : 'none';
}

// ── Type grid ─────────────────────────────────────────────────
function buildTypeGrid() {
  const grid = document.getElementById('typeGrid');
  grid.innerHTML = '';
  Object.entries(TYPE_META).forEach(([type, meta]) => {
    const active = enabledTypes.has(type);
    const card = document.createElement('div');
    card.className = `type-card ${active ? 'active' : 'inactive'}`;
    card.id = `tc-${type}`;
    card.style.setProperty('--card-color', meta.color);
    card.style.setProperty('--card-bg',    meta.bg);
    card.style.setProperty('--card-glow',  meta.glow);

    // Increase max to 50 for Positive/Negative, 30 for others
    const maxVal = (type === 'Positive' || type === 'Negative') ? 50 : 30;

    card.innerHTML = `
      <div class="type-card-header">
        <span class="type-card-name">${meta.icon} ${type}</span>
        <span class="type-checkbox">${active ? '✓' : ''}</span>
      </div>
      <div class="type-count-row">
        <input type="number" class="type-count-input" min="1" max="${maxVal}"
               value="${typeCounts[type]}" id="cnt-${type}"
               onclick="event.stopPropagation()"
               onchange="typeCounts['${type}'] = +this.value" />
        <span class="type-count-label">cases</span>
      </div>`;

    card.addEventListener('click', () => toggleType(type));
    grid.appendChild(card);
  });
}

function toggleType(type) {
  if (enabledTypes.has(type)) {
    enabledTypes.delete(type);
  } else {
    enabledTypes.add(type);
  }
  const card = document.getElementById(`tc-${type}`);
  const active = enabledTypes.has(type);
  card.className = `type-card ${active ? 'active' : 'inactive'}`;
  card.querySelector('.type-checkbox').textContent = active ? '✓' : '';
}

// ── File upload ───────────────────────────────────────────────
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}

async function processFile(file) {
  const zone = document.getElementById('uploadZone');
  const sub  = document.getElementById('fileName');

  try {
    let text = '';
    if (file.name.endsWith('.txt')) {
      text = await file.text();
    } else if (file.name.endsWith('.pdf')) {
      text = await extractPdfText(file);
    } else if (file.name.endsWith('.docx')) {
      text = await extractDocxText(file);
    } else {
      showError('Unsupported format. Use .txt, .pdf, or .docx');
      return;
    }
    document.getElementById('brdText').value = text.trim();
    document.getElementById('charCount').textContent = text.length.toLocaleString();
    zone.classList.add('has-file');
    zone.querySelector('.upload-icon').textContent = '📄';
    sub.textContent = `✓ ${file.name}`;
    hideError();
  } catch (err) {
    showError('File read error: ' + err.message);
  }
}

async function extractPdfText(file) {
  const ab  = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
  let full  = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    full += content.items.map(item => item.str).join(' ') + '\n';
  }
  return full;
}

async function extractDocxText(file) {
  const ab     = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: ab });
  return result.value;
}

// ── Build prompt ──────────────────────────────────────────────
function buildPrompt(brdText, model) {
  const activeTypes = [...enabledTypes];
  const typeLine = activeTypes.map(t => `${typeCounts[t]} ${t}`).join(', ');

  return `You are a senior QA engineer. Analyze the Business Requirements Document (BRD) below and:

1. Extract exactly 6–10 concise requirement statements (plain strings).
2. Generate test cases: ${typeLine}.

Each test case object must have ALL of these fields:
- id          : string — "TC-P01" (P=Positive), "TC-N01" (N=Negative), "TC-E01" (E=Edge), "TC-B01" (B=Boundary), "TC-S01" (S=Security). Auto-increment per type.
- type        : one of ${activeTypes.map(t => `"${t}"`).join(', ')}
- priority    : "High" | "Medium" | "Low"
- scenario    : clear concise title (max 12 words)
- preconditions: system state / setup needed before the test
- steps       : numbered test steps as a single string (1. Do X\\n2. Do Y…)
- testData    : specific input values or data sets
- expectedOutcome: exact expected result if system works correctly
- relatedReq  : reference to which requirement this covers (e.g. "REQ-001")
- comments    : assumptions, risks, or edge-case notes

BRD Content:
"""
${brdText.slice(0, 9000)}
"""

CRITICAL: Return ONLY a single valid JSON object — no markdown, no backticks, no extra text.
Format:
{
  "requirements": ["string", ...],
  "testCases": [{ all fields above }, ...]
}`;
}

// ── Progress helpers ──────────────────────────────────────────
let progressTimer = null;

function startProgress() {
  const steps = ['pstep0','pstep1','pstep2','pstep3'];
  const bar   = document.getElementById('progressBar');
  let step    = 0;

  steps.forEach(id => {
    const el = document.getElementById(id);
    el.className = 'p-step';
    el.textContent = '⬡ ' + el.textContent.replace(/^[✓⬡·] /, '');
  });
  bar.style.width = '0%';

  const labels = [
    'Parsing BRD content…',
    'Identifying requirements…',
    'Designing test scenarios…',
    'Structuring test cases…',
  ];

  progressTimer = setInterval(() => {
    if (step > 0) {
      const prev = document.getElementById(steps[step - 1]);
      prev.className = 'p-step done';
      prev.textContent = '✓ ' + prev.textContent.replace(/^[⬡·✓] /, '');
    }
    if (step < steps.length) {
      const cur = document.getElementById(steps[step]);
      cur.className = 'p-step active';
      document.getElementById('progressLabel').textContent = labels[step];
      bar.style.width = `${((step + 1) / steps.length) * 90}%`;
      step++;
    } else {
      clearInterval(progressTimer);
    }
  }, 1800);
}

function finishProgress() {
  clearInterval(progressTimer);
  document.getElementById('progressBar').style.width = '100%';
  ['pstep0','pstep1','pstep2','pstep3'].forEach(id => {
    const el = document.getElementById(id);
    el.className = 'p-step done';
  });
}

// ── Generate ──────────────────────────────────────────────────
async function generateTestCases() {
  const brdText = document.getElementById('brdText').value.trim();
  if (!brdText) { showError('Please enter or upload BRD content.'); return; }
  if (enabledTypes.size === 0) { showError('Enable at least one test case type.'); return; }

  hideError();
  setGenerating(true);
  allTestCases    = [];
  allRequirements = [];

  const model  = document.getElementById('modelSelect').value;
  const prompt = buildPrompt(brdText, model);

  try {
    const res = await fetch(`${API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.3,          // fixed optimal temperature
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    const data    = await res.json();
    const rawText = data.choices[0].message.content;

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Model returned unexpected format. Try again.');

    const parsed = JSON.parse(jsonMatch[0]);
    allTestCases    = (parsed.testCases    || []);
    allRequirements = (parsed.requirements || []);

    finishProgress();
    renderResults();
    setTimeout(() => switchTab('results'), 400);
  } catch (err) {
    finishProgress();
    showError('Generation failed: ' + err.message);
  } finally {
    setGenerating(false);
  }
}

function setGenerating(active) {
  const btn     = document.getElementById('generateBtn');
  const btnText = document.getElementById('generateBtnText');
  const progBox = document.getElementById('progressBox');

  btn.disabled = active;
  btnText.innerHTML = active
    ? '<span class="btn-spinner"></span> Generating…'
    : '✨ Generate Test Cases';
  progBox.style.display = active ? '' : 'none';
  if (active) startProgress();
}

// ── Render results ────────────────────────────────────────────
function renderResults() {
  const hasResults = allTestCases.length > 0;
  document.getElementById('emptyResults').style.display   = hasResults ? 'none' : '';
  document.getElementById('resultsContent').style.display = hasResults ? ''     : 'none';
  if (!hasResults) return;

  document.getElementById('resultsBadge').textContent = allTestCases.length;
  document.getElementById('resultsBadge').style.display = '';
  renderStats();
  renderRequirements();
  applyFilters();
}

function renderStats() {
  const row = document.getElementById('statsRow');
  row.innerHTML = '';

  const total = document.createElement('div');
  total.className = 'stat-card';
  total.style.setProperty('--stat-color', '#1d9bf0');
  total.innerHTML = `<div class="stat-val">${allTestCases.length}</div><div class="stat-label">Total</div>`;
  row.appendChild(total);

  Object.entries(TYPE_META).forEach(([type, meta]) => {
    const count = allTestCases.filter(t => t.type === type).length;
    if (!count) return;
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.style.setProperty('--stat-color', meta.color);
    card.innerHTML = `<div class="stat-val">${count}</div><div class="stat-label">${type}</div>`;
    row.appendChild(card);
  });
}

function renderRequirements() {
  const card  = document.getElementById('reqsCard');
  const chips = document.getElementById('reqsChips');
  if (!allRequirements.length) { card.style.display = 'none'; return; }
  card.style.display = '';
  chips.innerHTML = allRequirements
    .map(r => `<span class="req-chip">${escapeHtml(r)}</span>`)
    .join('');
}

// ── Filtering ─────────────────────────────────────────────────
function applyFilters() {
  const q       = (document.getElementById('searchInput').value || '').toLowerCase();
  const fType   = document.getElementById('filterType').value;
  const fPrio   = document.getElementById('filterPriority').value;

  const filtered = allTestCases.filter(tc => {
    if (fType !== 'All' && tc.type !== fType) return false;
    if (fPrio !== 'All' && tc.priority !== fPrio) return false;
    if (q) {
      const haystack = [tc.scenario, tc.testData, tc.expectedOutcome, tc.comments, tc.id]
        .join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  document.getElementById('filterCount').textContent =
    `${filtered.length} / ${allTestCases.length} shown`;
  renderTable(filtered);
}

// ── Table rendering ───────────────────────────────────────────
function renderTable(cases) {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';
  expandedIndex = null;
  document.getElementById('expandPanel').style.display = 'none';

  cases.forEach((tc, dispIdx) => {
    const originalIdx = allTestCases.indexOf(tc);
    const meta  = TYPE_META[tc.type]     || TYPE_META.Positive;
    const pMeta = PRIORITY_META[tc.priority] || PRIORITY_META.Medium;

    const tr = document.createElement('tr');
    tr.style.animationDelay = `${dispIdx * 0.04}s`;

    tr.innerHTML = `
      <td><span class="id-chip">${escapeHtml(tc.id)}</span></td>
      <td>
        <span class="type-badge"
          style="color:${meta.color};background:${meta.bg};border-color:${meta.color}40">
          ${meta.icon} ${escapeHtml(tc.type)}
        </span>
      </td>
      <td style="white-space:nowrap">
        <span class="priority-dot" style="color:${pMeta.color}">●</span>
        <span style="color:#94a3b8;font-size:12px">${escapeHtml(tc.priority || 'Medium')}</span>
      </td>
      <td style="max-width:220px">
        <span class="editable" data-idx="${originalIdx}" data-field="scenario"
              ondblclick="startEdit(this,${originalIdx},'scenario')">${escapeHtml(tc.scenario)}</span>
      </td>
      <td style="max-width:180px;color:#7a90b8;font-size:12px">
        <span class="editable" data-idx="${originalIdx}" data-field="testData"
              ondblclick="startEdit(this,${originalIdx},'testData')">${escapeHtml(tc.testData)}</span>
      </td>
      <td style="max-width:200px;color:#86efac;font-size:12px">
        <span class="editable" data-idx="${originalIdx}" data-field="expectedOutcome"
              ondblclick="startEdit(this,${originalIdx},'expectedOutcome')">${escapeHtml(tc.expectedOutcome)}</span>
      </td>
      <td style="max-width:160px;color:#445578;font-size:12px">${escapeHtml(tc.comments || '')}</td>
      <td>
        <button class="expand-row-btn" onclick="toggleExpand(${originalIdx})">▼</button>
      </td>`;

    tbody.appendChild(tr);
  });
}

// ── Inline editing ────────────────────────────────────────────
function startEdit(span, idx, field) {
  if (editingCell) return;
  editingCell = { idx, field };
  const input = document.createElement('input');
  input.className = 'cell-edit-input';
  input.value = allTestCases[idx][field] || '';
  span.replaceWith(input);
  input.focus();
  input.select();
  input.addEventListener('blur',    () => commitEdit(input, idx, field));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { editingCell = null; applyFilters(); } });
}

function commitEdit(input, idx, field) {
  allTestCases[idx][field] = input.value;
  editingCell = null;
  applyFilters();
}

// ── Expand panel ──────────────────────────────────────────────
function toggleExpand(idx) {
  if (expandedIndex === idx) { closeExpand(); return; }
  expandedIndex = idx;
  const tc = allTestCases[idx];
  document.getElementById('expandTitle').textContent = `${tc.id} — ${tc.scenario}`;
  document.getElementById('expandPreconditions').textContent = tc.preconditions || '—';
  document.getElementById('expandSteps').textContent         = tc.steps         || '—';
  document.getElementById('expandReq').textContent           = tc.relatedReq ? `Related: ${tc.relatedReq}` : '';

  const delBtn = document.getElementById('expandDelBtn');
  delBtn.onclick = () => removeCase(idx);

  document.getElementById('expandPanel').style.display = '';
  document.getElementById('expandPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeExpand() {
  expandedIndex = null;
  document.getElementById('expandPanel').style.display = 'none';
}

function removeCase(idx) {
  allTestCases.splice(idx, 1);
  closeExpand();
  renderStats();
  applyFilters();
  document.getElementById('resultsBadge').textContent = allTestCases.length;
}

// ── Export ────────────────────────────────────────────────────
function getFiltered() {
  const q     = (document.getElementById('searchInput').value || '').toLowerCase();
  const fType = document.getElementById('filterType').value;
  const fPrio = document.getElementById('filterPriority').value;
  return allTestCases.filter(tc => {
    if (fType !== 'All' && tc.type !== fType) return false;
    if (fPrio !== 'All' && tc.priority !== fPrio) return false;
    if (q) {
      const h = [tc.scenario, tc.testData, tc.expectedOutcome, tc.comments, tc.id].join(' ').toLowerCase();
      return h.includes(q);
    }
    return true;
  });
}

function escapeCSV(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }

function exportCSV() {
  const cols = ['ID','Type','Priority','Scenario','Preconditions','Steps','Test Data','Expected Outcome','Related Req','Comments'];
  const rows = [cols.map(escapeCSV).join(',')];
  getFiltered().forEach(tc => rows.push([
    tc.id, tc.type, tc.priority, tc.scenario, tc.preconditions,
    tc.steps, tc.testData, tc.expectedOutcome, tc.relatedReq, tc.comments,
  ].map(escapeCSV).join(',')));
  downloadBlob(rows.join('\n'), 'text/csv', 'test_cases.csv');
}

function exportJSON() {
  downloadBlob(JSON.stringify(getFiltered(), null, 2), 'application/json', 'test_cases.json');
}

function exportMarkdown() {
  const lines = ['# Test Cases\n', `Generated: ${new Date().toLocaleString()}\n`];
  getFiltered().forEach(tc => {
    lines.push(`\n## ${tc.id} — ${tc.scenario}`);
    lines.push(`- **Type**: ${tc.type}  **Priority**: ${tc.priority}  **Related**: ${tc.relatedReq || '—'}`);
    lines.push(`- **Preconditions**: ${tc.preconditions || '—'}`);
    lines.push(`- **Steps**:\n${(tc.steps || '—').split('\n').map(l => `  ${l}`).join('\n')}`);
    lines.push(`- **Test Data**: ${tc.testData || '—'}`);
    lines.push(`- **Expected Outcome**: ${tc.expectedOutcome || '—'}`);
    lines.push(`- **Comments**: ${tc.comments || '—'}`);
  });
  downloadBlob(lines.join('\n'), 'text/markdown', 'test_cases.md');
}

function downloadBlob(content, mime, filename) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Utilities ─────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[c]));
}

function showError(msg) {
  const box = document.getElementById('errorBox');
  box.textContent = '⚠ ' + msg;
  box.style.display = '';
}

function hideError() {
  document.getElementById('errorBox').style.display = 'none';
}
