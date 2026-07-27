"use strict";

const DATA = [
  { id: 1, age: "청소년", income: "높음", student: "아니오", credit: "양호", result: "미구매" },
  { id: 2, age: "청소년", income: "높음", student: "아니오", credit: "우수", result: "미구매" },
  { id: 3, age: "청년", income: "높음", student: "아니오", credit: "양호", result: "구매" },
  { id: 4, age: "중년", income: "중간", student: "아니오", credit: "양호", result: "구매" },
  { id: 5, age: "중년", income: "낮음", student: "예", credit: "양호", result: "구매" },
  { id: 6, age: "중년", income: "낮음", student: "예", credit: "우수", result: "미구매" },
  { id: 7, age: "청년", income: "낮음", student: "예", credit: "우수", result: "구매" },
  { id: 8, age: "청소년", income: "중간", student: "아니오", credit: "양호", result: "미구매" },
  { id: 9, age: "청소년", income: "낮음", student: "예", credit: "양호", result: "구매" },
  { id: 10, age: "중년", income: "중간", student: "예", credit: "양호", result: "구매" },
  { id: 11, age: "청소년", income: "중간", student: "예", credit: "우수", result: "구매" },
  { id: 12, age: "청년", income: "중간", student: "아니오", credit: "우수", result: "구매" },
  { id: 13, age: "청년", income: "높음", student: "예", credit: "양호", result: "구매" },
  { id: 14, age: "중년", income: "중간", student: "아니오", credit: "우수", result: "미구매" }
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
  firstSplit: null,
  selectedGroup: null,
  scopeIds: DATA.map((row) => row.id),
  secondSplit: null,
  dragging: false
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

function firstValidOrientation(ids, preferred) {
  const order = [preferred, preferred === "vertical" ? "horizontal" : "vertical"];
  return order.find((orientation) => validCandidates(ids, orientation).length) || "vertical";
}

function currentSplit() {
  return getSplit(state.orientation, state.candidate, state.scopeIds);
}

function currentScopeBounds() {
  if (state.stage === "first" || state.stage === "choose" || !state.firstSplit) {
    return { x1: PLOT.left, x2: PLOT.right, y1: PLOT.top, y2: PLOT.bottom };
  }

  const root = state.firstSplit;
  const bounds = { x1: PLOT.left, x2: PLOT.right, y1: PLOT.top, y2: PLOT.bottom };
  if (root.orientation === "vertical") {
    if (state.selectedGroup === "A") bounds.x2 = root.coordinate;
    else bounds.x1 = root.coordinate;
  } else {
    if (state.selectedGroup === "A") bounds.y1 = root.coordinate;
    else bounds.y2 = root.coordinate;
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
  state.firstSplit = null;
  state.selectedGroup = null;
  state.scopeIds = DATA.map((row) => row.id);
  state.secondSplit = null;
  state.dragging = false;
  renderAll();
}

function pointPosition(row, cellIndex) {
  const x = AXES.vertical.positions[AXES.vertical.values.indexOf(row.age)];
  const y = AXES.horizontal.positions[AXES.horizontal.values.indexOf(row.income)];
  const offset = POINT_OFFSETS[cellIndex % POINT_OFFSETS.length];
  return { x: x + offset[0], y: y + offset[1] };
}

function pointMarkup(row, position, isDimmed) {
  const commonClass = `data-point ${isDimmed ? "is-dimmed" : ""}`;
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

function splitLineMarkup(split, bounds, active) {
  const fixedClass = active ? "" : "is-fixed";
  const id = active ? "active-split-line" : "fixed-split-line";
  const tabIndex = active ? 'tabindex="0" role="slider" aria-label="분할선 위치"' : "";

  if (split.orientation === "vertical") {
    const midY = (bounds.y1 + bounds.y2) / 2;
    return `
      <g id="${id}" class="split-line-group ${fixedClass}" ${tabIndex}>
        <line class="split-line-hit" x1="${split.coordinate}" y1="${bounds.y1}" x2="${split.coordinate}" y2="${bounds.y2}"></line>
        <line class="split-line-main" x1="${split.coordinate}" y1="${bounds.y1}" x2="${split.coordinate}" y2="${bounds.y2}"></line>
        ${active ? `
          <circle class="split-handle" cx="${split.coordinate}" cy="${midY}" r="16"></circle>
          <text class="split-handle-mark" x="${split.coordinate}" y="${midY + 5}">↔</text>
          ${lineCaptionMarkup(split.coordinate, bounds.y1 + 17)}
        ` : ""}
      </g>
    `;
  }

  const midX = (bounds.x1 + bounds.x2) / 2;
  return `
    <g id="${id}" class="split-line-group ${fixedClass}" ${tabIndex}>
      <line class="split-line-hit" x1="${bounds.x1}" y1="${split.coordinate}" x2="${bounds.x2}" y2="${split.coordinate}"></line>
      <line class="split-line-main" x1="${bounds.x1}" y1="${split.coordinate}" x2="${bounds.x2}" y2="${split.coordinate}"></line>
      ${active ? `
        <circle class="split-handle" cx="${midX}" cy="${split.coordinate}" r="16"></circle>
        <text class="split-handle-mark" x="${midX}" y="${split.coordinate + 5}">↕</text>
        ${lineCaptionMarkup(bounds.x2 - 39, split.coordinate)}
      ` : ""}
    </g>
  `;
}

function lineCaptionMarkup(x, y) {
  return `
    <g class="line-caption">
      <rect x="${x - 34}" y="${y - 13}" width="68" height="26" rx="7"></rect>
      <text x="${x}" y="${y + 4}">분할선</text>
    </g>
  `;
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
  const current = currentSplit();
  const scopeBounds = currentScopeBounds();
  const scopeSet = new Set(state.scopeIds);

  let regions = "";
  let lines = "";
  if (state.stage === "first") {
    regions = regionMarkup(current, scopeBounds);
    lines = splitLineMarkup(current, scopeBounds, true);
  } else if (state.stage === "choose") {
    const rootBounds = { x1: PLOT.left, x2: PLOT.right, y1: PLOT.top, y2: PLOT.bottom };
    regions = regionMarkup(state.firstSplit, rootBounds);
    lines = splitLineMarkup(state.firstSplit, rootBounds, false);
  } else {
    const rootBounds = { x1: PLOT.left, x2: PLOT.right, y1: PLOT.top, y2: PLOT.bottom };
    const second = state.stage === "complete" ? state.secondSplit : current;
    regions = regionMarkup(second, scopeBounds);
    lines = `
      ${splitLineMarkup(state.firstSplit, rootBounds, false)}
      ${splitLineMarkup(second, scopeBounds, state.stage === "second")}
      <rect class="scope-outline" x="${scopeBounds.x1 + 2}" y="${scopeBounds.y1 + 2}"
        width="${scopeBounds.x2 - scopeBounds.x1 - 4}" height="${scopeBounds.y2 - scopeBounds.y1 - 4}" rx="8"></rect>
      <text class="scope-caption" x="${scopeBounds.x1 + 10}" y="${scopeBounds.y2 - 10}">선택한 하위 집단</text>
    `;
  }

  const cellCounts = new Map();
  const points = DATA.map((row) => {
    const cellKey = `${row.age}-${row.income}`;
    const index = cellCounts.get(cellKey) || 0;
    cellCounts.set(cellKey, index + 1);
    const dimmed = (state.stage === "second" || state.stage === "complete") && !scopeSet.has(row.id);
    return pointMarkup(row, pointPosition(row, index), dimmed);
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
  if (state.stage === "choose" || state.stage === "complete") {
    container.innerHTML = "";
    container.hidden = true;
    return;
  }

  container.hidden = false;
  container.innerHTML = ["vertical", "horizontal"].map((orientation) => {
    const valid = validCandidates(state.scopeIds, orientation).length > 0;
    return `
      <button class="orientation-button ${state.orientation === orientation ? "is-active" : ""}"
        type="button" data-orientation="${orientation}" ${valid ? "" : "disabled"}>
        ${orientation === "vertical" ? "↔" : "↕"} ${AXES[orientation].title}
      </button>
    `;
  }).join("");

  container.querySelectorAll("[data-orientation]").forEach((button) => {
    button.addEventListener("click", () => {
      state.orientation = button.dataset.orientation;
      state.candidate = validCandidates(state.scopeIds, state.orientation)[0];
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
  if (state.stage === "choose" || state.stage === "complete") {
    container.innerHTML = "";
    container.hidden = true;
    return;
  }

  container.hidden = false;
  const candidates = validCandidates(state.scopeIds, state.orientation);
  container.innerHTML = `
    <span>선의 위치</span>
    ${candidates.map((candidate) => `
      <button class="candidate-button ${state.candidate === candidate ? "is-active" : ""}"
        type="button" data-candidate="${candidate}">
        ${candidateLabel(state.orientation, candidate)}
      </button>
    `).join("")}
  `;

  container.querySelectorAll("[data-candidate]").forEach((button) => {
    button.addEventListener("click", () => {
      state.candidate = Number(button.dataset.candidate);
      renderAll();
    });
  });
}

function summaryCard(group, label, records) {
  const result = counts(records);
  return `
    <article class="summary-group ${group.toLowerCase()}">
      <div class="summary-group-top">
        <strong>${group} 집단 · ${result.total}명</strong>
        <em>${label}</em>
      </div>
      <div class="summary-counts">
        <span class="buy-text">● 구매 ${result.purchase}</span>
        <span class="no-text">▲ 미구매 ${result.noPurchase}</span>
      </div>
    </article>
  `;
}

function renderGroupSummary() {
  const container = document.getElementById("group-summary");
  if (state.stage === "choose") {
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

function groupNodeMarkup(ids, values, selectable, group, selected) {
  const result = counts(recordsFromIds(ids));
  const tag = selectable ? "button" : "div";
  const attrs = selectable ? `type="button" data-select-group="${group}"` : "";
  return `
    <${tag} class="group-node ${selected ? "is-selected" : ""}" ${attrs}>
      <strong>${values.join(" · ")}</strong>
      <span>${result.total}명</span>
      <small><i class="buy-text">● 구매 ${result.purchase}</i> · <i class="no-text">▲ 미구매 ${result.noPurchase}</i></small>
    </${tag}>
  `;
}

function secondSubtreeMarkup(split) {
  return `
    <div class="subtree">
      <div class="question-node">
        <small>두 번째 질문</small>
        ${split.question}
      </div>
      <div class="tree-branches">
        <div class="tree-branch">
          <span class="branch-label">아니오</span>
          ${groupNodeMarkup(split.groups.A, split.aValues, false, "A", false)}
        </div>
        <div class="tree-branch">
          <span class="branch-label">예</span>
          ${groupNodeMarkup(split.groups.B, split.bValues, false, "B", false)}
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
        <strong>아직 질문이 없습니다</strong>
        <small>왼쪽의 분할선을 먼저 움직여 보세요.</small>
      </div>
    `;
    treeGuide.classList.remove("is-active");
    treeGuide.textContent = "분할선을 확정하면 이곳에 질문이 만들어집니다.";
    return;
  }

  questionCount.textContent = `질문 ${state.secondSplit ? 2 : 1}개`;
  const root = state.firstSplit;
  const selectable = state.stage === "choose";
  const branchA = state.secondSplit && state.selectedGroup === "A"
    ? secondSubtreeMarkup(state.secondSplit)
    : groupNodeMarkup(root.groups.A, root.aValues, selectable, "A", state.stage === "second" && state.selectedGroup === "A");
  const branchB = state.secondSplit && state.selectedGroup === "B"
    ? secondSubtreeMarkup(state.secondSplit)
    : groupNodeMarkup(root.groups.B, root.bValues, selectable, "B", state.stage === "second" && state.selectedGroup === "B");

  treeStage.innerHTML = `
    <div class="tree-root">
      <div class="question-node">
        <small>첫 번째 질문</small>
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
  if (state.stage === "choose") {
    treeGuide.textContent = "두 집단 중 한 곳을 눌러 다시 나누어 보세요.";
  } else if (state.stage === "second") {
    treeGuide.textContent = "선택한 하위 집단에서 두 번째 분할선을 움직이고 있습니다.";
  } else {
    treeGuide.textContent = "분할선 두 개가 질문 두 개로 바뀌며 트리가 성장했습니다.";
  }

  treeStage.querySelectorAll("[data-select-group]").forEach((button) => {
    button.addEventListener("click", () => selectSubgroup(button.dataset.selectGroup));
  });
}

function renderStageText() {
  const chip = document.getElementById("stage-chip");
  const guide = document.getElementById("action-guide");
  const confirm = document.getElementById("confirm-split-button");
  const completion = document.getElementById("completion-banner");

  const stageText = {
    first: "첫 번째 분할",
    choose: "하위 집단 선택",
    second: "두 번째 분할",
    complete: "체험 완료"
  };
  chip.textContent = stageText[state.stage];
  completion.hidden = state.stage !== "complete";

  if (state.stage === "first") {
    guide.textContent = "분할선을 직접 잡아 움직이거나 아래 후보를 눌러 보세요.";
    confirm.hidden = false;
    confirm.disabled = false;
    confirm.textContent = "이 분할선 확정";
  } else if (state.stage === "choose") {
    guide.textContent = "오른쪽 트리에서 다시 나누고 싶은 집단을 선택하세요.";
    confirm.hidden = true;
  } else if (state.stage === "second") {
    guide.textContent = "선택한 집단 안에서 두 번째 분할선을 움직여 보세요.";
    confirm.hidden = false;
    confirm.disabled = false;
    confirm.textContent = "두 번째 분할 확정";
  } else {
    guide.textContent = "하나의 선이 하나의 질문으로 바뀌는 과정을 확인했습니다.";
    confirm.hidden = true;
  }

  document.querySelectorAll("[data-header-step]").forEach((element) => {
    const step = Number(element.dataset.headerStep);
    const active = state.stage === "first" ? 2 : 3;
    element.classList.toggle("is-active", step === active);
    element.classList.toggle("is-done", step < active);
  });
}

function renderAll() {
  renderOrientationControls();
  renderPlot();
  renderCandidateControls();
  renderGroupSummary();
  renderTree();
  renderStageText();
}

function confirmCurrentSplit() {
  if (state.stage === "first") {
    state.firstSplit = currentSplit();
    state.stage = "choose";
    renderAll();
    return;
  }

  if (state.stage === "second") {
    state.secondSplit = currentSplit();
    state.stage = "complete";
    renderAll();
  }
}

function selectSubgroup(group) {
  state.selectedGroup = group;
  state.scopeIds = [...state.firstSplit.groups[group]];
  const preferred = state.firstSplit.orientation === "vertical" ? "horizontal" : "vertical";
  state.orientation = firstValidOrientation(state.scopeIds, preferred);
  state.candidate = validCandidates(state.scopeIds, state.orientation)[0];
  state.stage = "second";
  renderAll();
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
