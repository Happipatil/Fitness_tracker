// ============================================================
// DATA LAYER — load/save everything to localStorage as JSON
// ============================================================

const STORAGE_KEY = "fitnessTrackerData";

// The shape of our whole app's data.
// split: the workout plan. sessions: logged history (built in Step 3).
function getDefaultData() {
  return {
    split: [],
    sessions: []
  };
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return getDefaultData();
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("Corrupted data, resetting.", e);
    return getDefaultData();
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Load once when the app starts; we keep this in memory and
// write it back to localStorage every time it changes.
let appData = loadData();

// Small helper to make unique-enough IDs without a library.
function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ============================================================
// TAB SWITCHING
// ============================================================

function showTab(tabId) {
  document.querySelectorAll(".tab-panel").forEach(panel => {
    panel.classList.toggle("active", panel.id === tabId);
  });
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  // Re-render the tab we just switched to, so it always shows fresh data.
  if (tabId === "tab-setup") renderSetupTab();
  if (tabId === "tab-log") renderLogTab();
  if (tabId === "tab-history") renderHistoryTab();
}

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
});

// ============================================================
// SETUP TAB
// ============================================================

function renderSetupTab() {
  const container = document.getElementById("tab-setup");

  let html = `<h2>Your Split</h2>`;

  if (appData.split.length === 0) {
    html += `<p class="empty-msg">No days added yet. Add your first day below.</p>`;
  }

  appData.split.forEach(day => {
    html += `
      <div class="day-card">
        <div class="day-card-header">
          <strong>${escapeHtml(day.name)}</strong>
          <button class="btn-small btn-danger" data-action="delete-day" data-day="${day.id}">Delete Day</button>
        </div>
        <ul class="exercise-list">
    `;

    day.exercises.forEach(ex => {
      html += `
        <li>
          ${escapeHtml(ex.name)} — ${ex.sets} sets
          <button class="btn-small btn-danger" data-action="delete-exercise" data-day="${day.id}" data-exercise="${ex.id}">✕</button>
        </li>
      `;
    });

    html += `
        </ul>
        <div class="add-exercise-form">
          <input type="text" placeholder="Exercise name" id="ex-name-${day.id}" />
          <input type="number" placeholder="Sets" min="1" id="ex-sets-${day.id}" style="width:70px" />
          <button class="btn-small" data-action="add-exercise" data-day="${day.id}">Add Exercise</button>
        </div>
      </div>
    `;
  });

  html += `
    <div class="add-day-form">
      <input type="text" placeholder="New day name (e.g. Push)" id="new-day-name" />
      <button data-action="add-day">Add Day</button>
    </div>
  `;

  container.innerHTML = html;
}

// Escape user text so it can't break our HTML if they type < > etc.
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Event delegation: one listener on the container handles all clicks,
// instead of attaching a listener to every single button (which would
// break every time we re-render).
document.getElementById("tab-setup").addEventListener("click", (e) => {
  const action = e.target.dataset.action;
  if (!action) return;

  if (action === "add-day") {
    const input = document.getElementById("new-day-name");
    const name = input.value.trim();
    if (!name) return;
    appData.split.push({ id: makeId(), name, exercises: [] });
    saveData(appData);
    renderSetupTab();
  }

  if (action === "delete-day") {
    const dayId = e.target.dataset.day;
    appData.split = appData.split.filter(d => d.id !== dayId);
    saveData(appData);
    renderSetupTab();
  }

  if (action === "add-exercise") {
    const dayId = e.target.dataset.day;
    const nameInput = document.getElementById(`ex-name-${dayId}`);
    const setsInput = document.getElementById(`ex-sets-${dayId}`);
    const name = nameInput.value.trim();
    const sets = parseInt(setsInput.value, 10);
    if (!name || !sets || sets < 1) return;

    const day = appData.split.find(d => d.id === dayId);
    day.exercises.push({ id: makeId(), name, sets });
    saveData(appData);
    renderSetupTab();
  }

  if (action === "delete-exercise") {
    const dayId = e.target.dataset.day;
    const exId = e.target.dataset.exercise;
    const day = appData.split.find(d => d.id === dayId);
    day.exercises = day.exercises.filter(ex => ex.id !== exId);
    saveData(appData);
    renderSetupTab();
  }
});

// ============================================================
// LOG TAB — placeholder for now, built in Step 3
// ============================================================
function renderLogTab() {
  document.getElementById("tab-log").innerHTML = `<h2>Log</h2><p>Coming in Step 3.</p>`;
}

// ============================================================
// HISTORY TAB — placeholder for now, built in Step 4
// ============================================================
function renderHistoryTab() {
  document.getElementById("tab-history").innerHTML = `<h2>History</h2><p>Coming in Step 4.</p>`;
}

// ============================================================
// STARTUP
// ============================================================
renderSetupTab();