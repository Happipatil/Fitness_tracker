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
    const todayStr = new Date().toISOString().slice(0, 10);
    let html = `<h2>Start a Session</h2>`;
    html += `<label class="session-date-label">Session date
      <input type="date" id="log-session-date" value="${todayStr}" />
    </label>`;
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

  logState.pendingPrefill = null;

  const isVeryFirstStep = logState.exIndex === 0 && logState.setIndex === 0;
  if (!isVeryFirstStep) {
    html += `<button class="btn-secondary" data-action="go-back">← Back</button>`;
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
    const dateInput = document.getElementById("log-session-date");
    const chosenDate = dateInput.value;
    logState = {
      day,
      exIndex: 0,
      setIndex: 0,
      exerciseResults: [],
      pendingPrefill: null,
      sessionDate: chosenDate
    };
    renderLogTab();
  }

  if (action === "quick-reps") {
    document.getElementById("log-reps").value = e.target.dataset.value;
  }

  if (action === "go-back") {
    goBack();
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

  if (action === "log-another") {
    renderLogTab();
  }
});

function goBack() {
  const day = logState.day;
  const exercise = day.exercises[logState.exIndex];

  if (logState.setIndex === 0) {
    if (logState.exIndex === 0) return;
    logState.exIndex--;
    const prevExercise = day.exercises[logState.exIndex];
    const prevResult = logState.exerciseResults.find(r => r.exerciseId === prevExercise.id);
    logState.setIndex = prevExercise.sets;
    logState.pendingPrefill = { feel: prevResult.feel };
    prevResult.feel = null;
  } else {
    logState.setIndex--;
    const result = logState.exerciseResults.find(r => r.exerciseId === exercise.id);
    const removedSet = result.sets.pop();
    logState.pendingPrefill = { weight: removedSet.weight, reps: removedSet.reps, rpe: removedSet.rpe };
  }

  renderLogTab();
}

