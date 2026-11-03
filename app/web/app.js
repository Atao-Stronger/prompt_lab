"use strict";

const CATEGORIES = [
  "需求澄清", "方案设计", "代码实现", "重构优化", "调试排错",
  "测试", "代码审查", "文档提交", "Agent 规则", "学习解释",
];

const TOKEN_KEY = "promptlab.token";
const VARS_KEY = "promptlab.vars";
const VAR_RE = /\{\{\s*([\w\u4e00-\u9fa5-]+)\s*\}\}/g;

const state = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  prompts: [],
  view: { kind: "all", category: null },
  query: "",
  activeIndex: -1,
  editing: null,
  copyTarget: null,
};

const el = (id) => document.getElementById(id);

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

function newId() {
  return "p_" + Math.random().toString(16).slice(2, 8);
}

/* ---------------- transport ---------------- */

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": state.token,
      ...(options.headers || {}),
    },
  });
  if (response.status === 401) throw new Error("unauthorized");
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch (_) { /* ignore */ }
    throw new Error(detail);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/* ---------------- data helpers ---------------- */

function varsOf(content) {
  const names = [];
  const seen = new Set();
  for (const match of content.matchAll(VAR_RE)) {
    if (!seen.has(match[1])) {
      seen.add(match[1]);
      names.push(match[1]);
    }
  }
  return names;
}

function defaultOrder(list) {
  return [...list].sort((a, b) => {
    if (Boolean(a.favorite) !== Boolean(b.favorite)) return a.favorite ? -1 : 1;
    const left = a.lastUsedAt || "";
    const right = b.lastUsedAt || "";
    if (left !== right) return left < right ? 1 : -1;
    return (a.updatedAt || "") < (b.updatedAt || "") ? 1 : -1;
  });
}

function score(prompt, terms) {
  let total = 0;
  for (const term of terms) {
    let hit = 0;
    if (prompt.title.toLowerCase().includes(term)) hit += 3;
    if ((prompt.description || "").toLowerCase().includes(term)) hit += 2;
    if ((prompt.tags || []).some((tag) => tag.toLowerCase().includes(term))) hit += 2;
    if (prompt.content.toLowerCase().includes(term)) hit += 1;
    if (!hit) return 0;
    total += hit;
  }
  return total;
}

function visiblePrompts() {
  const terms = state.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let list = state.prompts;
  if (state.view.kind === "fav") list = list.filter((p) => p.favorite);
  if (state.view.kind === "recent") list = list.filter((p) => p.lastUsedAt);
  if (state.view.category) list = list.filter((p) => p.category === state.view.category);

  if (!terms.length) return defaultOrder(list);

  return list
    .map((prompt) => ({ prompt, weight: score(prompt, terms) }))
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map((entry) => entry.prompt);
}

/* ---------------- rendering ---------------- */

function render() {
  renderSidebar();
  renderList();
}

function renderSidebar() {
  const total = state.prompts.length;
  const favorites = state.prompts.filter((p) => p.favorite).length;
  const recent = state.prompts.filter((p) => p.lastUsedAt).length;
  const counts = {};
  for (const prompt of state.prompts) counts[prompt.category] = (counts[prompt.category] || 0) + 1;

  const kindButton = (kind, label, count) => `
    <button class="side-item ${state.view.kind === kind && !state.view.category ? "active" : ""}"
      data-kind="${kind}">${label}<span>${count}</span></button>`;

  let html = kindButton("all", "全部", total)
    + kindButton("fav", "收藏", favorites)
    + kindButton("recent", "最近使用", recent);
  html += '<div class="side-title">分类</div>';
  for (const category of CATEGORIES) {
    html += `<button class="side-item ${state.view.category === category ? "active" : ""}"
      data-category="${esc(category)}">${esc(category)}<span>${counts[category] || 0}</span></button>`;
  }
  el("sidebar").innerHTML = html;
}

