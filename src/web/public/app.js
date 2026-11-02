// ===== State =====
let selectedFile = null;
let currentJobId = null;
let resultData = null;
let selectedVault = null; // { name, path }
let availableVaults = [];

// ===== DOM =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dropZone = $("#drop-zone");
const fileInput = $("#file-input");
const fileInfo = $("#file-info");
const fileName = $("#file-name");
const fileSize = $("#file-size");
const fileRemove = $("#file-remove");
const btnMigrate = $("#btn-migrate");
const optDryRun = $("#opt-dry-run");
const progressFill = $("#progress-fill");
const progressPercent = $("#progress-percent");
const btnRestart = $("#btn-restart");
const btnRetry = $("#btn-retry");

// ===== Step Navigation =====
function showStep(name) {
  $$(".step").forEach((s) => s.classList.remove("active"));
  $(`#step-${name}`).classList.add("active");
}

// ===== File Selection =====
dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const files = e.dataTransfer.files;
  if (files.length > 0 && files[0].name.endsWith(".zip")) {
    selectFile(files[0]);
  }
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length > 0) {
    selectFile(fileInput.files[0]);
  }
});

function selectFile(file) {
  selectedFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = formatSize(file.size);
  dropZone.classList.add("hidden");
  fileInfo.classList.remove("hidden");
  btnMigrate.disabled = false;
}

fileRemove.addEventListener("click", () => {
  selectedFile = null;
  fileInput.value = "";
  dropZone.classList.remove("hidden");
  fileInfo.classList.add("hidden");
  btnMigrate.disabled = true;
});

// ===== Vault Selector =====
const vaultSearch = $("#vault-search");
const vaultDropdown = $("#vault-dropdown");
const vaultSelected = $("#vault-selected");
const vaultNameEl = $("#vault-name");
const vaultPathText = $("#vault-path-text");
const vaultRemove = $("#vault-remove");
const vaultWarning = $("#vault-warning");

// Load vaults on page load
(async function loadVaults() {
  try {
    const res = await fetch("/api/vaults");
    const data = await res.json();
    availableVaults = data.vaults || [];
  } catch {
    availableVaults = [];
  }
})();

vaultSearch.addEventListener("focus", () => showVaultDropdown(vaultSearch.value));
vaultSearch.addEventListener("input", () => showVaultDropdown(vaultSearch.value));

document.addEventListener("click", (e) => {
  if (!e.target.closest(".vault-search-wrap")) {
    vaultDropdown.classList.add("hidden");
  }
});

function showVaultDropdown(query) {
  const q = query.toLowerCase().trim();
  const filtered = q
    ? availableVaults.filter((v) => v.name.toLowerCase().includes(q))
    : availableVaults;

  if (filtered.length === 0 && !q) {
    vaultDropdown.innerHTML = '<div class="vault-dropdown-empty">No Obsidian vaults found on this machine</div>';
  } else if (filtered.length === 0) {
    vaultDropdown.innerHTML = '<div class="vault-dropdown-empty">No matching vaults</div>';
  } else {
    vaultDropdown.innerHTML = filtered
      .map(
        (v) =>
          `<div class="vault-option" data-path="${v.path}" data-name="${v.name}">
            <span class="vault-option-name">${v.name}</span>
            <span class="vault-option-path">${v.path}</span>
          </div>`
      )
      .join("");
  }

  vaultDropdown.classList.remove("hidden");

  vaultDropdown.querySelectorAll(".vault-option").forEach((el) => {
    el.addEventListener("click", () => {
      selectVault({ name: el.dataset.name, path: el.dataset.path });
    });
  });
}

function selectVault(vault) {
  selectedVault = vault;
  vaultNameEl.textContent = vault.name;
  vaultPathText.textContent = vault.path;
  vaultSearch.classList.add("hidden");
  vaultDropdown.classList.add("hidden");
  vaultSelected.classList.remove("hidden");
  vaultWarning.classList.add("hidden");
  updateMigrateButton();
}

vaultRemove.addEventListener("click", () => {
  selectedVault = null;
  vaultSearch.value = "";
  vaultSearch.classList.remove("hidden");
  vaultSelected.classList.add("hidden");
  vaultWarning.classList.add("hidden");
  updateMigrateButton();
});

function updateMigrateButton() {
  btnMigrate.disabled = !selectedFile;
}

// ===== Migration =====
btnMigrate.addEventListener("click", startMigration);
btnRestart.addEventListener("click", () => {
  selectedFile = null;
  selectedVault = null;
  fileInput.value = "";
  dropZone.classList.remove("hidden");
  fileInfo.classList.add("hidden");
  vaultSearch.value = "";
  vaultSearch.classList.remove("hidden");
  vaultSelected.classList.add("hidden");
  vaultWarning.classList.add("hidden");
  btnMigrate.disabled = true;
  resetProgress();
  showStep("upload");
});
btnRetry.addEventListener("click", () => {
  resetProgress();
  showStep("upload");
});

async function startMigration() {
  if (!selectedFile) return;
  showStep("progress");
  resetProgress();

  const formData = new FormData();
  formData.append("zipFile", selectedFile);
  formData.append("dryRun", optDryRun.checked ? "true" : "false");
  if (selectedVault) {
    formData.append("vaultPath", selectedVault.path);
  }

  try {
    const res = await fetch("/api/migrate", { method: "POST", body: formData });
    const { jobId } = await res.json();
    currentJobId = jobId;
    listenProgress(jobId);
  } catch (err) {
    showError(err.message);
  }
}