function finishSession() {
  const sessionDateTime = logState.sessionDate
    ? new Date(logState.sessionDate + "T12:00:00").toISOString()
    : new Date().toISOString();

  const session = {
    id: makeId(),
    date: sessionDateTime,
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
// HISTORY TAB (shown to user as "Progress")
// ============================================================

let historyState = {
  exerciseId: null,
  range: "month",
  calendarMode: false,
  metrics: { weight: true, reps: true, rpe: false, feel: false },
  selectedLabel: null
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

  let html = `<h2>Progress</h2>`;

  html += `<div class="history-controls">`;
  html += `<select id="history-exercise-select">`;
  html += `<option value="">-- Select exercise --</option>`;
  exercises.forEach(ex => {
    const selected = ex.id === historyState.exerciseId ? "selected" : "";
    html += `<option value="${ex.id}" ${selected}>${escapeHtml(ex.name)} (${escapeHtml(ex.dayName)})</option>`;
  });
  html += `</select>`;

  html += `<select id="history-range-select">`;
  ["week", "month", "year"].forEach(r => {
    const selected = r === historyState.range ? "selected" : "";
    html += `<option value="${r}" ${selected}>${r}</option>`;
  });
  html += `</select>`;
  html += `</div>`;

  html += `<label class="calendar-toggle">
    <input type="checkbox" id="history-calendar-toggle" ${historyState.calendarMode ? "checked" : ""} />
    Calendar view (show gaps for missed days)
  </label>`;

  html += `<div class="metric-toggles">`;
  const metricLabels = { weight: "Weight", reps: "Reps", rpe: "RPE", feel: "Feel" };
  Object.keys(metricLabels).forEach(key => {
    html += `<label>
      <input type="checkbox" class="metric-toggle" data-metric="${key}" ${historyState.metrics[key] ? "checked" : ""} />
      ${metricLabels[key]}
    </label>`;
  });
  html += `</div>`;

  html += `<div id="history-chart-area"></div>`;
  html += `<div id="history-table-area"></div>`;

  container.innerHTML = html;

  if (historyState.exerciseId) {
    drawHistoryCharts();
  }
}

document.getElementById("tab-history").addEventListener("change", (e) => {
  if (e.target.id === "history-exercise-select") {
    historyState.exerciseId = e.target.value || null;
    historyState.selectedLabel = null;
    drawHistoryCharts();
  }
  if (e.target.id === "history-range-select") {
    historyState.range = e.target.value;
    historyState.selectedLabel = null;
    drawHistoryCharts();
  }
  if (e.target.id === "history-calendar-toggle") {
    historyState.calendarMode = e.target.checked;
    drawHistoryCharts();
  }
  if (e.target.classList.contains("metric-toggle")) {
    historyState.metrics[e.target.dataset.metric] = e.target.checked;
    drawHistoryCharts();
  }
});

function getRangeBounds(range) {
  const now = new Date();
  let start, end = new Date(now);
  if (range === "week") {
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    start = new Date(now);
    start.setDate(now.getDate() + diffToMonday);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
  } else if (range === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (range === "year") {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31);
  }
  return { start, end };
}

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

function formatLabel(key, range) {
  const d = new Date(key + "T00:00:00");
  if (range === "week") {
    const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
    return `${weekday} ${d.getMonth() + 1}/${d.getDate()}`;
  }
  if (range === "year") {
    return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function generateCalendarLabels(range) {
  const { start, end } = getRangeBounds(range);
  const labels = [];
  const cur = new Date(start);
  while (cur <= end) {
    labels.push(dateKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return labels;
}

function isWithinRange(dStr, range) {
  const { start, end } = getRangeBounds(range);
  const d = new Date(dStr);
  return d >= start && d <= new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59);
}

function familyColor(hue, index, total) {
  // Narrower lightness range (55 down to 35) so sets within one metric
  // family read as "shades of the same color", not visually scattered.
  const lightness = total <= 1 ? 45 : 55 - index * (20 / (total - 1));
  return `hsl(${hue}, 75%, ${lightness}%)`;
}

function drawHistoryCharts() {
  const chartArea = document.getElementById("history-chart-area");
  const tableArea = document.getElementById("history-table-area");

  if (!historyState.exerciseId) {
    chartArea.innerHTML = "";
    tableArea.innerHTML = "";
    return;
  }

  activeCharts.forEach(c => c.destroy());
  activeCharts = [];

  const sessionByLabel = {};
  let maxSets = 0;

  appData.sessions.forEach(session => {
    if (!isWithinRange(session.date, historyState.range)) return;
    const exResult = session.exercises.find(ex => ex.exerciseId === historyState.exerciseId);
    if (!exResult || exResult.sets.length === 0) return;

    const key = dateKey(new Date(session.date));
    sessionByLabel[key] = { session, exResult };
    maxSets = Math.max(maxSets, exResult.sets.length);
  });

  const loggedLabels = Object.keys(sessionByLabel).sort();

  if (loggedLabels.length === 0) {
    chartArea.innerHTML = `<p class="empty-msg">No logged data for this exercise in this range.</p>`;
    tableArea.innerHTML = "";
    return;
  }

  const labels = historyState.calendarMode ? generateCalendarLabels(historyState.range) : loggedLabels;
  const displayLabels = labels.map(l => formatLabel(l, historyState.range));

  const datasets = [];

  if (historyState.metrics.weight) {
    for (let i = 0; i < maxSets; i++) {
      datasets.push({
        label: `Weight - Set ${i + 1}`,
        data: labels.map(l => sessionByLabel[l]?.exResult.sets[i]?.weight ?? null),
        borderColor: familyColor(210, i, maxSets),
        yAxisID: "yWeight",
        spanGaps: false
      });
    }
  }

  if (historyState.metrics.reps) {
    for (let i = 0; i < maxSets; i++) {
      datasets.push({
        label: `Reps - Set ${i + 1}`,
        data: labels.map(l => sessionByLabel[l]?.exResult.sets[i]?.reps ?? null),
        borderColor: familyColor(30, i, maxSets),
        yAxisID: "yReps",
        spanGaps: false
      });
    }
  }

  if (historyState.metrics.rpe) {
    for (let i = 0; i < maxSets; i++) {
      datasets.push({
        label: `RPE - Set ${i + 1}`,
        data: labels.map(l => sessionByLabel[l]?.exResult.sets[i]?.rpe ?? null),
        borderColor: familyColor(270, i, maxSets),
        yAxisID: "yRpeFeel",
        spanGaps: false
      });
    }
  }

  if (historyState.metrics.feel) {
    datasets.push({
      label: "Feel",
      data: labels.map(l => sessionByLabel[l]?.exResult.feel ?? null),
      borderColor: "hsl(150, 60%, 40%)",
      yAxisID: "yRpeFeel",
      spanGaps: false
    });
  }

// Find the highest weight value logged, to decide the increment size.
  let maxWeightValue = 0;
  Object.values(sessionByLabel).forEach(v => {
    v.exResult.sets.forEach(s => {
      if (s.weight > maxWeightValue) maxWeightValue = s.weight;
    });
  });
  const weightStep = maxWeightValue > 60 ? 5 : 2.5;

  // Wider canvas = more room per data point = horizontal scroll instead
  // of everything squeezed into one narrow phone-width chart.
  const chartWidth = Math.max(340, displayLabels.length * 70);

  chartArea.innerHTML = `
    <div class="chart-scroll" style="width: ${chartWidth}px;">
      <canvas id="chart-progress"></canvas>
    </div>
  `;

  const scales = {};
  if (historyState.metrics.weight) {
    scales.yWeight = {
      type: "linear", position: "left", min: 0,
      ticks: { stepSize: weightStep },
      title: { display: true, text: "Weight (kg)" }
    };
  }
  if (historyState.metrics.reps) {
    scales.yReps = {
      type: "linear", position: "right", min: 0,
      title: { display: true, text: "Reps" }, grid: { drawOnChartArea: false }
    };
  }
  if (historyState.metrics.rpe || historyState.metrics.feel) {
    scales.yRpeFeel = {
      type: "linear", position: "right", min: 0, max: 10,
      ticks: { stepSize: 1 },
      title: { display: true, text: "RPE / Feel" }, grid: { drawOnChartArea: false }
    };
  }

  const chart = new Chart(document.getElementById("chart-progress"), {
    type: "line",
    data: { labels: displayLabels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales,
      onClick: (evt, elements) => {
        if (elements.length === 0) return;
        const index = elements[0].index;
        historyState.selectedLabel = labels[index];
        renderSessionTable();
      }
    }
  });

  activeCharts = [chart];

  drawHistoryCharts._sessionByLabel = sessionByLabel;

  renderSessionTable();
}

function renderSessionTable() {
  const tableArea = document.getElementById("history-table-area");
  const key = historyState.selectedLabel;
  const sessionByLabel = drawHistoryCharts._sessionByLabel || {};

  if (!key || !sessionByLabel[key]) {
    tableArea.innerHTML = `<p class="empty-msg">Tap a point on the graph to see that day's exact numbers.</p>`;
    return;
  }

  const { session, exResult } = sessionByLabel[key];

  let html = `<h3>${escapeHtml(session.dayName)} — ${new Date(session.date).toLocaleDateString()}</h3>`;
  html += `<table class="session-table"><thead><tr><th>Set</th><th>Weight</th><th>Reps</th><th>RPE</th></tr></thead><tbody>`;
  exResult.sets.forEach((s, i) => {
    html += `<tr><td>${i + 1}</td><td>${s.weight}kg</td><td>${s.reps}</td><td>${s.rpe}</td></tr>`;
  });
  html += `</tbody></table>`;
  html += `<p class="feel-line">Feel rating: <strong>${exResult.feel}</strong> / 10</p>`;

  tableArea.innerHTML = html;
}

// Redraw the chart on rotation so it picks up the new available height/width.
window.addEventListener("resize", () => {
  if (historyState.exerciseId) drawHistoryCharts();
});

// ============================================================
// STARTUP
// ============================================================
renderSetupTab();