function renderList() {
  const list = visiblePrompts();

  if (!state.prompts.length) {
    el("list").innerHTML = "";
    el("empty").classList.remove("hidden");
    return;
  }
  el("empty").classList.add("hidden");

  if (!list.length) {
    el("list").innerHTML = '<p class="muted" style="padding:40px 4px">没有匹配的提示词</p>';
    return;
  }
  if (state.activeIndex >= list.length) state.activeIndex = list.length - 1;

  el("list").innerHTML = list.map((prompt, index) => {
    const tags = (prompt.tags || []).map((tag) => `<span class="tag">${esc(tag)}</span>`).join("");
    return `
      <article class="item ${index === state.activeIndex ? "active" : ""}"
        data-id="${esc(prompt.id)}" data-index="${index}">
        <button class="star ${prompt.favorite ? "on" : ""}" data-act="star" title="收藏">★</button>
        <div class="item-main">
          <h3>${esc(prompt.title)}</h3>
          ${prompt.description ? `<p class="desc">${esc(prompt.description)}</p>` : ""}
          <div class="meta">
            ${tags}
            <span class="dim">${esc(prompt.category || "未分类")}</span>
            <span class="dim">用过 ${prompt.usageCount || 0} 次</span>
          </div>
        </div>
        <div class="item-actions">
          <button class="icon" data-act="copy" title="复制">⧉</button>
          <button class="icon" data-act="edit" title="编辑">✎</button>
        </div>
      </article>`;
  }).join("");
}

/* ---------------- overlays ---------------- */

const OVERLAYS = {
  drawer: ["drawer", "drawer-mask"],
  copy: ["copy-modal", "copy-mask"],
  history: ["history-modal", "history-mask"],
};

function show(name) {
  const [panel, mask] = OVERLAYS[name];
  el(panel).classList.remove("hidden");
  el(mask).classList.remove("hidden");
}

function hide(name) {
  const [panel, mask] = OVERLAYS[name];
  el(panel).classList.add("hidden");
  el(mask).classList.add("hidden");
}

function closeTopLayer() {
  if (!el("history-modal").classList.contains("hidden")) return hide("history");
  if (!el("copy-modal").classList.contains("hidden")) return hide("copy");
  if (!el("drawer").classList.contains("hidden")) {
    hide("drawer");
    state.editing = null;
  }
}

let toastTimer = null;
function toast(message) {
  const node = el("toast");
  node.textContent = message;
  node.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.add("hidden"), 1800);
}

/* ---------------- clipboard ---------------- */

async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) { /* fall through */ }
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "-1000px";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (_) { /* ignore */ }
  document.body.removeChild(area);
  return ok;
}

/* ---------------- copy flow ---------------- */

function readSavedVars(promptId) {
  try {
    const all = JSON.parse(localStorage.getItem(VARS_KEY) || "{}");
    return all[promptId] || {};
  } catch (_) {
    return {};
  }
}

function saveVars(promptId, values) {
  try {
    const all = JSON.parse(localStorage.getItem(VARS_KEY) || "{}");
    all[promptId] = values;
    localStorage.setItem(VARS_KEY, JSON.stringify(all));
  } catch (_) { /* ignore */ }
}

function autoGrow(node) {
  node.style.height = "auto";
  node.style.height = Math.min(node.scrollHeight, 320) + "px";
}

function openCopy(prompt) {
  state.copyTarget = prompt;
  el("copy-title").textContent = prompt.title;

  const names = varsOf(prompt.content);
  const fields = el("copy-fields");
  const saved = readSavedVars(prompt.id);

  if (!names.length) {
    fields.innerHTML = '<p class="muted">这条提示词没有变量，直接复制即可。</p>';
  } else {
    fields.innerHTML = names.map((name) => `
      <label>
        <span>${esc(name)}</span>
        <textarea data-var="${esc(name)}" rows="1"
          placeholder="填入 ${esc(name)}">${esc(saved[name] || "")}</textarea>
      </label>`).join("");
    fields.querySelectorAll("textarea").forEach((node) => {
      autoGrow(node);
      node.addEventListener("input", () => autoGrow(node));
    });
  }

  show("copy");
  setTimeout(() => fields.querySelector("textarea")?.focus(), 40);
}

