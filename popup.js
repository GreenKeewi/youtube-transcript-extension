const PROMPTS_STORAGE_KEY = "ytai-prompts";
const SELECTED_PROMPT_STORAGE_KEY = "ytai-selected-prompt";
const DEFAULT_PROMPTS = [
  {
    id: "summarize",
    label: "Summarize",
    prompt: "Summarize this transcript.",
  },
  {
    id: "explain",
    label: "Explain",
    prompt: "Explain this transcript simply for a beginner.",
  },
  {
    id: "notes",
    label: "Notes",
    prompt: "Convert this transcript into clean study notes.",
  },
];

const state = {
  prompts: cloneDefaultPrompts(),
  selectedPromptId: DEFAULT_PROMPTS[0].id,
};

const elements = {
  promptList: document.getElementById("promptList"),
  addPromptBtn: document.getElementById("addPromptBtn"),
  resetBtn: document.getElementById("resetBtn"),
  saveBtn: document.getElementById("saveBtn"),
  status: document.getElementById("status"),
  promptTemplate: document.getElementById("promptTemplate"),
};

document.addEventListener("DOMContentLoaded", () => {
  void init();
});

async function init() {
  attachEvents();
  await loadPrompts();
  renderPromptList();
}

function attachEvents() {
  elements.addPromptBtn.addEventListener("click", () => {
    const nextIndex = state.prompts.length + 1;
    state.prompts.push({
      id: `prompt-${Date.now()}`,
      label: `Prompt ${nextIndex}`,
      prompt: "Describe the key takeaways from this transcript.",
    });
    renderPromptList();
    const latestLabel = elements.promptList.querySelector(
      ".prompt-card:last-child .prompt-label",
    );
    latestLabel?.focus();
    setStatus("New prompt added. Save when you're happy with it.", "success");
  });

  elements.resetBtn.addEventListener("click", () => {
    state.prompts = cloneDefaultPrompts();
    state.selectedPromptId = state.prompts[0].id;
    renderPromptList();
    setStatus("Defaults restored. Hit save to apply them.", "success");
  });

  elements.saveBtn.addEventListener("click", () => {
    void savePrompts();
  });
}

async function loadPrompts() {
  try {
    const stored = await storageGet([
      PROMPTS_STORAGE_KEY,
      SELECTED_PROMPT_STORAGE_KEY,
    ]);
    state.prompts = sanitizePromptList(stored[PROMPTS_STORAGE_KEY]);
    state.selectedPromptId = syncSelectedPrompt(
      stored[SELECTED_PROMPT_STORAGE_KEY],
      state.prompts,
    );
  } catch (error) {
    console.error("Failed to load prompts", error);
    setStatus(
      "Could not load saved prompts. Showing defaults instead.",
      "error",
    );
  }
}

function renderPromptList() {
  elements.promptList.innerHTML = "";

  state.prompts.forEach((promptItem, index) => {
    const fragment = elements.promptTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".prompt-card");
    const labelInput = fragment.querySelector(".prompt-label");
    const promptInput = fragment.querySelector(".prompt-text");
    const removeBtn = fragment.querySelector(".remove-btn");

    card.dataset.id = promptItem.id;
    labelInput.value = promptItem.label;
    promptInput.value = promptItem.prompt;

    labelInput.addEventListener("input", (event) => {
      state.prompts[index].label = event.target.value;
    });

    promptInput.addEventListener("input", (event) => {
      state.prompts[index].prompt = event.target.value;
    });

    removeBtn.addEventListener("click", () => {
      if (state.prompts.length === 1) {
        setStatus(
          "Keep at least one prompt so the YouTube panel has something to show.",
          "error",
        );
        return;
      }

      const [removed] = state.prompts.splice(index, 1);
      if (removed?.id === state.selectedPromptId) {
        state.selectedPromptId = state.prompts[0]?.id || DEFAULT_PROMPTS[0].id;
      }
      renderPromptList();
      setStatus("Prompt removed. Save to update the extension.", "success");
    });

    elements.promptList.appendChild(fragment);
  });
}

async function savePrompts() {
  const sanitized = sanitizePromptList(state.prompts);

  if (!sanitized.length) {
    setStatus("Add at least one prompt before saving.", "error");
    return;
  }

  if (sanitized.length !== state.prompts.length) {
    setStatus("Each prompt needs both a label and an instruction.", "error");
    return;
  }

  state.prompts = sanitized;
  state.selectedPromptId = syncSelectedPrompt(
    state.selectedPromptId,
    state.prompts,
  );

  try {
    await storageSet({
      [PROMPTS_STORAGE_KEY]: state.prompts,
      [SELECTED_PROMPT_STORAGE_KEY]: state.selectedPromptId,
    });
    renderPromptList();
    setStatus("Prompt presets saved.", "success");
  } catch (error) {
    console.error("Failed to save prompts", error);
    setStatus("Could not save prompts right now.", "error");
  }
}

function sanitizePromptList(rawValue) {
  const source =
    Array.isArray(rawValue) && rawValue.length
      ? rawValue
      : cloneDefaultPrompts();
  const seenIds = new Set();
  const sanitized = [];

  source.forEach((item, index) => {
    const label = typeof item?.label === "string" ? item.label.trim() : "";
    const prompt = typeof item?.prompt === "string" ? item.prompt.trim() : "";
    if (!label || !prompt) {
      return;
    }

    const baseId =
      typeof item?.id === "string" && item.id.trim()
        ? item.id.trim()
        : buildPromptId(label, index + 1);

    let nextId = baseId;
    let suffix = 2;
    while (seenIds.has(nextId)) {
      nextId = `${baseId}-${suffix}`;
      suffix += 1;
    }

    seenIds.add(nextId);
    sanitized.push({
      id: nextId,
      label: label.slice(0, 24),
      prompt,
    });
  });

  return sanitized;
}

function syncSelectedPrompt(promptId, prompts) {
  if (prompts.some((promptItem) => promptItem.id === promptId)) {
    return promptId;
  }
  return prompts[0]?.id || DEFAULT_PROMPTS[0].id;
}

function cloneDefaultPrompts() {
  return DEFAULT_PROMPTS.map((promptItem) => ({ ...promptItem }));
}

function buildPromptId(label, fallbackIndex) {
  const slug = (label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `prompt-${fallbackIndex}`;
}

function setStatus(message, type = "") {
  elements.status.textContent = message;
  elements.status.className = type ? `status ${type}` : "status";
}

function storageGet(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(result || {});
    });
  });
}

function storageSet(value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(value, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}
