/* ── State ── */
let settings = {};
let selectedWallpapers = [];
let wordsPerDay = 3;
let textPos = { x: 50, y: 50 };

/* ── Quiz state ── */
let quizRange = 'week';        // 'week' | 'month'
let quizWords = [];            // words for current quiz session
let quizIndex = 0;
let quizScore = 0;
let quizAnswered = false;

const FALLBACK_POOL = [
  { word: 'Ephemeral',      meaning: 'Lasting for a very short time; transitory.' },
  { word: 'Serendipity',    meaning: 'The occurrence of events by chance in a happy or beneficial way.' },
  { word: 'Mellifluous',    meaning: 'Sweet or musical; pleasant to hear.' },
  { word: 'Perspicacious',  meaning: 'Having a ready insight into things; shrewd.' },
  { word: 'Sanguine',       meaning: 'Optimistic, especially in a difficult situation.' },
  { word: 'Laconic',        meaning: 'Using very few words; brief and concise.' },
  { word: 'Ubiquitous',     meaning: 'Present, appearing, or found everywhere.' },
  { word: 'Equanimity',     meaning: 'Mental calmness and composure in difficult situations.' },
  { word: 'Alacrity',       meaning: 'Brisk and cheerful readiness.' },
  { word: 'Cogent',         meaning: 'Clear, logical, and convincing.' },
];

/* ── Helpers ── */
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'toast'; }, 2800);
}

function navigateTo(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const target = document.getElementById(`view-${view}`);
  if (target) target.classList.remove('hidden');
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── Setup View ── */
function initSetup() {
  document.querySelectorAll('input[name=wallpaperSource]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.getElementById('custom-wp-row').style.display =
        radio.value === 'custom' ? 'flex' : 'none';
    });
  });

  document.getElementById('btn-select-wallpapers').addEventListener('click', async () => {
    const paths = await window.api.selectWallpaper();
    if (paths.length) {
      selectedWallpapers = paths;
      document.getElementById('selected-count').textContent =
        `${paths.length} image${paths.length !== 1 ? 's' : ''} selected`;
    }
  });

  const chips = document.querySelectorAll('#word-count-grid .wc-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      wordsPerDay = parseInt(chip.dataset.value, 10);
    });
  });
  chips.forEach(c => c.classList.toggle('selected', parseInt(c.dataset.value, 10) === 3));

  initPositionPicker('position-preview', 'pos-marker', 'pos-readout', (x, y) => { textPos = { x, y }; });

  document.getElementById('btn-complete-setup').addEventListener('click', async () => {
    const source = document.querySelector('input[name=wallpaperSource]:checked')?.value || 'default';
    const btn = document.getElementById('btn-complete-setup');
    btn.textContent = '⏳ Setting up…';
    btn.disabled = true;

    const result = await window.api.completeSetup({
      wallpaperSource: source,
      customWallpapers: selectedWallpapers,
      wordsPerDay,
      textPosition: textPos
    });

    if (result) {
      showToast('Setup complete! Wallpaper applied.', 'success');
      setTimeout(() => navigateTo('settings'), 600);
      await loadSettingsView();
    } else {
      showToast('Something went wrong. Try again.', 'error');
      btn.textContent = '✨ Start Learning';
      btn.disabled = false;
    }
  });
}

function initPositionPicker(previewId, markerId, readoutId, onChange) {
  const preview = document.getElementById(previewId);
  const marker  = document.getElementById(markerId);
  const readout = document.getElementById(readoutId);
  if (!preview) return;

  preview.addEventListener('click', (e) => {
    const rect = preview.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width)  * 100);
    const y = Math.round(((e.clientY - rect.top)  / rect.height) * 100);
    marker.style.left = `${x}%`;
    marker.style.top  = `${y}%`;
    if (readout) readout.textContent = `Position: ${x}%, ${y}%`;
    onChange(x, y);
  });
}