function listenProgress(jobId) {
  const source = new EventSource(`/api/progress/${jobId}`);

  source.addEventListener("message", (e) => {
    const data = JSON.parse(e.data);

    if (data.type === "progress") {
      updateProgress(data);
    } else if (data.type === "complete") {
      source.close();
      resultData = data;
      showResults(data);
    } else if (data.type === "error") {
      source.close();
      showError(data.message);
    }
  });

  source.addEventListener("error", () => {
    // SSE connection closed by server after completion — ignore
  });
}

function updateProgress(data) {
  progressFill.style.width = data.progress + "%";
  progressPercent.textContent = data.progress + "%";

  // Update stages
  const stages = $$(".stage");
  let foundActive = false;
  stages.forEach((el) => {
    const stage = el.dataset.stage;
    if (stage === data.stage) {
      el.classList.add("active");
      el.classList.remove("done");
      el.querySelector(".stage-msg").textContent = data.message;
      foundActive = true;
    } else if (!foundActive) {
      el.classList.remove("active");
      el.classList.add("done");
    } else {
      el.classList.remove("active", "done");
      el.querySelector(".stage-msg").textContent = "";
    }
  });
}

function resetProgress() {
  progressFill.style.width = "0%";
  progressPercent.textContent = "0%";
  $$(".stage").forEach((el) => {
    el.classList.remove("active", "done");
    el.querySelector(".stage-msg").textContent = "";
  });
}

// ===== Results =====
function showResults(data) {
  const { report, writeResult, tree, outputDir } = data;

  // Stats
  $("#stat-pages").textContent = report.summary.pages;
  $("#stat-databases").textContent = report.summary.databases;
  $("#stat-attachments").textContent = report.summary.attachments;
  $("#stat-files").textContent = writeResult.filesWritten;
  $("#stat-time").textContent = (report.summary.totalTimeMs / 1000).toFixed(1) + "s";

  // Output dir
  $("#output-dir").textContent = outputDir;

  // File tree
  renderFileTree(tree);

  // Degradations
  renderDegradations(report.degradations);

  // Unresolved links
  renderUnresolved(report.unresolvedLinks);

  showStep("results");
}

function showError(message) {
  $("#error-message").textContent = message;
  showStep("error");
}

// ===== File Tree =====
function renderFileTree(tree) {
  const container = $("#file-tree");
  container.innerHTML = "";

  if (!tree || tree.length === 0) {
    container.innerHTML = '<div class="empty-state">No files generated</div>';
    return;
  }

  tree.forEach((item) => {
    const el = document.createElement("div");
    el.className = "tree-item" + (item.type === "dir" ? " dir" : "");

    const depth = item.name.split("/").length - 1;
    el.style.paddingLeft = (12 + depth * 18) + "px";

    const icon = item.type === "dir" ? "📁" : getFileIcon(item.name);
    const name = item.name.split("/").pop();
    const sizeStr = item.size != null ? formatSize(item.size) : "";

    el.innerHTML = `<span class="icon">${icon}</span><span>${name}</span>${sizeStr ? `<span class="size">${sizeStr}</span>` : ""}`;

    if (item.type === "file") {
      el.addEventListener("click", () => previewFile(item.path, item.name));
    }

    container.appendChild(el);
  });
}

function getFileIcon(name) {
  if (name.endsWith(".md")) return "📝";
  if (name.endsWith(".json")) return "📊";
  if (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".gif")) return "🖼️";
  if (name.endsWith(".pdf")) return "📕";
  if (name.endsWith(".csv")) return "📋";
  return "📄";
}

async function previewFile(filePath, name) {
  // Switch to preview tab
  switchTab("preview");

  $("#preview-filename").textContent = name;
  $("#preview-content").textContent = "Loading...";

  try {
    const res = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
    if (res.ok) {
      const text = await res.text();
      $("#preview-content").textContent = text;
    } else {
      $("#preview-content").textContent = "Unable to load file preview";
    }
  } catch {
    $("#preview-content").textContent = "Unable to load file preview";
  }
}

// ===== Degradations =====
function renderDegradations(degradations) {
  const container = $("#degradation-list");

  if (!degradations || degradations.length === 0) {
    container.innerHTML = '<div class="empty-state">No degradations — everything migrated cleanly!</div>';
    return;
  }

  let html = `<table class="degrad-table">
    <thead><tr><th>Tag</th><th>Severity</th><th>Count</th><th>Samples</th></tr></thead><tbody>`;

  degradations.forEach((d) => {
    html += `<tr>
      <td><code>${d.tag}</code></td>
      <td><span class="badge ${d.severity}">${d.severity}</span></td>
      <td>${d.count}</td>
      <td>${d.samples.map((s) => `<code>${s}</code>`).join(", ")}</td>
    </tr>`;
  });

  html += "</tbody></table>";
  container.innerHTML = html;
}

// ===== Unresolved =====
function renderUnresolved(links) {
  const container = $("#unresolved-list");

  if (!links || links.length === 0) {
    container.innerHTML = '<div class="empty-state">No unresolved links — all links mapped successfully!</div>';
    return;
  }

  let html = `<table class="degrad-table">
    <thead><tr><th>Link</th><th>Context</th><th>Reason</th></tr></thead><tbody>`;

  links.forEach((l) => {
    html += `<tr>
      <td><code>${l.href}</code></td>
      <td><code>${l.context}</code></td>
      <td><span class="badge warning">${l.reason}</span></td>
    </tr>`;
  });

  html += "</tbody></table>";
  container.innerHTML = html;
}

// ===== Tabs =====
$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

function switchTab(name) {
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  $$(".tab-content").forEach((c) => c.classList.toggle("active", c.id === `tab-${name}`));
}

// ===== Helpers =====
function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