async function confirmCopy() {
  const prompt = state.copyTarget;
  if (!prompt) return;

  const values = {};
  el("copy-fields").querySelectorAll("[data-var]").forEach((node) => {
    values[node.dataset.var] = node.value;
  });

  const text = prompt.content.replace(VAR_RE, (raw, name) =>
    values[name] && values[name].trim() ? values[name] : raw);

  const ok = await copyToClipboard(text);
  if (!ok) {
    toast("复制失败，请手动选中文本");
    return;
  }

  saveVars(prompt.id, values);
  prompt.usageCount = (prompt.usageCount || 0) + 1;
  prompt.lastUsedAt = new Date().toISOString();

  hide("copy");
  state.copyTarget = null;
  toast("已复制");
  render();

  api(`/api/prompts/${encodeURIComponent(prompt.id)}`, {
    method: "PUT",
    body: JSON.stringify(prompt),
  }).catch(() => toast("已复制，但使用次数同步失败"));
}

/* ---------------- editor ---------------- */

function updateVarsHint() {
  const names = varsOf(el("f-content").value);
  el("f-vars").innerHTML = names.length
    ? "识别到变量：" + names.map((name) => `<code>{{${esc(name)}}}</code>`).join("")
    : "正文里写 {{变量名}} 即可在复制时自动生成输入框";
}

function openEditor(prompt) {
  state.editing = prompt
    ? { id: prompt.id, original: JSON.parse(JSON.stringify(prompt)) }
    : { id: newId(), original: null };

  el("drawer-title").textContent = prompt ? "编辑提示词" : "新建提示词";
  el("f-title").value = prompt?.title || "";
  el("f-desc").value = prompt?.description || "";
  el("f-category").value = prompt?.category || "代码实现";
  el("f-tags").value = (prompt?.tags || []).join(", ");
  el("f-content").value = prompt?.content || "";
  el("f-note").value = "";
  el("f-note-wrap").classList.toggle("hidden", !prompt);
  el("btn-delete").classList.toggle("hidden", !prompt);
  el("btn-history").classList.toggle("hidden", !prompt);
  updateVarsHint();

  show("drawer");
  setTimeout(() => el("f-title").focus(), 40);
}

async function savePrompt() {
  const editing = state.editing;
  if (!editing) return;

  const title = el("f-title").value.trim();
  if (!title) {
    toast("标题不能为空");
    el("f-title").focus();
    return;
  }

  const now = new Date().toISOString();
  const base = editing.original;
  const prompt = {
    id: editing.id,
    title,
    description: el("f-desc").value.trim(),
    category: el("f-category").value,
    tags: el("f-tags").value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
    content: el("f-content").value,
    favorite: base ? base.favorite : false,
    usageCount: base ? base.usageCount : 0,
    lastUsedAt: base ? base.lastUsedAt : null,
    createdAt: base ? base.createdAt : now,
    updatedAt: now,
    versions: base ? [...(base.versions || [])] : [],
  };

  if (base && base.content !== prompt.content) {
    const maxVersion = prompt.versions.reduce((max, item) => Math.max(max, item.v || 0), 0);
    const note = el("f-note").value.trim();
    prompt.versions.push({
      v: maxVersion + 1,
      savedAt: base.updatedAt || now,
      content: base.content,
      ...(note ? { note } : {}),
    });
    prompt.versions = prompt.versions.slice(-20);
  }

  try {
    await api(`/api/prompts/${encodeURIComponent(prompt.id)}`, {
      method: "PUT",
      body: JSON.stringify(prompt),
    });
  } catch (error) {
    toast("保存失败：" + error.message);
    return;
  }

  const index = state.prompts.findIndex((item) => item.id === prompt.id);
  if (index >= 0) state.prompts[index] = prompt;
  else state.prompts.push(prompt);

  hide("drawer");
  state.editing = null;
  render();
  toast("已保存");
}