/* ── Settings View ── */
async function loadSettingsView() {
  settings = await window.api.getSettings();
  const word = await window.api.getCurrentWord();

  const selSource = document.getElementById('sel-source');
  if (selSource) selSource.value = settings.wallpaperSource || 'default';

  const rowCustom = document.getElementById('row-custom-wp');
  const wpCount   = document.getElementById('custom-wp-count');
  if (rowCustom && wpCount) {
    const n = (settings.customWallpapers || []).length;
    wpCount.textContent = `${n} image${n !== 1 ? 's' : ''} selected`;
    rowCustom.style.display = settings.wallpaperSource === 'custom' ? 'flex' : 'none';
  }

  selSource?.addEventListener('change', () => {
    if (rowCustom) rowCustom.style.display = selSource.value === 'custom' ? 'flex' : 'none';
  });

  const selWords = document.getElementById('sel-words-per-day');
  if (selWords) selWords.value = settings.wordsPerDay || 3;

  if (word) {
    document.getElementById('wc-word').textContent    = word.word    || '—';
    document.getElementById('wc-meaning').textContent = word.meaning || '';
    const exEl = document.getElementById('wc-example');
    if (exEl) exEl.textContent = word.example ? `"${word.example}"` : '';
  }

  const pos     = settings.textPosition || { x: 50, y: 50 };
  const markerS = document.getElementById('pos-marker-s');
  if (markerS) { markerS.style.left = `${pos.x}%`; markerS.style.top = `${pos.y}%`; }
  initPositionPicker('position-preview-s', 'pos-marker-s', null, (x, y) => {
    settings.textPosition = { x, y };
  });
}

function initSettings() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      const panel = document.getElementById(item.dataset.panel);
      if (panel) panel.classList.add('active');
      if (item.dataset.panel === 'panel-quiz') loadQuizHome();
    });
  });

  document.getElementById('btn-manage-wallpapers')?.addEventListener('click', async () => {
    const paths = await window.api.selectWallpaper();
    if (paths.length) {
      settings.customWallpapers = paths;
      const wpCount = document.getElementById('custom-wp-count');
      if (wpCount) wpCount.textContent = `${paths.length} image${paths.length !== 1 ? 's' : ''} selected`;
      showToast(`${paths.length} wallpaper${paths.length !== 1 ? 's' : ''} selected`);
    }
  });

  document.getElementById('btn-refresh-wallpaper')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-refresh-wallpaper');
    btn.textContent = 'Updating…';
    btn.disabled = true;
    const result = await window.api.refreshWallpaper();
    btn.textContent = 'Refresh Now';
    btn.disabled = false;
    if (result?.success) {
      showToast(`Wallpaper updated: ${result.word?.word}`, 'success');
      await loadSettingsView();
    } else {
      showToast('Update failed.', 'error');
    }
  });

  document.getElementById('btn-learn-more')?.addEventListener('click', () => {
    window.api.openWordBrowser();
  });

  document.getElementById('btn-save')?.addEventListener('click', async () => {
    const selSource = document.getElementById('sel-source');
    const selWords  = document.getElementById('sel-words-per-day');
    await window.api.saveSettings({
      wallpaperSource: selSource?.value || settings.wallpaperSource,
      wordsPerDay: parseInt(selWords?.value || settings.wordsPerDay, 10),
      customWallpapers: settings.customWallpapers || [],
      textPosition: settings.textPosition || { x: 50, y: 50 }
    });
    showToast('Settings saved', 'success');
  });

  document.getElementById('btn-cancel')?.addEventListener('click', () => window.api.closeWindow());
}

/* ── Quiz ── */
function getWordsForRange(history, range) {
  const cutoff = Date.now() - (range === 'week' ? 7 : 30) * 864e5;
  // Prefer timestamped entries in range; fall back to all history if needed
  const inRange = history.filter(w => w.timestamp && w.timestamp >= cutoff);
  return inRange.length >= 4 ? inRange : history;
}

function buildDistractors(correctWord, allWords, count = 3) {
  const pool = [
    ...allWords.filter(w => w.word !== correctWord.word),
    ...FALLBACK_POOL.filter(f => f.word !== correctWord.word && !allWords.some(w => w.word === f.word))
  ];
  return shuffle(pool).slice(0, count);
}

async function loadQuizHome() {
  quizRange = document.querySelector('.quiz-tab.active')?.dataset.range || 'week';
  const history = await window.api.getWordHistory();
  const words   = getWordsForRange(history, quizRange);
  const best    = await window.api.getQuizBest(quizRange);

  document.getElementById('quiz-word-count').textContent = words.length;
  document.getElementById('quiz-best-score').textContent = best !== null ? `${best}%` : '—';

  const noteEl = document.getElementById('quiz-note');
  const startBtn = document.getElementById('btn-start-quiz');

  if (words.length < 4) {
    noteEl.textContent = `Need at least 4 words (you have ${words.length}). Keep learning!`;
    startBtn.disabled = true;
  } else {
    noteEl.textContent = `${words.length} words ready — good luck!`;
    startBtn.disabled = false;
  }

  // Show home, hide others
  document.getElementById('quiz-home').style.display    = '';
  document.getElementById('quiz-active').style.display  = 'none';
  document.getElementById('quiz-results').style.display = 'none';
}

