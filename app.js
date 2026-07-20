// ============================================================
// DATA LAYER — load/save everything to localStorage as JSON
// ============================================================

const STORAGE_KEY = "fitnessTrackerData";

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

let appData = loadData();

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
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

let setupState = {
  openDayForExercise: null,
  showAddDayForm: false
};

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

    html += `</ul>`;

    if (setupState.openDayForExercise === day.id) {
      html += `
        <div class="add-exercise-form">
          <input type="text" placeholder="Exercise name" id="ex-name-${day.id}" />
          <input type="number" placeholder="Sets" min="1" id="ex-sets-${day.id}" style="width:70px" />
          <button class="btn-small" data-action="add-exercise" data-day="${day.id}">Add</button>
          <button class="btn-small btn-secondary" data-action="close-add-exercise" data-day="${day.id}">Done</button>
        </div>
      `;
    } else {
      html += `
        <button class="btn-small" data-action="open-add-exercise" data-day="${day.id}">+ Add Exercise</button>
      `;
    }

    html += `</div>`;
  });

  if (setupState.showAddDayForm) {
    html += `
      <div class="add-day-form">
        <input type="text" placeholder="New day name (e.g. Push)" id="new-day-name" />
        <button data-action="add-day">Add</button>
        <button class="btn-secondary" data-action="close-add-day">Done</button>
      </div>
    `;
  } else {
    html += `<button data-action="open-add-day">+ Add Day</button>`;
  }

  container.innerHTML = html;
}

document.getElementById("tab-setup").addEventListener("click", (e) => {
  const action = e.target.dataset.action;
  if (!action) return;

  if (action === "open-add-day") {
    setupState.showAddDayForm = true;
    renderSetupTab();
  }

  if (action === "close-add-day") {
    setupState.showAddDayForm = false;
    renderSetupTab();
  }

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

  if (action === "open-add-exercise") {
    setupState.openDayForExercise = e.target.dataset.day;
    renderSetupTab();
  }

  if (action === "close-add-exercise") {
    setupState.openDayForExercise = null;
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

let logState = null;

function renderLogTab() {
  const container = document.getElementById("tab-log");

  if (appData.split.length === 0) {
    container.innerHTML = `<p class="empty-msg">Set up a split first in the Setup tab.</p>`;
    return;
  }

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

  if (!exercise) {
    finishSession();
    return;
  }

  const isFeelStep = logState.setIndex >= exercise.sets;
  const result = logState.exerciseResults.find(r => r.exerciseId === exercise.id);

  let html = `
    <h2>${escapeHtml(day.name)}</h2>
    <p class="log-progress">Exercise ${logState.exIndex + 1} of ${day.exercises.length}: <strong>${escapeHtml(exercise.name)}</strong></p>
  `;

  if (!isFeelStep) {
    // Decide what to pre-fill. If we just pressed Back, restore the exact
    // old values for this set. Otherwise, only pre-fill weight from the
    // previous set (reps/RPE stay blank, but we offer quick-rep buttons).
    let prefillWeight = "";
    let prefillReps = "";
    let prefillRpe = "";
    let quickReps = null;

    if (logState.pendingPrefill) {
      prefillWeight = logState.pendingPrefill.weight;
      prefillReps = logState.pendingPrefill.reps;
      prefillRpe = logState.pendingPrefill.rpe;
    } else if (result && result.sets.length > 0) {
      const lastSet = result.sets[result.sets.length - 1];
      prefillWeight = lastSet.weight;
      quickReps = lastSet.reps;
    }

    html += `
      <p class="log-progress">Set ${logState.setIndex + 1} of ${exercise.sets}</p>
      <div class="log-form">
        <label>Weight (kg) <input type="number" step="0.5" id="log-weight" value="${prefillWeight}" /></label>
        <label>Reps <input type="number" id="log-reps" value="${prefillReps}" /></label>
    `;

    if (quickReps !== null) {
      html += `
        <div class="quick-reps">
          <button type="button" class="btn-small btn-secondary" data-action="quick-reps" data-value="${quickReps}">Same (${quickReps})</button>
          <button type="button" class="btn-small btn-secondary" data-action="quick-reps" data-value="${quickReps - 2}">-2 (${quickReps - 2})</button>
        </div>
      `;
    }

    html += `
        <label>RPE (1-10) <input type="number" step="0.5" min="1" max="10" id="log-rpe" value="${prefillRpe}" /></label>
        <button data-action="submit-set">Next</button>
      </div>
    `;
  } else {
    const prefillFeel = logState.pendingPrefill ? logState.pendingPrefill.feel : "";
    html += `
      <div class="log-form">
        <label>How did this exercise feel? (1-10) <input type="number" min="1" max="10" id="log-feel" value="${prefillFeel || ""}" /></label>
        <button data-action="submit-feel">Next</button>
      </div>
    `;
  }

  // pendingPrefill is one-shot — clear it now that this render used it.
  logState.pendingPrefill = null;

  const isVeryFirstStep = logState.exIndex === 0 && logState.setIndex === 0;
  if (!isVeryFirstStep) {
    html += `<button class="btn-secondary" data-action="go-back">← Back</button>`;
  }

  html += `<button class="btn-danger cancel-btn" data-action="cancel-session">Cancel Session</button>`;

  container.innerHTML = html;
}


function goBack() {
  const day = logState.day;
  const exercise = day.exercises[logState.exIndex];

  if (logState.setIndex === 0) {
    // First set of this exercise — step back into the previous exercise's feel rating.
    if (logState.exIndex === 0) return; // nothing before the very first step
    logState.exIndex--;
    const prevExercise = day.exercises[logState.exIndex];
    const prevResult = logState.exerciseResults.find(r => r.exerciseId === prevExercise.id);
    logState.setIndex = prevExercise.sets; // lands back on that exercise's feel step
    logState.pendingPrefill = { feel: prevResult.feel };
    prevResult.feel = null;
  } else {
    // Mid-sets or on the feel step — step back into the last submitted set.
    logState.setIndex--;
    const result = logState.exerciseResults.find(r => r.exerciseId === exercise.id);
    const removedSet = result.sets.pop();
    logState.pendingPrefill = { weight: removedSet.weight, reps: removedSet.reps, rpe: removedSet.rpe };
  }

  renderLogTab();
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
      exerciseResults: [],
      pendingPrefill: null
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
  
  if (action === "quick-reps") {
    document.getElementById("log-reps").value = e.target.dataset.value;
  }

  if (action === "go-back") {
    goBack();
  }

  if (action === "log-another") {
    renderLogTab();
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

// ============================================================
// HISTORY TAB
// ============================================================

let historyState = {
  exerciseId: null,
  range: "month"
};

let activeCharts = [];

function getAllExercisesFromSplit() {
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

  activeCharts.forEach(c => c.destroy());
  activeCharts = [];

  const points = [];

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