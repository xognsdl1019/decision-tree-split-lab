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

const ATTRIBUTES = {
  age: {
    label: "나이",
    values: ["청소년", "청년", "중년"],
    question: "나이는 무엇인가?"
  },
  income: {
    label: "수입",
    values: ["낮음", "중간", "높음"],
    question: "수입 수준은 무엇인가?"
  },
  student: {
    label: "학생 여부",
    values: ["아니오", "예"],
    question: "학생입니까?"
  },
  credit: {
    label: "신용등급",
    values: ["양호", "우수"],
    question: "신용등급은 무엇인가?"
  }
};

const state = {
  screen: "intro",
  root: null,
  nodes: new Map(),
  currentNodeId: null,
  mode: "split",
  selectedAttribute: null,
  selectedCandidate: 1,
  visitedAttributes: new Set(),
  chosenAttribute: null,
  feedback: "",
  feedbackType: "",
  history: [],
  lastConfirmedQuestion: ""
};

function entropy(records) {
  if (!records.length) return 0;
  const purchase = records.filter((row) => row.result === "구매").length;
  const noPurchase = records.length - purchase;
  return [purchase, noPurchase].reduce((sum, count) => {
    if (count === 0) return sum;
    const probability = count / records.length;
    return sum - probability * Math.log2(probability);
  }, 0);
}

function distribution(records) {
  const purchase = records.filter((row) => row.result === "구매").length;
  return {
    total: records.length,
    purchase,
    noPurchase: records.length - purchase,
    entropy: entropy(records)
  };
}

function splitByAttribute(records, attribute) {
  const groups = new Map();
  ATTRIBUTES[attribute].values.forEach((value) => groups.set(value, []));
  records.forEach((record) => groups.get(record[attribute]).push(record));
  return groups;
}

function weightedEntropy(groups, total) {
  if (!total) return 0;
  return [...groups.values()].reduce(
    (sum, group) => sum + (group.length / total) * entropy(group),
    0
  );
}

function informationGain(records, attribute) {
  const groups = splitByAttribute(records, attribute);
  return entropy(records) - weightedEntropy(groups, records.length);
}

function candidateSplit(records, attribute, splitIndex) {
  const values = ATTRIBUTES[attribute].values;
  const leftValues = values.slice(0, splitIndex);
  const rightValues = values.slice(splitIndex);
  const left = records.filter((record) => leftValues.includes(record[attribute]));
  const right = records.filter((record) => rightValues.includes(record[attribute]));
  const groups = new Map([
    ["left", left],
    ["right", right]
  ]);
  const after = weightedEntropy(groups, records.length);
  return {
    left,
    right,
    leftValues,
    rightValues,
    before: entropy(records),
    after,
    gain: entropy(records) - after
  };
}

function formatNumber(value) {
  const safeValue = Math.abs(value) < 0.0005 ? 0 : value;
  return safeValue.toFixed(3);
}

function getRecords(node) {
  return node.dataIds.map((id) => DATA.find((row) => row.id === id));
}

function isPure(records) {
  return new Set(records.map((row) => row.result)).size === 1;
}

function majorityResult(records) {
  const counts = distribution(records);
  return counts.purchase >= counts.noPurchase ? "구매" : "미구매";
}

function createNode(records, usedAttributes = [], branchValue = null, path = "전체 데이터") {
  const node = {
    id: `node-${state.nodes.size + 1}`,
    dataIds: records.map((row) => row.id),
    usedAttributes: [...usedAttributes],
    branchValue,
    path,
    attribute: null,
    gain: null,
    children: [],
    prediction: isPure(records) ? records[0].result : null
  };
  state.nodes.set(node.id, node);
  return node;
}

function initializeTree() {
  state.nodes = new Map();
  state.root = createNode(DATA, [], null, "전체 데이터");
  state.currentNodeId = state.root.id;
  state.mode = "split";
  state.selectedAttribute = null;
  state.selectedCandidate = 1;
  state.visitedAttributes = new Set();
  state.chosenAttribute = null;
  state.feedback = "";
  state.feedbackType = "";
  state.history = [];
  state.lastConfirmedQuestion = "";
}

function availableAttributes(node) {
  return Object.keys(ATTRIBUTES).filter((key) => !node.usedAttributes.includes(key));
}

function pendingNodes() {
  return [...state.nodes.values()].filter(
    (node) => !node.prediction && !node.attribute && availableAttributes(node).length
  );
}

