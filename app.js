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
// LOG TAB
// ============================================================

// null when no session is in progress. Otherwise holds:
// { day, exIndex, setIndex, exerciseResults: [] }
let logState = null;

function renderLogTab() {
  const container = document.getElementById("tab-log");

  // No split defined yet — nothing to log.
  if (appData.split.length === 0) {
    container.innerHTML = `<p class="empty-msg">Set up a split first in the Setup tab.</p>`;
    return;
  }

  // No session in progress — show day picker.
  if (!logState) {
    let html = `<h2>Start a Session</h2>`;
    appData.split.forEach(day => {
      html += `<button class="day-pick-btn" data-action="start-session" data-day="${day.id}">${escapeHtml(day.name)}</button>`;
    });
    container.innerHTML = html;
    return;
  }

  const day = logState.day;
  const exercise = day.exercises[logState.exIndex];

  // Safety check: if the exercise has 0 sets somehow, skip it.
  if (!exercise) {
    finishSession();
    return;
  }

  const isFeelStep = logState.setIndex >= exercise.sets;

  let html = `
    <h2>${escapeHtml(day.name)}</h2>
    <p class="log-progress">Exercise ${logState.exIndex + 1} of ${day.exercises.length}: <strong>${escapeHtml(exercise.name)}</strong></p>
  `;

  if (!isFeelStep) {
    html += `
      <p class="log-progress">Set ${logState.setIndex + 1} of ${exercise.sets}</p>
      <div class="log-form">
        <label>Weight (kg) <input type="number" step="0.5" id="log-weight" /></label>
        <label>Reps <input type="number" id="log-reps" /></label>
        <label>RPE (1-10) <input type="number" step="0.5" min="1" max="10" id="log-rpe" /></label>
        <button data-action="submit-set">Next</button>
      </div>
    `;
  } else {
    html += `
      <div class="log-form">
        <label>How did this exercise feel? (1-10) <input type="number" min="1" max="10" id="log-feel" /></label>
        <button data-action="submit-feel">Next</button>
      </div>
    `;
  }

  html += `<button class="btn-danger cancel-btn" data-action="cancel-session">Cancel Session</button>`;

  container.innerHTML = html;
}

document.getElementById("tab-log").addEventListener("click", (e) => {
  const action = e.target.dataset.action;
  if (!action) return;

  if (action === "start-session") {
    const dayId = e.target.dataset.day;
    const day = appData.split.find(d => d.id === dayId);
    logState = {
      day,
      exIndex: 0,
      setIndex: 0,
      exerciseResults: []   // will hold { exerciseId, name, sets: [], feel: null } per exercise
    };
    renderLogTab();
  }

  if (action === "submit-set") {
    const weight = parseFloat(document.getElementById("log-weight").value);
    const reps = parseInt(document.getElementById("log-reps").value, 10);
    const rpe = parseFloat(document.getElementById("log-rpe").value);

    if (isNaN(weight) || isNaN(reps) || isNaN(rpe)) {
      alert("Please fill in all fields.");
      return;
    }

    const exercise = logState.day.exercises[logState.exIndex];

    // Find or create this exercise's result entry.
    let result = logState.exerciseResults.find(r => r.exerciseId === exercise.id);
    if (!result) {
      result = { exerciseId: exercise.id, name: exercise.name, sets: [], feel: null };
      logState.exerciseResults.push(result);
    }
    result.sets.push({ weight, reps, rpe });

    logState.setIndex++;
    renderLogTab();
  }

  if (action === "submit-feel") {
    const feel = parseInt(document.getElementById("log-feel").value, 10);
    if (isNaN(feel) || feel < 1 || feel > 10) {
      alert("Please enter a feel rating from 1 to 10.");
      return;
    }

    const exercise = logState.day.exercises[logState.exIndex];
    const result = logState.exerciseResults.find(r => r.exerciseId === exercise.id);
    result.feel = feel;

    // Move to next exercise, reset set counter.
    logState.exIndex++;
    logState.setIndex = 0;

    if (logState.exIndex >= logState.day.exercises.length) {
      finishSession();
    } else {
      renderLogTab();
    }
  }

  if (action === "cancel-session") {
    if (confirm("Cancel this session? Nothing will be saved.")) {
      logState = null;
      renderLogTab();
    }
  }
});

function finishSession() {
  const session = {
    id: makeId(),
    date: new Date().toISOString(),
    dayId: logState.day.id,
    dayName: logState.day.name,
    exercises: logState.exerciseResults
  };

  appData.sessions.push(session);
  saveData(appData);
  logState = null;

  document.getElementById("tab-log").innerHTML = `
    <h2>Session Complete ✅</h2>
    <p>Logged ${session.exercises.length} exercises for ${escapeHtml(session.dayName)}.</p>
    <button data-action="log-another">Log Another Session</button>
  `;
}

document.getElementById("tab-log").addEventListener("click", (e) => {
  if (e.target.dataset.action === "log-another") {
    renderLogTab();
  }
});

// ============================================================
// HISTORY TAB
// ============================================================

// Remembers the user's current picks so the view survives re-renders.
let historyState = {
  exerciseId: null,
  range: "month"   // "day" | "week" | "month" | "year"
};

// Keep a reference to the active Chart.js instances so we can destroy
// them before drawing new ones (Chart.js requires this, or charts stack up).
let activeCharts = [];