function startQuiz(history) {
  const words = getWordsForRange(history, quizRange);
  quizWords   = shuffle(words).slice(0, Math.min(words.length, 10));
  quizIndex   = 0;
  quizScore   = 0;

  document.getElementById('quiz-home').style.display    = 'none';
  document.getElementById('quiz-active').style.display  = '';
  document.getElementById('quiz-results').style.display = 'none';

  renderQuestion(history);
}

function renderQuestion(allHistory) {
  quizAnswered = false;
  const current = quizWords[quizIndex];
  const total   = quizWords.length;

  // Progress
  const pct = (quizIndex / total) * 100;
  document.getElementById('quiz-fill').style.width       = `${pct}%`;
  document.getElementById('quiz-progress-text').textContent = `${quizIndex + 1} / ${total}`;
  document.getElementById('quiz-word-display').textContent  = current.word;

  // Build 4 options
  const distractors = buildDistractors(current, allHistory);
  const options = shuffle([
    { meaning: current.meaning, correct: true },
    ...distractors.map(d => ({ meaning: d.meaning, correct: false }))
  ]);

  const container = document.getElementById('quiz-options');
  container.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option';
    btn.textContent = opt.meaning;
    btn.addEventListener('click', () => handleAnswer(btn, opt.correct, container));
    container.appendChild(btn);
  });

  document.getElementById('btn-next-q').style.display = 'none';
}

function handleAnswer(btn, isCorrect, container) {
  if (quizAnswered) return;
  quizAnswered = true;

  if (isCorrect) {
    btn.classList.add('correct');
    quizScore++;
  } else {
    btn.classList.add('wrong');
    // Highlight the correct one
    container.querySelectorAll('.quiz-option').forEach(b => {
      if (b !== btn) b.classList.add('correct');
    });
  }

  // Disable all options
  container.querySelectorAll('.quiz-option').forEach(b => { b.disabled = true; });
  document.getElementById('btn-next-q').style.display = '';
}

async function showResults() {
  document.getElementById('quiz-active').style.display  = 'none';
  document.getElementById('quiz-results').style.display = '';

  const total = quizWords.length;
  const pct   = Math.round((quizScore / total) * 100);

  document.getElementById('qsc-fraction').textContent = `${quizScore} / ${total}`;
  document.getElementById('qsc-percent').textContent  = `${pct}%`;

  let emoji, label;
  if (pct === 100) { emoji = '🏆'; label = 'Perfect score!'; }
  else if (pct >= 80) { emoji = '🎉'; label = 'Great job!'; }
  else if (pct >= 60) { emoji = '👍'; label = 'Good effort!'; }
  else if (pct >= 40) { emoji = '📖'; label = 'Keep studying!'; }
  else { emoji = '💪'; label = 'Practice makes perfect!'; }

  document.getElementById('qsc-emoji').textContent = emoji;
  document.getElementById('qsc-label').textContent  = label;

  await window.api.saveQuizScore({ range: quizRange, score: quizScore, total });
  const newBest = await window.api.getQuizBest(quizRange);
  document.getElementById('quiz-best-score').textContent = `${newBest}%`;
}

function initQuiz() {
  // Tab switching
  document.querySelectorAll('.quiz-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.quiz-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      quizRange = tab.dataset.range;
      loadQuizHome();
    });
  });

  // Start quiz
  document.getElementById('btn-start-quiz')?.addEventListener('click', async () => {
    const history = await window.api.getWordHistory();
    startQuiz(history);
    // Store allHistory on window for use in next-question handler
    window._quizHistory = history;
  });

  // Next question
  document.getElementById('btn-next-q')?.addEventListener('click', () => {
    quizIndex++;
    if (quizIndex >= quizWords.length) {
      showResults();
    } else {
      renderQuestion(window._quizHistory || []);
    }
  });

  // Retry
  document.getElementById('btn-quiz-retry')?.addEventListener('click', async () => {
    const history = await window.api.getWordHistory();
    startQuiz(history);
    window._quizHistory = history;
  });

  // Done
  document.getElementById('btn-quiz-done')?.addEventListener('click', () => {
    loadQuizHome();
  });
}

/* ── Title bar ── */
document.getElementById('btn-close')?.addEventListener('click',    () => window.api.closeWindow());
document.getElementById('btn-minimize')?.addEventListener('click', () => window.api.minimizeWindow());

/* ── Navigation from main process ── */
window.api.onNavigate((page) => {
  navigateTo(page);
  if (page === 'settings') loadSettingsView();
});

/* ── Boot ── */
async function boot() {
  const s = await window.api.getSettings();
  initSetup();
  initSettings();
  initQuiz();

  if (!s.firstRun && s.setupComplete) {
    navigateTo('settings');
    await loadSettingsView();
  } else {
    navigateTo('setup');
  }
}

boot();