function renderDataTable() {
  const tbody = document.getElementById("data-table-body");
  tbody.innerHTML = DATA.map((row) => `
    <tr>
      <td>${row.id}</td>
      <td>${row.age}</td>
      <td>${row.income}</td>
      <td>${row.student}</td>
      <td>${row.credit}</td>
      <td>
        <span class="result-badge ${row.result === "구매" ? "is-purchase" : "is-no"}">
          <span aria-hidden="true">${row.result === "구매" ? "●" : "▲"}</span>
          ${row.result}
        </span>
      </td>
    </tr>
  `).join("");
}

function setScreen(screen) {
  state.screen = screen;
  document.querySelectorAll(".screen").forEach((element) => {
    element.classList.toggle("is-active", element.id === `${screen}-screen`);
  });
  const progressValue = screen === "intro" ? 1 : screen === "lab" ? 2 : 3;
  document.querySelectorAll(".step-dot").forEach((dot) => {
    const value = Number(dot.dataset.progress);
    dot.classList.toggle("is-active", value === progressValue);
    dot.classList.toggle("is-done", value < progressValue);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function nodeContextText(node) {
  const records = getRecords(node);
  const counts = distribution(records);
  return `<strong>${node.path}</strong> · ${counts.total}명
    <span class="label-purchase">● 구매 ${counts.purchase}</span> /
    <span class="label-no">▲ 미구매 ${counts.noPurchase}</span>`;
}

function renderAttributeButtons(node) {
  return availableAttributes(node).map((key) => {
    const active = state.selectedAttribute === key ? "is-active" : "";
    const visited = state.visitedAttributes.has(key) ? "is-visited" : "";
    return `
      <button class="attribute-button ${active} ${visited}" type="button" data-attribute="${key}">
        ${ATTRIBUTES[key].label}
      </button>
    `;
  }).join("");
}

function renderCandidateControls(attribute) {
  const meta = ATTRIBUTES[attribute];
  const max = meta.values.length - 1;
  const splitLeft = `${(state.selectedCandidate / meta.values.length) * 100}%`;
  const candidateButtons = Array.from({ length: max }, (_, index) => index + 1).map((index) => {
    const left = meta.values.slice(0, index).join("·");
    const right = meta.values.slice(index).join("·");
    return `
      <button class="candidate-button ${index === state.selectedCandidate ? "is-active" : ""}"
        type="button" data-candidate="${index}">
        ${left} <span aria-hidden="true">│</span> ${right}
      </button>
    `;
  }).join("");

  return `
    <div class="split-control-card">
      <div class="split-control-top">
        <h3>${meta.label}의 범주 사이에서 분할선 이동</h3>
        <span class="candidate-label">
          ${max === 1 ? "이 속성의 분할 후보 1개" : `분할 후보 ${state.selectedCandidate} / ${max}`}
        </span>
      </div>
      <div class="category-track" style="--category-count:${meta.values.length}; --split-left:${splitLeft}">
        ${meta.values.map((value) => `<span class="category-pill">${value}</span>`).join("")}
        <span class="split-divider" aria-hidden="true"></span>
      </div>
      ${max > 1 ? `
        <div class="range-wrap">
          <label for="split-range">분할선 드래그</label>
          <input id="split-range" type="range" min="1" max="${max}" step="1"
            value="${state.selectedCandidate}" aria-label="${meta.label} 분할선 위치">
        </div>
      ` : ""}
      <div class="candidate-buttons" aria-label="후보 분할 선택">
        ${candidateButtons}
      </div>
    </div>
  `;
}

function renderGroupCard(title, values, records) {
  const counts = distribution(records);
  const buyWidth = counts.total ? (counts.purchase / counts.total) * 100 : 0;
  const noWidth = counts.total ? (counts.noPurchase / counts.total) * 100 : 0;
  return `
    <article class="group-card">
      <h3>${title}<strong>${counts.total}명</strong></h3>
      <span class="group-condition">${values.join(" · ")}</span>
      <div class="group-numbers">
        <span class="buy-count">● 구매 ${counts.purchase}</span>
        <span class="no-count">▲ 미구매 ${counts.noPurchase}</span>
      </div>
      <div class="ratio-bar" aria-label="구매 ${counts.purchase}명, 미구매 ${counts.noPurchase}명">
        <span class="ratio-buy" style="width:${buyWidth}%"></span>
        <span class="ratio-no" style="width:${noWidth}%"></span>
      </div>
      <p class="group-entropy"><span>집단 엔트로피</span><strong>H = ${formatNumber(counts.entropy)}</strong></p>
    </article>
  `;
}

function renderLiveCalculation(records, attribute) {
  const split = candidateSplit(records, attribute, state.selectedCandidate);
  const allCandidateGains = Array.from(
    { length: ATTRIBUTES[attribute].values.length - 1 },
    (_, index) => candidateSplit(records, attribute, index + 1).gain
  );
  const isHigh = split.gain >= Math.max(...allCandidateGains) - 1e-10;

  return `
    <div class="formula-strip" aria-label="정보이득 계산 관계">
      <div class="formula-card">
        <span>분할 전 엔트로피</span>
        <strong>${formatNumber(split.before)}</strong>
      </div>
      <span class="formula-operator" aria-hidden="true">−</span>
      <div class="formula-card">
        <span>분할 후 가중평균 엔트로피</span>
        <strong>${formatNumber(split.after)}</strong>
      </div>
      <span class="formula-operator" aria-hidden="true">=</span>
      <div class="formula-card gain-card ${isHigh ? "is-high" : ""}">
        <span>현재 후보 정보이득</span>
        <strong>${formatNumber(split.gain)}</strong>
      </div>
    </div>
    <div class="group-grid">
      ${renderGroupCard("왼쪽 집단", split.leftValues, split.left)}
      ${renderGroupCard("오른쪽 집단", split.rightValues, split.right)}
    </div>
    <p class="formula-help">
      H(D) = −Σ pᵢ log₂pᵢ &nbsp; · &nbsp;
      H<sub>A</sub>(D) = Σ (|Dᵥ| / |D|) H(Dᵥ) &nbsp; · &nbsp;
      Gain(D,A) = H(D) − H<sub>A</sub>(D)
    </p>
  `;
}

function comparisonRows(node, records) {
  const attributes = availableAttributes(node);
  const allVisited = attributes.every((key) => state.visitedAttributes.has(key));
  const gains = Object.fromEntries(attributes.map((key) => [key, informationGain(records, key)]));
  const maximum = Math.max(...Object.values(gains), 0.001);

  return attributes.map((key) => {
    const visited = state.visitedAttributes.has(key);
    const selected = state.chosenAttribute === key;
    if (!visited || !allVisited) {
      return `
        <div class="gain-row is-locked">
          <span class="gain-name">${ATTRIBUTES[key].label}</span>
          <span class="gain-track"><span class="gain-fill" style="width:0"></span></span>
          <span class="gain-value">${visited ? "확인 ✓" : "미확인"}</span>
        </div>
      `;
    }
    const width = Math.max((gains[key] / maximum) * 100, gains[key] > 0 ? 2 : 0);
    return `
      <button class="gain-row ${selected ? "is-selected" : ""}" type="button" data-choose-attribute="${key}">
        <span class="gain-name">${selected ? "✓ " : ""}${ATTRIBUTES[key].label}</span>
        <span class="gain-track"><span class="gain-fill" style="width:${width}%"></span></span>
        <span class="gain-value">${formatNumber(gains[key])}</span>
      </button>
    `;
  }).join("");
}

function renderComparison(node, records) {
  const attributes = availableAttributes(node);
  const visitedCount = attributes.filter((key) => state.visitedAttributes.has(key)).length;
  const allVisited = visitedCount === attributes.length;
  const buttonEnabled = allVisited && state.chosenAttribute;
  const defaultFeedback = allVisited
    ? "막대의 길이와 수치를 비교한 뒤 질문을 직접 선택하세요."
    : "위 속성 버튼을 하나씩 눌러 모든 정보이득을 확인하세요.";

  return `
    <section class="comparison-section" aria-labelledby="comparison-title">
      <div class="comparison-title-row">
        <div>
          <h3 id="comparison-title">속성별 정보이득 비교</h3>
          <p>막대는 각 범주를 모두 나눈 ID3의 정보이득입니다.</p>
        </div>
        <span class="visit-progress">${visitedCount} / ${attributes.length} 확인</span>
      </div>
      <div class="gain-list">
        ${comparisonRows(node, records)}
      </div>
      <div class="confirm-row">
        <p class="feedback ${state.feedbackType ? `is-${state.feedbackType}` : ""}" aria-live="polite">
          ${state.feedback || defaultFeedback}
        </p>
        <button id="confirm-question-button" class="primary-button" type="button"
          ${buttonEnabled ? "" : "disabled"}>
          이 질문으로 분할 확정
        </button>
      </div>
    </section>
  `;
}

function renderSplitWorkspace(node) {
  const records = getRecords(node);
  const selectedPanel = state.selectedAttribute
    ? `${renderCandidateControls(state.selectedAttribute)}
       ${renderLiveCalculation(records, state.selectedAttribute)}`
    : `
      <div class="split-control-card">
        <div class="empty-tree">
          <div class="empty-node">?</div>
          <strong>먼저 분할 속성을 선택하세요</strong>
          <span>속성 버튼을 누르면 범주와 분할선이 나타납니다.</span>
        </div>
      </div>
    `;

  return `
    <div class="workspace-heading">
      <h2>① 분할 속성 선택 → ② 분할선 이동 → ③ 정보이득 비교</h2>
      <p>현재 집단에서 사용할 수 있는 질문을 하나씩 확인하세요.</p>
    </div>
    <div class="attribute-grid" aria-label="분할 속성 선택">
      ${renderAttributeButtons(node)}
    </div>
    ${selectedPanel}
    ${renderComparison(node, records)}
  `;
}

function renderNodePicker() {
  const nodes = pendingNodes();
  return `
    <div class="node-picker">
      <div class="link-success">
        <span>질문 → 트리 변환</span>
        <strong>${state.lastConfirmedQuestion}</strong>
        <p>방금 선택한 분할 기준이 의사결정 트리의 하나의 질문이 되었습니다.</p>
      </div>
      <h2>아직 결과가 섞인 하위 집단을 선택하세요</h2>
      <p>선택한 집단에서 남은 속성의 정보이득을 다시 계산합니다.</p>
      <div class="pending-node-list">
        ${nodes.map((node) => {
          const counts = distribution(getRecords(node));
          return `
            <button class="pending-node-button" type="button" data-node-id="${node.id}">
              <span>다음 분할 대상</span>
              <strong>${node.path}</strong>
              <em>● 구매 ${counts.purchase} · ▲ 미구매 ${counts.noPurchase} · H ${formatNumber(counts.entropy)}</em>
            </button>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderLab() {
  const node = state.nodes.get(state.currentNodeId) || state.root;
  document.getElementById("node-context").innerHTML = nodeContextText(node);
  document.getElementById("split-workspace").innerHTML =
    state.mode === "choose-node" ? renderNodePicker() : renderSplitWorkspace(node);
  renderTreePanels();
  bindLabEvents();
}

function bindLabEvents() {
  document.querySelectorAll("[data-attribute]").forEach((button) => {
    button.addEventListener("click", () => selectAttribute(button.dataset.attribute));
  });

  const range = document.getElementById("split-range");
  if (range) {
    range.addEventListener("input", () => {
      state.selectedCandidate = Number(range.value);
      renderLab();
    });
  }

  document.querySelectorAll("[data-candidate]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCandidate = Number(button.dataset.candidate);
      renderLab();
    });
  });

  document.querySelectorAll("[data-choose-attribute]").forEach((button) => {
    button.addEventListener("click", () => {
      state.chosenAttribute = button.dataset.chooseAttribute;
      state.feedback = `${ATTRIBUTES[state.chosenAttribute].label} 질문을 선택했습니다. 정보이득을 한 번 더 비교하세요.`;
      state.feedbackType = "ready";
      renderLab();
    });
  });

  const confirmButton = document.getElementById("confirm-question-button");
  if (confirmButton) confirmButton.addEventListener("click", confirmQuestion);

  document.querySelectorAll("[data-node-id]").forEach((button) => {
    button.addEventListener("click", () => beginNode(button.dataset.nodeId));
  });
}

function selectAttribute(attribute) {
  state.selectedAttribute = attribute;
  state.selectedCandidate = 1;
  state.visitedAttributes.add(attribute);
  state.feedback = "";
  state.feedbackType = "";
  renderLab();
}

function confirmQuestion() {
  const node = state.nodes.get(state.currentNodeId);
  const records = getRecords(node);
  const attributes = availableAttributes(node);
  const gains = Object.fromEntries(attributes.map((key) => [key, informationGain(records, key)]));
  const maximum = Math.max(...Object.values(gains));
  const bestAttributes = attributes.filter((key) => Math.abs(gains[key] - maximum) < 1e-10);

  if (!bestAttributes.includes(state.chosenAttribute)) {
    state.feedback = "이 집단에는 정보이득이 더 큰 질문이 있습니다. 막대의 길이와 수치를 다시 비교해 보세요.";
    state.feedbackType = "error";
    renderLab();
    return;
  }

  const attribute = state.chosenAttribute;
  const meta = ATTRIBUTES[attribute];
  const groups = splitByAttribute(records, attribute);
  node.attribute = attribute;
  node.gain = gains[attribute];
  node.prediction = null;
  node.children = [];

  meta.values.forEach((value) => {
    const group = groups.get(value);
    if (!group.length) return;
    const childPath = node === state.root ? `${meta.label} = ${value}` : `${node.path} → ${meta.label} = ${value}`;
    const child = createNode(
      group,
      [...node.usedAttributes, attribute],
      value,
      childPath
    );
    if (!isPure(group) && availableAttributes(child).length === 0) {
      child.prediction = majorityResult(group);
    }
    node.children.push(child.id);
  });

  state.history.push({
    path: node.path,
    attribute,
    question: meta.question,
    gain: gains[attribute]
  });
  state.lastConfirmedQuestion = meta.question;

  const remaining = pendingNodes();
  if (remaining.length === 0) {
    completeLab();
    return;
  }

  state.mode = "choose-node";
  state.currentNodeId = remaining[0].id;
  state.selectedAttribute = null;
  state.chosenAttribute = null;
  state.visitedAttributes = new Set();
  state.feedback = "";
  state.feedbackType = "";
  renderLab();
}

function beginNode(nodeId) {
  state.currentNodeId = nodeId;
  state.mode = "split";
  state.selectedAttribute = null;
  state.selectedCandidate = 1;
  state.visitedAttributes = new Set();
  state.chosenAttribute = null;
  state.feedback = "";
  state.feedbackType = "";
  renderLab();
}

function renderTreeNode(nodeId, currentNodeId = null) {
  const node = state.nodes.get(nodeId);
  const records = getRecords(node);
  const counts = distribution(records);

  if (node.prediction) {
    const purchase = node.prediction === "구매";
    return `
      <div class="tree-node-wrap">
        <div class="tree-node is-leaf ${purchase ? "is-leaf-purchase" : "is-leaf-no"}">
          <small>리프 노드 · ${counts.total}명</small>
          ${purchase ? "● 구매" : "▲ 미구매"}
        </div>
      </div>
    `;
  }

  if (!node.attribute) {
    return `
      <div class="tree-node-wrap">
        <div class="tree-node is-pending ${node.id === currentNodeId ? "is-current" : ""}">
          <small>분할 필요 · H ${formatNumber(counts.entropy)}</small>
          질문 선택 중
        </div>
      </div>
    `;
  }

  return `
    <div class="tree-node-wrap">
      <div class="tree-node ${node.id === currentNodeId ? "is-current" : ""}">
        <small>질문 노드 · Gain ${formatNumber(node.gain)}</small>
        ${ATTRIBUTES[node.attribute].question}
      </div>
      <div class="tree-children" style="--child-count:${node.children.length}">
        ${node.children.map((childId) => {
          const child = state.nodes.get(childId);
          return `
            <div class="tree-branch">
              <span class="branch-label">${child.branchValue}</span>
              ${renderTreeNode(childId, currentNodeId)}
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderTreePanels() {
  const treeStage = document.getElementById("tree-stage");
  const nodeCount = document.getElementById("tree-node-count");
  const treeMessage = document.getElementById("tree-message");
  if (!state.root.attribute) {
    treeStage.innerHTML = document.getElementById("empty-tree-template").innerHTML;
    nodeCount.textContent = "질문 0개";
    treeMessage.classList.remove("is-linked");
    treeMessage.textContent = "질문을 확정하면 이곳에 질문 노드가 만들어집니다.";
    return;
  }
  treeStage.innerHTML = renderTreeNode(state.root.id, state.currentNodeId);
  nodeCount.textContent = `질문 ${state.history.length}개`;
  treeMessage.classList.add("is-linked");
  treeMessage.textContent = "선택한 분할 기준이 질문 노드로 바뀌고, 가지마다 데이터가 나뉩니다.";
}

function completeLab() {
  renderFinishScreen();
  setScreen("finish");
}

function renderFinishScreen() {
  document.getElementById("final-tree").innerHTML = renderTreeNode(state.root.id);
  document.getElementById("question-history").innerHTML = state.history.map((item, index) => `
    <li>
      <span>${index + 1}</span>
      <strong>${item.path}: ${item.question}</strong>
      <small>정보이득 ${formatNumber(item.gain)}</small>
    </li>
  `).join("");
  document.getElementById("finish-content").classList.remove("tree-focus");
  document.getElementById("focus-tree-button").textContent = "완성된 트리 보기";
}

function resetLab() {
  initializeTree();
  setScreen("intro");
  renderLab();
}

document.getElementById("start-button").addEventListener("click", () => {
  initializeTree();
  renderLab();
  setScreen("lab");
});

document.getElementById("restart-button").addEventListener("click", resetLab);

document.getElementById("focus-tree-button").addEventListener("click", () => {
  const content = document.getElementById("finish-content");
  const focused = content.classList.toggle("tree-focus");
  document.getElementById("focus-tree-button").textContent =
    focused ? "핵심 정리 보기" : "완성된 트리 보기";
});

renderDataTable();
initializeTree();
renderLab();
