const AI_PLATFORM_URLS = {
  chatgpt: "https://chat.openai.com/",
  claude: "https://claude.ai/new",
  gemini: "https://gemini.google.com/",
  deepseek: "https://chat.deepseek.com/",
};

const pendingTranscriptByTab = new Map();

chrome.runtime.onInstalled.addListener(() => {
  console.log("YouTube Transcript to AI extension installed");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openAiWithTranscript") {
    const { platform, transcript, prompt, mode } = request;
    const targetUrl = AI_PLATFORM_URLS[platform];

    if (!targetUrl) {
      sendResponse({ success: false, error: "Unsupported AI platform." });
      return;
    }

    chrome.tabs.create({ url: targetUrl }, (tab) => {
      if (chrome.runtime.lastError || !tab?.id) {
        sendResponse({
          success: false,
          error: chrome.runtime.lastError?.message || "Could not open AI tab.",
        });
        return;
      }

      pendingTranscriptByTab.set(tab.id, {
        transcript,
        prompt: prompt || transcript,
        mode: mode || "summarize",
        platform,
        createdAt: Date.now(),
      });

      sendResponse({ success: true, tabId: tab.id });
    });

    return true;
  }

  if (request.action === "getPendingTranscript") {
    const senderTabId = sender.tab?.id;
    if (!senderTabId) {
      sendResponse({ success: false, error: "No sender tab id." });
      return;
    }

    const payload = pendingTranscriptByTab.get(senderTabId);
    if (!payload) {
      sendResponse({
        success: false,
        error: "No pending transcript for this tab.",
      });
      return;
    }

    sendResponse({ success: true, payload });
    return;
  }

  if (request.action === "pendingTranscriptConsumed") {
    const senderTabId = sender.tab?.id;
    if (senderTabId) {
      pendingTranscriptByTab.delete(senderTabId);
    }
    sendResponse({ success: true });
  }
});

// Cleanup stale payloads if user does not use the opened AI tab
setInterval(() => {
  const now = Date.now();
  for (const [tabId, payload] of pendingTranscriptByTab.entries()) {
    if (now - payload.createdAt > 10 * 60 * 1000) {
      pendingTranscriptByTab.delete(tabId);
    }
  }
}, 60 * 1000);
