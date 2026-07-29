"use strict";

const DATA = [
  { id: 1, age: "청소년", income: "높음", student: "아니오", credit: "양호", result: "구매" },
  { id: 2, age: "청소년", income: "높음", student: "아니오", credit: "우수", result: "구매" },
  { id: 3, age: "청년", income: "높음", student: "아니오", credit: "양호", result: "구매" },
  { id: 4, age: "중년", income: "중간", student: "아니오", credit: "양호", result: "구매" },
  { id: 5, age: "중년", income: "낮음", student: "예", credit: "양호", result: "구매" },
  { id: 6, age: "중년", income: "낮음", student: "예", credit: "우수", result: "구매" },
  { id: 7, age: "청년", income: "낮음", student: "예", credit: "우수", result: "미구매" },
  { id: 8, age: "청소년", income: "중간", student: "아니오", credit: "양호", result: "미구매" },
  { id: 9, age: "청소년", income: "낮음", student: "예", credit: "양호", result: "미구매" },
  { id: 10, age: "중년", income: "중간", student: "예", credit: "양호", result: "구매" },
  { id: 11, age: "청소년", income: "중간", student: "예", credit: "우수", result: "미구매" },
  { id: 12, age: "청년", income: "중간", student: "아니오", credit: "우수", result: "미구매" },
  { id: 13, age: "청년", income: "높음", student: "예", credit: "양호", result: "구매" },
  { id: 14, age: "중년", income: "중간", student: "아니오", credit: "우수", result: "구매" }
];

const AXES = {
  vertical: {
    key: "age",
    title: "세로 분할 · 나이",
    shortTitle: "나이",
    values: ["청소년", "청년", "중년"],
    positions: [180, 400, 620],
    candidatePositions: [290, 510],
    questions: ["나이는 청년 이상인가?", "나이는 중년인가?"]
  },
  horizontal: {
    key: "income",
    title: "가로 분할 · 수입",
    shortTitle: "수입",
    values: ["낮음", "중간", "높음"],
    positions: [390, 245, 100],
    candidatePositions: [317.5, 172.5],
    questions: ["수입은 중간 이상인가?", "수입은 높음인가?"]
  }
};

const PLOT = { left: 90, right: 710, top: 55, bottom: 430 };
const POINT_OFFSETS = [
  [-17, -14],
  [17, -14],
  [-19, 16],
  [19, 16],
  [0, 0],
  [0, 29]
];

const state = {
  stage: "first",
  orientation: "vertical",
  candidate: 1,
  evaluatedKeys: new Set(),
  firstSplit: null,
  selectedGroup: null,
  scopeIds: DATA.map((row) => row.id),
  secondSplit: null,
  dragging: false,
  feedback: ""
};

function recordsFromIds(ids) {
  const idSet = new Set(ids);
  return DATA.filter((row) => idSet.has(row.id));
}

function counts(records) {
  const purchase = records.filter((row) => row.result === "구매").length;
  return {
    total: records.length,
    purchase,
    noPurchase: records.length - purchase
  };
}

function entropy(records) {
  if (!records.length) return 0;
  const result = counts(records);
  return [result.purchase, result.noPurchase].reduce((sum, count) => {
    if (count === 0) return sum;
    const probability = count / records.length;
    return sum - probability * Math.log2(probability);
  }, 0);
}

function splitMetrics(split, scopeIds = state.scopeIds) {
  const beforeRecords = recordsFromIds(scopeIds);
  const groupA = recordsFromIds(split.groups.A);
  const groupB = recordsFromIds(split.groups.B);
  const before = entropy(beforeRecords);
  const entropyA = entropy(groupA);
  const entropyB = entropy(groupB);
  const after = (groupA.length / beforeRecords.length) * entropyA
    + (groupB.length / beforeRecords.length) * entropyB;

  return {
    before,
    entropyA,
    entropyB,
    after,
    gain: before - after,
    perfect: entropyA < 0.0005 && entropyB < 0.0005
  };
}

function formatNumber(value) {
  const normalized = Math.abs(value) < 0.0005 ? 0 : value;
  return normalized.toFixed(3);
}

function getSplit(orientation, candidate, ids) {
  const axis = AXES[orientation];
  const records = recordsFromIds(ids);
  const aValues = axis.values.slice(0, candidate);
  const bValues = axis.values.slice(candidate);
  const groupA = records.filter((row) => aValues.includes(row[axis.key]));
  const groupB = records.filter((row) => bValues.includes(row[axis.key]));

  return {
    orientation,
    candidate,
    coordinate: axis.candidatePositions[candidate - 1],
    question: axis.questions[candidate - 1],
    aValues,
    bValues,
    groups: {
      A: groupA.map((row) => row.id),
      B: groupB.map((row) => row.id)
    }
  };
}