function getAllExercisesFromSplit() {
  // Flatten every exercise across every day into one list, with day name attached.
  const list = [];
  appData.split.forEach(day => {
    day.exercises.forEach(ex => {
      list.push({ id: ex.id, name: ex.name, dayName: day.name });
    });
  });
  return list;
}

function renderHistoryTab() {
  const container = document.getElementById("tab-history");

  if (appData.sessions.length === 0) {
    container.innerHTML = `<p class="empty-msg">No sessions logged yet. Log a session first.</p>`;
    return;
  }

  const exercises = getAllExercisesFromSplit();

  let html = `<h2>History</h2>`;

  html += `<div class="history-controls">`;
  html += `<select id="history-exercise-select">`;
  html += `<option value="">-- Select exercise --</option>`;
  exercises.forEach(ex => {
    const selected = ex.id === historyState.exerciseId ? "selected" : "";
    html += `<option value="${ex.id}" ${selected}>${escapeHtml(ex.name)} (${escapeHtml(ex.dayName)})</option>`;
  });
  html += `</select>`;

  html += `<select id="history-range-select">`;
  ["day", "week", "month", "year"].forEach(r => {
    const selected = r === historyState.range ? "selected" : "";
    html += `<option value="${r}" ${selected}>${r}</option>`;
  });
  html += `</select>`;
  html += `</div>`;

  html += `<div id="history-chart-area"></div>`;

  container.innerHTML = html;

  // If an exercise was already picked (e.g. re-render after switching tabs), draw immediately.
  if (historyState.exerciseId) {
    drawHistoryCharts();
  }
}

document.getElementById("tab-history").addEventListener("change", (e) => {
  if (e.target.id === "history-exercise-select") {
    historyState.exerciseId = e.target.value || null;
    drawHistoryCharts();
  }
  if (e.target.id === "history-range-select") {
    historyState.range = e.target.value;
    drawHistoryCharts();
  }
});

// Given a session date and the chosen range, returns true if that
// session falls within the current range window (e.g. "this month").
function isWithinRange(dateStr, range) {
  const now = new Date();
  const d = new Date(dateStr);

  if (range === "day") {
    return d.toDateString() === now.toDateString();
  }
  if (range === "week") {
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    return d >= weekAgo && d <= now;
  }
  if (range === "month") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  if (range === "year") {
    return d.getFullYear() === now.getFullYear();
  }
  return true;
}

function drawHistoryCharts() {
  const chartArea = document.getElementById("history-chart-area");
  if (!historyState.exerciseId) {
    chartArea.innerHTML = "";
    return;
  }

  // Destroy old chart instances before making new ones, or Chart.js
  // will throw an error about re-using a canvas that's already in use.
  activeCharts.forEach(c => c.destroy());
  activeCharts = [];

  // Collect every logged data point for this exercise, across all sessions,
  // filtered to the selected time range.
  const points = []; // { date, avgWeight, maxWeight, avgRpe, feel }

  appData.sessions.forEach(session => {
    if (!isWithinRange(session.date, historyState.range)) return;

    const exResult = session.exercises.find(ex => ex.exerciseId === historyState.exerciseId);
    if (!exResult || exResult.sets.length === 0) return;

    const weights = exResult.sets.map(s => s.weight);
    const rpes = exResult.sets.map(s => s.rpe);

    points.push({
      date: session.date,
      avgWeight: weights.reduce((a, b) => a + b, 0) / weights.length,
      maxWeight: Math.max(...weights),
      avgRpe: rpes.reduce((a, b) => a + b, 0) / rpes.length,
      feel: exResult.feel
    });
  });

  // Sort oldest to newest so the line chart reads left-to-right correctly.
  points.sort((a, b) => new Date(a.date) - new Date(b.date));

  if (points.length === 0) {
    chartArea.innerHTML = `<p class="empty-msg">No logged data for this exercise in this range.</p>`;
    return;
  }

  const labels = points.map(p => new Date(p.date).toLocaleDateString());

  chartArea.innerHTML = `
    <h3>Weight Progression</h3>
    <canvas id="chart-weight"></canvas>
    <h3>RPE Trend</h3>
    <canvas id="chart-rpe"></canvas>
    <h3>Feel Rating Trend</h3>
    <canvas id="chart-feel"></canvas>
  `;

  const weightChart = new Chart(document.getElementById("chart-weight"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Max Weight", data: points.map(p => p.maxWeight), borderColor: "#e63946", fill: false },
        { label: "Avg Weight", data: points.map(p => p.avgWeight), borderColor: "#457b9d", fill: false }
      ]
    },
    options: { responsive: true }
  });

  const rpeChart = new Chart(document.getElementById("chart-rpe"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Avg RPE", data: points.map(p => p.avgRpe), borderColor: "#f4a261", fill: false }
      ]
    },
    options: { responsive: true, scales: { y: { min: 0, max: 10 } } }
  });

  const feelChart = new Chart(document.getElementById("chart-feel"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Feel", data: points.map(p => p.feel), borderColor: "#2a9d8f", fill: false }
      ]
    },
    options: { responsive: true, scales: { y: { min: 0, max: 10 } } }
  });

  activeCharts = [weightChart, rpeChart, feelChart];
}

// ============================================================
// STARTUP
// ============================================================
renderSetupTab();