async function deletePrompt() {
  const editing = state.editing;
  if (!editing?.original) return;
  if (!confirm(`确定删除「${editing.original.title}」？`)) return;

  try {
    await api(`/api/prompts/${encodeURIComponent(editing.id)}`, { method: "DELETE" });
  } catch (error) {
    toast("删除失败：" + error.message);
    return;
  }

  state.prompts = state.prompts.filter((item) => item.id !== editing.id);
  hide("drawer");
  state.editing = null;
  render();
  toast("已删除");
}

/* ---------------- history ---------------- */

function openHistory() {
  const original = state.editing?.original;
  if (!original) return;

  const versions = [...(original.versions || [])].sort((a, b) => (b.v || 0) - (a.v || 0));
  el("history-list").innerHTML = versions.length
    ? versions.map((version, index) => `
      <div class="history-item">
        <div class="history-head">
          <strong>版本 ${version.v}</strong>
          <span class="muted small">${esc(version.savedAt || "")}</span>
          ${version.note ? `<span class="tag">${esc(version.note)}</span>` : ""}
          <div class="spacer"></div>
          <button class="btn" data-restore="${index}">载入此版本</button>
        </div>
        <pre class="history-body">${esc(version.content || "")}</pre>
      </div>`).join("")
    : '<p class="muted">还没有历史版本。修改正文并保存后会自动生成。</p>';

  el("history-list").onclick = (event) => {
    const button = event.target.closest("[data-restore]");
    if (!button) return;
    const version = versions[Number(button.dataset.restore)];
    el("f-content").value = version.content || "";
    updateVarsHint();
    hide("history");
    toast("已载入历史版本，保存后生效");
  };

  show("history");
}

/* ---------------- import / export ---------------- */