function validCandidates(ids, orientation) {
  return [1, 2].filter((candidate) => {
    const split = getSplit(orientation, candidate, ids);
    return split.groups.A.length > 0 && split.groups.B.length > 0;
  });
}

function bestSplitForScope(ids, orientations = ["vertical", "horizontal"]) {
  const options = orientations.flatMap((orientation) => {
    return validCandidates(ids, orientation).map((candidate) => {
      const split = getSplit(orientation, candidate, ids);
      return { split, metrics: splitMetrics(split, ids) };
    });
  });
  return options.reduce((best, option) => {
    return !best || option.metrics.gain > best.metrics.gain ? option : best;
  }, null);
}

function currentSplit() {
  return getSplit(state.orientation, state.candidate, state.scopeIds);
}

function currentEvaluationKey() {
  return `${state.stage}:${state.orientation}:${state.candidate}`;
}

function isCurrentSplitEvaluated() {
  return state.stage === "complete" || state.evaluatedKeys.has(currentEvaluationKey());
}

function clearSelectionFeedback() {
  state.feedback = "";
}

function currentScopeBounds() {
  const bounds = { x1: PLOT.left, x2: PLOT.right, y1: PLOT.top, y2: PLOT.bottom };
  if ((state.stage !== "second" && state.stage !== "complete") || !state.firstSplit) {
    return bounds;
  }

  if (state.firstSplit.orientation === "vertical") {
    if (state.selectedGroup === "A") bounds.x2 = state.firstSplit.coordinate;
    else bounds.x1 = state.firstSplit.coordinate;
  } else {
    if (state.selectedGroup === "A") bounds.y1 = state.firstSplit.coordinate;
    else bounds.y2 = state.firstSplit.coordinate;
  }
  return bounds;
}

