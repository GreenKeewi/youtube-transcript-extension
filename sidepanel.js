// Side panel logic - handles UI interactions and sending transcript to AI platforms

const elements = {
  transcriptText: document.getElementById("transcriptText"),
  aiPlatform: document.getElementById("aiPlatform"),
  sendBtn: document.getElementById("sendBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  status: document.getElementById("status"),
};

// AI platform configurations
const aiPlatforms = {
  chatgpt: {
    name: "ChatGPT",
    url: "https://chat.openai.com",
    queryParam: null,
    insertMethod: "focus", // Will focus and paste to active field
  },
  claude: {
    name: "Claude",
    url: "https://claude.ai/new",
    queryParam: null,
    insertMethod: "focus",
  },
  gemini: {
    name: "Gemini",
    url: "https://gemini.google.com",
    queryParam: null,
    insertMethod: "focus",
  },
  deepseek: {
    name: "DeepSeek",
    url: "https://chat.deepseek.com",
    queryParam: null,
    insertMethod: "focus",
  },
};

// Initialize side panel
function init() {
  loadTranscript();
  setupEventListeners();
  restoreSavedPlatform();
}

// Load transcript from the active YouTube tab
function loadTranscript() {
  showStatus("Loading transcript...", "loading");
  elements.sendBtn.disabled = true;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) {
      showStatus("No active tab found", "error");
      return;
    }

    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "requestTranscript" },
      (response) => {
        if (chrome.runtime.lastError) {
          showStatus("Error: " + chrome.runtime.lastError.message, "error");
          return;
        }

        if (response && response.success) {
          elements.transcriptText.value = response.transcript;
          showStatus("Transcript loaded successfully", "success");
          elements.sendBtn.disabled = false;
        } else {
          const errorMsg = response?.error || "Could not extract transcript";
          showStatus(errorMsg, "error");
        }
      },
    );
  });
}

// Setup event listeners
function setupEventListeners() {
  elements.refreshBtn.addEventListener("click", () => {
    elements.transcriptText.value = "";
    loadTranscript();
  });

  elements.aiPlatform.addEventListener("change", (e) => {
    localStorage.setItem("selectedAiPlatform", e.target.value);
    elements.sendBtn.disabled =
      !e.target.value || !elements.transcriptText.value;
  });

  elements.transcriptText.addEventListener("input", () => {
    elements.sendBtn.disabled =
      !elements.aiPlatform.value || !elements.transcriptText.value;
  });

  elements.sendBtn.addEventListener("click", sendToAI);
}

// Save selected platform preference
function restoreSavedPlatform() {
  const saved = localStorage.getItem("selectedAiPlatform");
  if (saved) {
    elements.aiPlatform.value = saved;
  }
}

// Send transcript to selected AI platform
function sendToAI() {
  const platform = elements.aiPlatform.value;
  const transcript = elements.transcriptText.value;

  if (!platform) {
    showStatus("Please select an AI platform", "error");
    return;
  }

  if (!transcript) {
    showStatus("Transcript is empty", "error");
    return;
  }

  const config = aiPlatforms[platform];
  if (!config) {
    showStatus("Unknown platform selected", "error");
    return;
  }

  showStatus("Opening " + config.name + "...", "loading");

  // Open the AI platform in a new tab
  chrome.tabs.create({ url: config.url }, (tab) => {
    if (chrome.runtime.lastError) {
      showStatus(
        "Error opening tab: " + chrome.runtime.lastError.message,
        "error",
      );
      return;
    }

    // Wait a moment for the page to load, then try to paste the transcript
    setTimeout(() => {
      // Send the transcript to the newly opened tab's content script
      // The content script will attempt to paste it into the first input field
      chrome.tabs.sendMessage(
        tab.id,
        {
          action: "pasteTranscript",
          transcript: transcript,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            // It's okay if this fails - the user can still paste manually
            showStatus(
              "Opened " +
                config.name +
                ". Please paste the transcript manually if needed.",
              "info",
            );
          } else if (response && response.success) {
            showStatus("Transcript sent to " + config.name, "success");
          }
        },
      );
    }, 2000);
  });
}

// Show status message
function showStatus(message, type) {
  elements.status.textContent = message;
  elements.status.className = "status " + type;

  // Clear status after 5 seconds for success/info messages
  if (type === "success" || type === "info") {
    setTimeout(() => {
      if (elements.status.textContent === message) {
        elements.status.textContent = "";
        elements.status.className = "status";
      }
    }, 5000);
  }
}

// Initialize on load
document.addEventListener("DOMContentLoaded", init);