async function exportAll() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    prompts: state.prompts,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const link = document.createElement("a");
  link.href = url;
  link.download = `prompts-${stamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importFile(file) {
  try {
    const data = JSON.parse(await file.text());
    const incoming = Array.isArray(data) ? data : data.prompts;
    if (!Array.isArray(incoming)) throw new Error("文件里没有 prompts 数组");

    await api("/api/import", {
      method: "POST",
      body: JSON.stringify({ prompts: incoming, mode: "merge" }),
    });
    await load();
    toast(`已导入 ${incoming.length} 条`);
  } catch (error) {
    toast("导入失败：" + error.message);
  }
}

/* ---------------- session ---------------- */

async function load() {
  const data = await api("/api/prompts");
  state.prompts = data.prompts || [];
  render();
}

function showLogin(message = "") {
  el("app").classList.add("hidden");
  el("login").classList.remove("hidden");
  el("login-error").textContent = message;
  setTimeout(() => el("login-token").focus(), 30);
}

async function enterApp() {
  el("login").classList.add("hidden");
  el("app").classList.remove("hidden");
  await load();
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  state.token = "";
  state.prompts = [];
  el("login-token").value = "";
  showLogin();
}

/* ---------------- events ---------------- */

function moveActive(delta) {
  const list = visiblePrompts();
  if (!list.length) return;
  state.activeIndex = Math.max(0, Math.min(list.length - 1, state.activeIndex + delta));
  renderList();
  document.querySelector(`.item[data-index="${state.activeIndex}"]`)
    ?.scrollIntoView({ block: "nearest" });
}

function bindEvents() {
  el("sidebar").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.kind) {
      state.view = { kind: button.dataset.kind, category: null };
    } else if (button.dataset.category) {
      state.view = { kind: "all", category: button.dataset.category };
    }
    state.activeIndex = -1;
    render();
  });

  el("list").addEventListener("click", (event) => {
    const item = event.target.closest(".item");
    if (!item) return;
    const prompt = state.prompts.find((entry) => entry.id === item.dataset.id);
    if (!prompt) return;

    state.activeIndex = Number(item.dataset.index);
    const action = event.target.closest("[data-act]")?.dataset.act;

    if (action === "star") {
      prompt.favorite = !prompt.favorite;
      render();
      api(`/api/prompts/${encodeURIComponent(prompt.id)}`, {
        method: "PUT",
        body: JSON.stringify(prompt),
      }).catch(() => toast("收藏状态同步失败"));
      return;
    }
    if (action === "edit") {
      openEditor(prompt);
      return;
    }
    openCopy(prompt);
  });

  el("search").addEventListener("input", (event) => {
    state.query = event.target.value;
    state.activeIndex = -1;
    renderList();
  });

  el("search").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const list = visiblePrompts();
    if (list.length) {
      event.preventDefault();
      openCopy(list[0]);
    }
  });

  el("btn-new").addEventListener("click", () => openEditor(null));
  el("btn-export").addEventListener("click", exportAll);
  el("btn-import").addEventListener("click", () => el("file-import").click());
  el("btn-logout").addEventListener("click", logout);
  el("file-import").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) importFile(file);
    event.target.value = "";
  });

  el("drawer-close").addEventListener("click", () => {
    hide("drawer");
    state.editing = null;
  });
  el("btn-save").addEventListener("click", savePrompt);
  el("btn-delete").addEventListener("click", deletePrompt);
  el("btn-history").addEventListener("click", openHistory);
  el("f-content").addEventListener("input", updateVarsHint);

  el("copy-cancel").addEventListener("click", () => hide("copy"));
  el("copy-confirm").addEventListener("click", confirmCopy);
  el("history-close").addEventListener("click", () => hide("history"));

  el("drawer-mask").addEventListener("click", () => {
    hide("drawer");
    state.editing = null;
  });
  el("copy-mask").addEventListener("click", () => hide("copy"));
  el("history-mask").addEventListener("click", () => hide("history"));

  el("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = el("login-token").value.trim();
    if (!value) return;
    state.token = value;
    try {
      await enterApp();
      localStorage.setItem(TOKEN_KEY, value);
      el("login-token").value = "";
    } catch (error) {
      showLogin(error.message === "unauthorized" ? "口令不正确" : error.message);
    }
  });

  document.addEventListener("keydown", (event) => {
    const tag = document.activeElement?.tagName;
    const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    const copyOpen = !el("copy-modal").classList.contains("hidden");

    if (event.key === "Escape") {
      closeTopLayer();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      if (!el("drawer").classList.contains("hidden")) {
        event.preventDefault();
        savePrompt();
      }
      return;
    }

    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && copyOpen) {
      event.preventDefault();
      confirmCopy();
      return;
    }

    if (typing || el("app").classList.contains("hidden")) return;

    if (event.key === "/") {
      event.preventDefault();
      el("search").focus();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (event.key === "Enter") {
      const list = visiblePrompts();
      if (state.activeIndex >= 0 && list[state.activeIndex]) {
        event.preventDefault();
        openCopy(list[state.activeIndex]);
      }
    }
  });
}

async function boot() {
  el("f-category").innerHTML = CATEGORIES.map((name) => `<option>${esc(name)}</option>`).join("");
  bindEvents();

  if (!state.token) {
    showLogin();
    return;
  }
  try {
    await enterApp();
  } catch (error) {
    if (error.message === "unauthorized") {
      localStorage.removeItem(TOKEN_KEY);
      state.token = "";
      showLogin("口令已失效，请重新输入");
    } else {
      showLogin("连接失败：" + error.message);
    }
  }
}

boot();