function setScreen(screen) {
  document.querySelectorAll(".screen").forEach((element) => {
    element.classList.toggle("is-active", element.id === `${screen}-screen`);
  });
  document.querySelectorAll("[data-header-step]").forEach((element) => {
    const step = Number(element.dataset.headerStep);
    const activeStep = screen === "intro" ? 1 : state.stage === "first" ? 2 : 3;
    element.classList.toggle("is-active", step === activeStep);
    element.classList.toggle("is-done", step < activeStep);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetExperience() {
  state.stage = "first";
  state.orientation = "vertical";
  state.candidate = 1;
  state.evaluatedKeys.clear();
  state.firstSplit = null;
  state.selectedGroup = null;
  state.scopeIds = DATA.map((row) => row.id);
  state.secondSplit = null;
  state.dragging = false;
  state.feedback = "";
  renderAll();
}

function pointPosition(row, cellIndex) {
  const x = AXES.vertical.positions[AXES.vertical.values.indexOf(row.age)];
  const y = AXES.horizontal.positions[AXES.horizontal.values.indexOf(row.income)];
  const offset = POINT_OFFSETS[cellIndex % POINT_OFFSETS.length];
  return { x: x + offset[0], y: y + offset[1] };
}

function pointMarkup(row, position) {
  const commonClass = "data-point";
  const tooltip = `고객 ${row.id}: ${row.age}, 수입 ${row.income}, ${row.student === "예" ? "학생" : "비학생"}, 신용 ${row.credit}, ${row.result}`;
  if (row.result === "구매") {
    return `
      <g class="${commonClass}">
        <title>${tooltip}</title>
        <circle class="point-buy" cx="${position.x}" cy="${position.y}" r="16"></circle>
        <text class="point-id" x="${position.x}" y="${position.y + 4}">${row.id}</text>
      </g>
    `;
  }
  const points = `${position.x},${position.y - 18} ${position.x - 17},${position.y + 13} ${position.x + 17},${position.y + 13}`;
  return `
    <g class="${commonClass}">
      <title>${tooltip}</title>
      <polygon class="point-no" points="${points}"></polygon>
      <text class="point-id" x="${position.x}" y="${position.y + 7}">${row.id}</text>
    </g>
  `;
}

function regionMarkup(split, bounds) {
  if (split.orientation === "vertical") {
    return `
      <rect class="region-a" x="${bounds.x1}" y="${bounds.y1}" width="${Math.max(0, split.coordinate - bounds.x1)}" height="${bounds.y2 - bounds.y1}"></rect>
      <rect class="region-b" x="${split.coordinate}" y="${bounds.y1}" width="${Math.max(0, bounds.x2 - split.coordinate)}" height="${bounds.y2 - bounds.y1}"></rect>
      ${regionLabelMarkup("A", (bounds.x1 + split.coordinate) / 2, bounds.y1 + 23)}
      ${regionLabelMarkup("B", (split.coordinate + bounds.x2) / 2, bounds.y1 + 23)}
    `;
  }
  return `
    <rect class="region-b" x="${bounds.x1}" y="${bounds.y1}" width="${bounds.x2 - bounds.x1}" height="${Math.max(0, split.coordinate - bounds.y1)}"></rect>
    <rect class="region-a" x="${bounds.x1}" y="${split.coordinate}" width="${bounds.x2 - bounds.x1}" height="${Math.max(0, bounds.y2 - split.coordinate)}"></rect>
    ${regionLabelMarkup("B", bounds.x1 + 45, (bounds.y1 + split.coordinate) / 2)}
    ${regionLabelMarkup("A", bounds.x1 + 45, (split.coordinate + bounds.y2) / 2)}
  `;
}

function regionLabelMarkup(group, x, y) {
  return `
    <g class="region-label ${group.toLowerCase()}">
      <rect x="${x - 34}" y="${y - 14}" width="68" height="28" rx="14"></rect>
      <text x="${x}" y="${y + 4}">${group} 집단</text>
    </g>
  `;
}

function splitLineMarkup(split, bounds, options = {}) {
  const {
    active = false,
    selected = false,
    candidateNumber = null,
    stageNumber = null,
    gain = null
  } = options;
  const number = candidateNumber ?? stageNumber;
  const colorNumber = candidateNumber ?? stageNumber ?? 1;
  const id = active ? 'id="active-split-line"' : "";
  const dataCandidate = candidateNumber ? `data-candidate-line="${candidateNumber}"` : "";
  const classes = [
    "split-line-group",
    selected ? "is-selected" : "",
    active ? "is-active" : "",
    gain !== null ? "is-evaluated" : "",
    stageNumber ? "is-fixed" : ""
  ].filter(Boolean).join(" ");
  const tabIndex = active
    ? 'tabindex="0" role="slider" aria-label="선택한 분할선 위치"'
    : candidateNumber
      ? `tabindex="0" role="button" aria-label="${candidateNumber}번 분할선 선택"`
      : "";
  const badgeLabel = stageNumber ? `${stageNumber}차` : `${number}`;

  if (split.orientation === "vertical") {
    const midY = (bounds.y1 + bounds.y2) / 2;
    return `
      <g ${id} class="${classes}" ${dataCandidate} ${tabIndex}
        style="--split-color: var(--candidate-${colorNumber})">
        <line class="split-line-hit" x1="${split.coordinate}" y1="${bounds.y1}" x2="${split.coordinate}" y2="${bounds.y2}"></line>
        <line class="split-line-main" x1="${split.coordinate}" y1="${bounds.y1}" x2="${split.coordinate}" y2="${bounds.y2}"></line>
        ${lineNumberMarkup(split.coordinate, bounds.y1 + 18, badgeLabel, Boolean(stageNumber))}
        ${gain === null ? "" : gainBadgeMarkup(split.coordinate, bounds.y1 + 55, gain)}
        ${active ? `
          <circle class="split-handle" cx="${split.coordinate}" cy="${midY}" r="16"></circle>
          <text class="split-handle-mark" x="${split.coordinate}" y="${midY + 5}">↔</text>
        ` : ""}
      </g>
    `;
  }

  const midX = (bounds.x1 + bounds.x2) / 2;
  return `
    <g ${id} class="${classes}" ${dataCandidate} ${tabIndex}
      style="--split-color: var(--candidate-${colorNumber})">
      <line class="split-line-hit" x1="${bounds.x1}" y1="${split.coordinate}" x2="${bounds.x2}" y2="${split.coordinate}"></line>
      <line class="split-line-main" x1="${bounds.x1}" y1="${split.coordinate}" x2="${bounds.x2}" y2="${split.coordinate}"></line>
      ${lineNumberMarkup(bounds.x2 - 24, split.coordinate, badgeLabel, Boolean(stageNumber))}
      ${gain === null ? "" : gainBadgeMarkup(bounds.x2 - 92, split.coordinate - 23, gain)}
      ${active ? `
        <circle class="split-handle" cx="${midX}" cy="${split.coordinate}" r="16"></circle>
        <text class="split-handle-mark" x="${midX}" y="${split.coordinate + 5}">↕</text>
      ` : ""}
    </g>
  `;
}

function lineNumberMarkup(x, y, label, isStageLabel = false) {
  const width = isStageLabel ? 48 : 30;
  return `
    <g class="line-number ${isStageLabel ? "is-stage-label" : ""}">
      <rect x="${x - width / 2}" y="${y - 15}" width="${width}" height="30" rx="15"></rect>
      <text x="${x}" y="${y + 5}">${label}</text>
    </g>
  `;
}

function gainBadgeMarkup(x, y, gain) {
  return `
    <g class="line-gain-badge">
      <rect x="${x - 58}" y="${y - 14}" width="116" height="28" rx="14"></rect>
      <text x="${x}" y="${y + 5}">정보이득 ${formatNumber(gain)}</text>
    </g>
  `;
}

function selectableLinesMarkup(bounds) {
  return validCandidates(state.scopeIds, state.orientation).map((candidate) => {
    const split = getSplit(state.orientation, candidate, state.scopeIds);
    const selected = candidate === state.candidate;
    const evaluationKey = `${state.stage}:${state.orientation}:${candidate}`;
    const gain = state.evaluatedKeys.has(evaluationKey)
      ? splitMetrics(split, state.scopeIds).gain
      : null;
    return splitLineMarkup(split, bounds, {
      active: selected,
      selected,
      candidateNumber: candidate,
      gain
    });
  }).join("");
}

function axesMarkup() {
  return `
    <line class="plot-axis" x1="${PLOT.left}" y1="${PLOT.bottom}" x2="${PLOT.right + 18}" y2="${PLOT.bottom}"></line>
    <line class="plot-axis" x1="${PLOT.left}" y1="${PLOT.bottom}" x2="${PLOT.left}" y2="${PLOT.top - 15}"></line>

    ${AXES.vertical.positions.map((x) => `<line class="plot-grid-line" x1="${x}" y1="${PLOT.top}" x2="${x}" y2="${PLOT.bottom}"></line>`).join("")}
    ${AXES.horizontal.positions.map((y) => `<line class="plot-grid-line" x1="${PLOT.left}" y1="${y}" x2="${PLOT.right}" y2="${y}"></line>`).join("")}

    ${AXES.vertical.values.map((value, index) => `<text class="axis-value" x="${AXES.vertical.positions[index]}" y="${PLOT.bottom + 27}" text-anchor="middle">${value}</text>`).join("")}
    ${AXES.horizontal.values.map((value, index) => `<text class="axis-value" x="${PLOT.left - 15}" y="${AXES.horizontal.positions[index] + 5}" text-anchor="end">${value}</text>`).join("")}

    <text class="axis-label" x="${PLOT.right + 16}" y="${PLOT.bottom + 28}" text-anchor="end">나이</text>
    <text class="axis-label" x="${PLOT.left - 53}" y="${PLOT.top - 20}">수입</text>
  `;
}

function renderPlot() {
  const plotWrap = document.getElementById("plot-wrap");
  const scopeBounds = currentScopeBounds();
  let regions = "";
  let lines = "";
  let displayedSplit = currentSplit();

  if (state.stage === "first") {
    regions = regionMarkup(displayedSplit, scopeBounds);
    lines = selectableLinesMarkup(scopeBounds);
  } else if (state.stage === "second") {
    displayedSplit = currentSplit();
    regions = regionMarkup(displayedSplit, scopeBounds);
    lines = `
      ${selectableLinesMarkup(scopeBounds)}
      <rect class="scope-outline" x="${scopeBounds.x1 + 2}" y="${scopeBounds.y1 + 2}"
        width="${scopeBounds.x2 - scopeBounds.x1 - 4}" height="${scopeBounds.y2 - scopeBounds.y1 - 4}" rx="8"></rect>
      <text class="scope-caption" x="${scopeBounds.x1 + 10}" y="${scopeBounds.y2 - 10}">재분할 집단</text>
    `;
  } else {
    displayedSplit = state.secondSplit;
    const rootBounds = { x1: PLOT.left, x2: PLOT.right, y1: PLOT.top, y2: PLOT.bottom };
    regions = regionMarkup(displayedSplit, scopeBounds);
    lines = `
      ${splitLineMarkup(state.firstSplit, rootBounds, { stageNumber: 1 })}
      ${splitLineMarkup(displayedSplit, scopeBounds, { stageNumber: 2 })}
      <rect class="scope-outline" x="${scopeBounds.x1 + 2}" y="${scopeBounds.y1 + 2}"
        width="${scopeBounds.x2 - scopeBounds.x1 - 4}" height="${scopeBounds.y2 - scopeBounds.y1 - 4}" rx="8"></rect>
      <text class="scope-caption" x="${scopeBounds.x1 + 10}" y="${scopeBounds.y2 - 10}">재분할 집단</text>
    `;
  }
  plotWrap.classList.toggle(
    "is-perfect",
    isCurrentSplitEvaluated() && state.stage !== "first" && splitMetrics(displayedSplit).perfect
  );

  const cellCounts = new Map();
  const pointRows = state.stage === "second" ? recordsFromIds(state.scopeIds) : DATA;
  const points = pointRows.map((row) => {
    const cellKey = `${row.age}-${row.income}`;
    const index = cellCounts.get(cellKey) || 0;
    cellCounts.set(cellKey, index + 1);
    return pointMarkup(row, pointPosition(row, index));
  }).join("");

  plotWrap.innerHTML = `
    <svg id="scatter-svg" class="scatter-svg" viewBox="0 0 770 475"
      aria-label="나이와 수입에 따른 고객 14명의 분포">
      ${regions}
      ${axesMarkup()}
      ${points}
      ${lines}
    </svg>
  `;

  bindDragEvents();
}

function renderOrientationControls() {
  const container = document.getElementById("orientation-controls");
  if (state.stage === "complete") {
    container.innerHTML = "";
    container.hidden = true;
    return;
  }

  container.hidden = false;
  const orientations = state.stage === "second"
    ? [state.firstSplit.orientation === "vertical" ? "horizontal" : "vertical"]
    : ["vertical", "horizontal"];
  container.classList.toggle("is-single", orientations.length === 1);
  container.innerHTML = orientations.map((orientation) => {
    const valid = validCandidates(state.scopeIds, orientation).length > 0;
    const prefix = state.stage === "second" ? "두 번째 분할" : AXES[orientation].title;
    return `
      <button class="orientation-button ${state.orientation === orientation ? "is-active" : ""}"
        type="button" data-orientation="${orientation}" ${valid ? "" : "disabled"}>
        ${orientation === "vertical" ? "↔" : "↕"} ${prefix}${state.stage === "second" ? ` · ${AXES[orientation].shortTitle}` : ""}
      </button>
    `;
  }).join("");

  container.querySelectorAll("[data-orientation]").forEach((button) => {
    button.addEventListener("click", () => {
      state.orientation = button.dataset.orientation;
      state.candidate = validCandidates(state.scopeIds, state.orientation)[0];
      clearSelectionFeedback();
      renderAll();
    });
  });
}

function candidateLabel(orientation, candidate) {
  const axis = AXES[orientation];
  return `${axis.values.slice(0, candidate).join("·")} │ ${axis.values.slice(candidate).join("·")}`;
}

function renderCandidateControls() {
  const container = document.getElementById("candidate-controls");
  if (state.stage === "complete") {
    container.innerHTML = "";
    container.hidden = true;
    return;
  }

  container.hidden = false;
  const candidates = validCandidates(state.scopeIds, state.orientation);
  container.innerHTML = `
    <span>분할 후보</span>
    ${candidates.map((candidate) => `
      <button class="candidate-button candidate-${candidate} ${state.candidate === candidate ? "is-active" : ""}"
        type="button" data-candidate="${candidate}">
        <b>${candidate}</b>
        <span>${candidateLabel(state.orientation, candidate)}</span>
      </button>
    `).join("")}
  `;

  container.querySelectorAll("[data-candidate]").forEach((button) => {
    button.addEventListener("click", () => {
      state.candidate = Number(button.dataset.candidate);
      clearSelectionFeedback();
      renderAll();
    });
  });
}

function summaryCard(group, label, records) {
  const result = counts(records);
  const groupEntropy = entropy(records);
  return `
    <article class="summary-group ${group.toLowerCase()}">
      <div class="summary-group-top">
        <strong>${group} · ${result.total}명</strong>
        <em>${label} · H = ${formatNumber(groupEntropy)}</em>
      </div>
      <div class="summary-counts">
        <span class="buy-text">● 구매 ${result.purchase}</span>
        <span class="no-text">▲ 미구매 ${result.noPurchase}</span>
      </div>
    </article>
  `;
}

function renderSplitMetrics() {
  const container = document.getElementById("split-metrics");
  if (!isCurrentSplitEvaluated()) {
    container.classList.remove("is-perfect");
    container.classList.add("is-pending");
    container.innerHTML = `
      <div class="metrics-pending">
        <strong>정보이득은 아직 공개되지 않았습니다.</strong>
        <span>분할선 번호 선택 → ‘분할’ 클릭</span>
      </div>
    `;
    return;
  }

  const split = state.stage === "complete" ? state.secondSplit : currentSplit();
  const metrics = splitMetrics(split);
  container.classList.remove("is-pending");
  container.classList.toggle("is-perfect", metrics.perfect);
  container.innerHTML = `
    <div class="metric-value">
      <span>분할 전 엔트로피</span>
      <strong>${formatNumber(metrics.before)}</strong>
    </div>
    <b class="metric-operator" aria-hidden="true">−</b>
    <div class="metric-value">
      <span>분할 후 엔트로피</span>
      <strong>${formatNumber(metrics.after)}</strong>
    </div>
    <b class="metric-operator" aria-hidden="true">=</b>
    <div class="metric-value gain">
      <span>정보이득</span>
      <strong>${formatNumber(metrics.gain)}</strong>
    </div>
    ${metrics.perfect ? '<span class="perfect-badge">✓ 완전 분리</span>' : ""}
  `;
}

function renderGroupSummary() {
  const container = document.getElementById("group-summary");
  if (!isCurrentSplitEvaluated()) {
    container.innerHTML = "";
    container.hidden = true;
    return;
  }

  container.hidden = false;
  const split = state.stage === "complete" ? state.secondSplit : currentSplit();
  const groupA = recordsFromIds(split.groups.A);
  const groupB = recordsFromIds(split.groups.B);
  container.innerHTML = `
    ${summaryCard("A", split.aValues.join("·"), groupA)}
    ${summaryCard("B", split.bValues.join("·"), groupB)}
  `;
}

function groupNodeMarkup(ids, values) {
  const records = recordsFromIds(ids);
  const result = counts(records);
  const groupEntropy = entropy(records);
  if (groupEntropy >= 0.0005) {
    return `
      <div class="group-node mixed-node is-selected">
        <strong>${values.join(" · ")}</strong>
        <span>혼합 · ${result.total}명 · H ${formatNumber(groupEntropy)}</span>
        <small><i class="buy-text">● 구매 ${result.purchase}</i> · <i class="no-text">▲ 미구매 ${result.noPurchase}</i></small>
      </div>
    `;
  }

  const classification = result.purchase === result.total ? "구매" : "미구매";
  const leafClass = classification === "구매" ? "is-buy" : "is-no";
  return `
    <div class="group-node leaf-node ${leafClass}">
      <strong>${values.join(" · ")}</strong>
      <span>리프 · ${result.total}명</span>
      <small class="leaf-result">${classification === "구매" ? "●" : "▲"} ${classification}</small>
    </div>
  `;
}

function secondSubtreeMarkup(split) {
  const metrics = splitMetrics(split, state.scopeIds);
  return `
    <div class="subtree">
      <div class="question-node">
        <small>두 번째 질문 · 정보이득 ${formatNumber(metrics.gain)}</small>
        ${split.question}
      </div>
      <div class="tree-branches">
        <div class="tree-branch">
          <span class="branch-label">아니오</span>
          ${groupNodeMarkup(split.groups.A, split.aValues)}
        </div>
        <div class="tree-branch">
          <span class="branch-label">예</span>
          ${groupNodeMarkup(split.groups.B, split.bValues)}
        </div>
      </div>
    </div>
  `;
}

function renderTree() {
  const treeStage = document.getElementById("tree-stage");
  const treeGuide = document.getElementById("tree-guide");
  const questionCount = document.getElementById("question-count");

  if (!state.firstSplit) {
    questionCount.textContent = "질문 0개";
    treeStage.innerHTML = `
      <div class="empty-tree">
        <div class="empty-question">?</div>
        <strong>질문 없음</strong>
        <small>분할선 확정 대기</small>
      </div>
    `;
    treeGuide.classList.remove("is-active");
    treeGuide.textContent = "분할선 확정 → 질문 생성";
    return;
  }

  questionCount.textContent = `질문 ${state.secondSplit ? 2 : 1}개`;
  const root = state.firstSplit;
  const rootMetrics = splitMetrics(root, DATA.map((row) => row.id));
  const branchA = state.selectedGroup === "A" && state.secondSplit
    ? secondSubtreeMarkup(state.secondSplit)
    : groupNodeMarkup(root.groups.A, root.aValues);
  const branchB = state.selectedGroup === "B" && state.secondSplit
    ? secondSubtreeMarkup(state.secondSplit)
    : groupNodeMarkup(root.groups.B, root.bValues);

  treeStage.innerHTML = `
    <div class="tree-root">
      <div class="question-node">
        <small>첫 번째 질문 · 정보이득 ${formatNumber(rootMetrics.gain)}</small>
        ${root.question}
      </div>
      <div class="tree-branches">
        <div class="tree-branch">
          <span class="branch-label">아니오</span>
          ${branchA}
        </div>
        <div class="tree-branch">
          <span class="branch-label">예</span>
          ${branchB}
        </div>
      </div>
    </div>
  `;

  treeGuide.classList.add("is-active");
  treeGuide.textContent = state.stage === "second"
    ? "혼합 집단 → 수입으로 재분할"
    : "질문 2개 → 리프 3개";
}

function renderStageText() {
  const chip = document.getElementById("stage-chip");
  const guide = document.getElementById("action-guide");
  const confirm = document.getElementById("confirm-split-button");
  const completion = document.getElementById("completion-banner");

  const stageText = {
    first: "1차 · 나이 분할",
    second: "2차 · 수입 분할",
    complete: "트리 완성"
  };
  chip.textContent = stageText[state.stage];
  completion.hidden = state.stage !== "complete";
  guide.classList.remove("is-error", "is-perfect");

  if (state.stage === "first") {
    if (state.feedback) {
      guide.textContent = state.feedback;
      guide.classList.add("is-error");
    } else if (!isCurrentSplitEvaluated()) {
      guide.textContent = "몇 번 분할선으로 나눌까요?";
    } else {
      const metrics = splitMetrics(currentSplit());
      const best = bestSplitForScope(state.scopeIds);
      const isBest = Math.abs(metrics.gain - best.metrics.gain) < 0.0005;
      guide.textContent = isBest
        ? "정보이득 최대 · 이 분할로 진행"
        : "정보이득 확인 · 다른 분할선과 비교";
      guide.classList.toggle("is-perfect", isBest);
    }
    confirm.hidden = false;
    confirm.disabled = false;
    confirm.textContent = isCurrentSplitEvaluated() ? "1차 분할 확정" : "분할";
  } else if (state.stage === "second") {
    if (state.feedback) {
      guide.textContent = state.feedback;
      guide.classList.add("is-error");
    } else if (!isCurrentSplitEvaluated()) {
      guide.textContent = "몇 번 분할선으로 나눌까요?";
    } else {
      const metrics = splitMetrics(currentSplit());
      if (metrics.perfect) {
        guide.textContent = "완전 분리 · 엔트로피 0";
        guide.classList.add("is-perfect");
      } else {
        guide.textContent = "정보이득 확인 · 다른 분할선과 비교";
      }
    }
    confirm.hidden = false;
    confirm.disabled = false;
    confirm.textContent = isCurrentSplitEvaluated() ? "2차 분할 확정" : "분할";
  } else {
    const firstGain = splitMetrics(state.firstSplit, DATA.map((row) => row.id)).gain;
    const secondGain = splitMetrics(state.secondSplit, state.scopeIds).gain;
    guide.textContent = `정보이득 ${formatNumber(firstGain)} → ${formatNumber(secondGain)} · 리프 완성`;
    guide.classList.add("is-perfect");
    confirm.hidden = true;
  }

  document.querySelectorAll("[data-header-step]").forEach((element) => {
    const step = Number(element.dataset.headerStep);
    const active = state.stage === "complete" ? 3 : 2;
    element.classList.toggle("is-active", step === active);
    element.classList.toggle("is-done", step < active);
  });
}

function renderAll() {
  renderOrientationControls();
  renderPlot();
  renderCandidateControls();
  renderSplitMetrics();
  renderGroupSummary();
  renderTree();
  renderStageText();
}

function confirmCurrentSplit() {
  if (!isCurrentSplitEvaluated()) {
    state.evaluatedKeys.add(currentEvaluationKey());
    state.feedback = "";
    renderAll();
    return;
  }

  if (state.stage === "first") {
    const split = currentSplit();
    const metrics = splitMetrics(split);
    const best = bestSplitForScope(state.scopeIds);
    if (Math.abs(metrics.gain - best.metrics.gain) >= 0.0005) {
      state.feedback = "더 큰 정보이득의 분할 후보 존재";
      renderAll();
      return;
    }

    state.firstSplit = split;
    const mixedGroups = ["A", "B"].filter((group) => {
      return entropy(recordsFromIds(split.groups[group])) >= 0.0005;
    });
    state.selectedGroup = mixedGroups.sort((a, b) => {
      return entropy(recordsFromIds(split.groups[b])) - entropy(recordsFromIds(split.groups[a]));
    })[0];
    state.scopeIds = [...split.groups[state.selectedGroup]];
    state.orientation = split.orientation === "vertical" ? "horizontal" : "vertical";
    state.candidate = validCandidates(state.scopeIds, state.orientation)[0];
    state.feedback = "";
    state.stage = "second";
    renderAll();
    return;
  }

  if (state.stage === "second") {
    const split = currentSplit();
    const metrics = splitMetrics(split);
    if (!metrics.perfect) {
      state.feedback = "혼합 상태 유지 · 다른 위치 선택";
      renderAll();
      return;
    }

    state.secondSplit = split;
    state.feedback = "";
    state.stage = "complete";
    renderAll();
  }
}

function svgPoint(event, svg) {
  const rect = svg.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 770,
    y: ((event.clientY - rect.top) / rect.height) * 475
  };
}

function updateDragPreview(coordinate) {
  const line = document.querySelector("#active-split-line .split-line-main");
  const hit = document.querySelector("#active-split-line .split-line-hit");
  const handle = document.querySelector("#active-split-line .split-handle");
  const mark = document.querySelector("#active-split-line .split-handle-mark");
  const caption = document.querySelector("#active-split-line .line-caption");
  if (!line || !hit || !handle || !mark) return;

  if (state.orientation === "vertical") {
    line.setAttribute("x1", coordinate);
    line.setAttribute("x2", coordinate);
    hit.setAttribute("x1", coordinate);
    hit.setAttribute("x2", coordinate);
    handle.setAttribute("cx", coordinate);
    mark.setAttribute("x", coordinate);
    if (caption) caption.setAttribute("transform", `translate(${coordinate - currentSplit().coordinate} 0)`);
  } else {
    line.setAttribute("y1", coordinate);
    line.setAttribute("y2", coordinate);
    hit.setAttribute("y1", coordinate);
    hit.setAttribute("y2", coordinate);
    handle.setAttribute("cy", coordinate);
    mark.setAttribute("y", coordinate + 5);
    if (caption) caption.setAttribute("transform", `translate(0 ${coordinate - currentSplit().coordinate})`);
  }
}

function bindDragEvents() {
  if (state.stage !== "first" && state.stage !== "second") return;
  const svg = document.getElementById("scatter-svg");
  const lineGroup = document.getElementById("active-split-line");
  if (!svg || !lineGroup) return;

  document.querySelectorAll("[data-candidate-line]").forEach((candidateLine) => {
    const selectCandidate = () => {
      const candidate = Number(candidateLine.dataset.candidateLine);
      if (candidate === state.candidate) return;
      state.candidate = candidate;
      clearSelectionFeedback();
      renderAll();
    };
    candidateLine.addEventListener("click", selectCandidate);
    candidateLine.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectCandidate();
    });
  });

  const candidates = validCandidates(state.scopeIds, state.orientation);
  const coordinates = candidates.map((candidate) => AXES[state.orientation].candidatePositions[candidate - 1]);

  lineGroup.addEventListener("pointerdown", (event) => {
    state.dragging = true;
    svg.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  svg.addEventListener("pointermove", (event) => {
    if (!state.dragging) return;
    const point = svgPoint(event, svg);
    const raw = state.orientation === "vertical" ? point.x : point.y;
    const min = Math.min(...coordinates);
    const max = Math.max(...coordinates);
    updateDragPreview(Math.max(min, Math.min(max, raw)));
  });

  svg.addEventListener("pointerup", (event) => {
    if (!state.dragging) return;
    state.dragging = false;
    const point = svgPoint(event, svg);
    const raw = state.orientation === "vertical" ? point.x : point.y;
    const nearestIndex = coordinates.reduce((best, coordinate, index) => {
      return Math.abs(coordinate - raw) < Math.abs(coordinates[best] - raw) ? index : best;
    }, 0);
    state.candidate = candidates[nearestIndex];
    clearSelectionFeedback();
    renderAll();
  });

  lineGroup.addEventListener("keydown", (event) => {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const currentIndex = candidates.indexOf(state.candidate);
    const forward = event.key === "ArrowRight" || event.key === "ArrowUp";
    const nextIndex = Math.max(0, Math.min(candidates.length - 1, currentIndex + (forward ? 1 : -1)));
    state.candidate = candidates[nextIndex];
    clearSelectionFeedback();
    renderAll();
    document.getElementById("active-split-line")?.focus();
  });
}

document.getElementById("start-button").addEventListener("click", () => {
  resetExperience();
  setScreen("lab");
});

document.getElementById("confirm-split-button").addEventListener("click", confirmCurrentSplit);
document.getElementById("restart-button").addEventListener("click", resetExperience);

renderAll();
setScreen("intro");
