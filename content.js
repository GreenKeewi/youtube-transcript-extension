(() => {
  const isYouTubeWatch =
    window.location.hostname.includes("youtube.com") &&
    window.location.pathname === "/watch";
  const isAiPage = [
    "chat.openai.com",
    "chatgpt.com",
    "claude.ai",
    "gemini.google.com",
    "chat.deepseek.com",
  ].includes(window.location.hostname);

  if (isYouTubeWatch) {
    initYouTubePanel();
  }

  if (isAiPage) {
    initAiAutofill();
  }

  function initYouTubePanel() {
    const PANEL_ID = "ytai-panel";
    const MODE_STORAGE_KEY = "ytai-mode";
    const aiOptions = {
      chatgpt: {
        name: "ChatGPT",
        logoUrl: "https://chatgpt.com/favicon.ico",
        fallback: "CG",
        url: "https://chat.openai.com/",
      },
      claude: {
        name: "Claude",
        logoUrl: "https://claude.ai/favicon.ico",
        fallback: "CL",
        url: "https://claude.ai/",
      },
      gemini: {
        name: "Gemini",
        logoUrl: "https://gemini.google.com/favicon.ico",
        fallback: "GM",
        url: "https://gemini.google.com/",
      },
      deepseek: {
        name: "DeepSeek",
        logoUrl: "https://chat.deepseek.com/favicon.ico",
        fallback: "DS",
        url: "https://chat.deepseek.com/",
      },
    };
    const modeOptions = {
      summarize: "Summarize this transcript.",
      explain: "Explain this transcript simply for a beginner.",
      notes: "Convert this transcript into clean study notes.",
    };

    let panelRoot = null;
    let statusElement = null;
    let observeUrlInterval = null;
    let currentVideoId = getVideoId();
    let cachedTranscript = "";
    let selectedMode = loadModePreference();

    const pageObserver = new MutationObserver(() => {
      ensurePanelMounted();
    });

    start();

    function start() {
      ensurePanelMounted();

      pageObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });

      observeUrlInterval = window.setInterval(() => {
        if (!window.location.pathname.startsWith("/watch")) {
          removePanel();
          return;
        }

        ensurePanelMounted();

        const nextVideoId = getVideoId();
        if (nextVideoId && nextVideoId !== currentVideoId) {
          currentVideoId = nextVideoId;
          cachedTranscript = "";
          setStatus("", "loading");
        }
      }, 1000);

      window.addEventListener("beforeunload", cleanup);
    }

    function cleanup() {
      pageObserver.disconnect();
      if (observeUrlInterval) {
        window.clearInterval(observeUrlInterval);
      }
    }

    function removePanel() {
      const existing = document.getElementById(PANEL_ID);
      if (existing) {
        existing.remove();
      }
    }

    function ensurePanelMounted() {
      if (!window.location.pathname.startsWith("/watch")) {
        return;
      }

      const secondaryInner = document.querySelector(
        "#secondary #secondary-inner",
      );
      const secondary = document.querySelector("#secondary");
      const mountPoint = secondaryInner || secondary;
      if (!mountPoint) {
        return;
      }

      panelRoot = document.getElementById(PANEL_ID);
      if (!panelRoot) {
        panelRoot = buildPanel();
        mountPoint.prepend(panelRoot);
      } else if (!mountPoint.contains(panelRoot)) {
        mountPoint.prepend(panelRoot);
      }
    }

    function buildPanel() {
      const wrapper = document.createElement("section");
      wrapper.id = PANEL_ID;
      wrapper.className = "ytai-panel";

      wrapper.innerHTML = `
          <div class="ytai-top-row">
            <div class="ytai-mode-menu" role="tablist" aria-label="Prompt mode">
              <button type="button" class="ytai-mode-btn" data-mode="summarize" role="tab">Summarize</button>
              <button type="button" class="ytai-mode-btn" data-mode="explain" role="tab">Explain</button>
              <button type="button" class="ytai-mode-btn" data-mode="notes" role="tab">Notes</button>
            </div>
          </div>
          <div class="ytai-icon-row"></div>
          <p class="ytai-status ytai-hidden" aria-live="polite"></p>
        `;

      statusElement = wrapper.querySelector(".ytai-status");
      const iconRow = wrapper.querySelector(".ytai-icon-row");

      const modeButtons = wrapper.querySelectorAll(".ytai-mode-btn");
      modeButtons.forEach((button) => {
        const mode = button.dataset.mode;
        if (mode === selectedMode) {
          button.classList.add("is-active");
          button.setAttribute("aria-selected", "true");
        } else {
          button.setAttribute("aria-selected", "false");
        }

        button.addEventListener("click", () => {
          if (!mode || !modeOptions[mode]) {
            return;
          }
          selectedMode = mode;
          saveModePreference(mode);
          modeButtons.forEach((candidate) => {
            const active = candidate === button;
            candidate.classList.toggle("is-active", active);
            candidate.setAttribute("aria-selected", active ? "true" : "false");
          });
          setStatus("", "success");
        });
      });

      Object.entries(aiOptions).forEach(([platform, details]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ytai-ai-icon-btn";
        button.setAttribute("aria-label", `Open ${details.name}`);
        button.setAttribute("title", details.name);
        button.dataset.platform = platform;
        button.innerHTML = `
            <img class="ytai-ai-logo" src="${details.logoUrl}" alt="${details.name}" loading="lazy" referrerpolicy="no-referrer" />
            <span class="ytai-ai-fallback">${details.fallback}</span>
          `;

        const image = button.querySelector("img");
        if (image) {
          image.addEventListener("error", () => {
            image.classList.add("ytai-hidden");
            button.classList.add("show-fallback");
          });
          image.addEventListener("load", () => {
            button.classList.remove("show-fallback");
          });
        }

        button.addEventListener("click", () => {
          void openPlatformWithTranscript(platform);
        });
        iconRow.appendChild(button);
      });

      return wrapper;
    }

    async function openPlatformWithTranscript(platform) {
      const platformDetails = aiOptions[platform];
      if (!platformDetails) {
        setStatus("Unsupported AI platform.", "error");
        return;
      }

      try {
        setStatus("Preparing transcript...", "loading");
        const transcript = await ensureTranscriptLoaded(false, false);

        if (!transcript) {
          setStatus("Transcript unavailable for this video.", "error");
          return;
        }

        const prompt = composePrompt(transcript, selectedMode);
        const copied = await copyToClipboard(prompt);
        const runtime = globalThis.chrome?.runtime;
        if (!runtime?.sendMessage) {
          window.open(platformDetails.url, "_blank", "noopener,noreferrer");
          setStatus(
            copied
              ? `Opened ${platformDetails.name}. Prompt copied and ready to paste.`
              : `Opened ${platformDetails.name}.`,
            "success",
          );
          return;
        }

        runtime.sendMessage(
          {
            action: "openAiWithTranscript",
            transcript,
            prompt,
            mode: selectedMode,
            platform,
          },
          async (response) => {
            if (runtime.lastError) {
              window.open(platformDetails.url, "_blank", "noopener,noreferrer");
              setStatus(
                copied
                  ? `Opened ${platformDetails.name}. Prompt copied and ready to paste.`
                  : `Opened ${platformDetails.name}.`,
                "success",
              );
              return;
            }

            if (!response?.success) {
              window.open(platformDetails.url, "_blank", "noopener,noreferrer");
              setStatus(
                copied
                  ? `Opened ${platformDetails.name}. Prompt copied and ready to paste.`
                  : `Opened ${platformDetails.name}.`,
                "success",
              );
              return;
            }

            setStatus(
              copied
                ? `Opened ${platformDetails.name}. Prompt copied and inserted.`
                : `Opened ${platformDetails.name}.`,
              "success",
            );
          },
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to prepare transcript.";
        setStatus(message, "error");
      }
    }

    async function ensureTranscriptLoaded(forceReload, silent) {
      if (!forceReload && isUsableTranscript(cachedTranscript)) {
        return cachedTranscript;
      }

      if (
        !forceReload &&
        cachedTranscript &&
        !isUsableTranscript(cachedTranscript)
      ) {
        cachedTranscript = "";
      }

      const transcript = await loadTranscriptFromPanel();
      if (isUsableTranscript(transcript)) {
        cachedTranscript = transcript;
      } else if (!silent) {
        cachedTranscript = "";
      }

      return transcript;
    }

    async function loadTranscriptFromPanel() {
      const existingTranscript = extractTranscriptText();
      if (isUsableTranscript(existingTranscript)) {
        console.debug("YTAI: Using existing transcript.");
        return existingTranscript;
      }

      console.debug("YTAI: Opening transcript panel...");
      await openTranscriptPanelIfNeeded();
      const loadedTranscript = await waitForTranscriptText(15000);
      if (isUsableTranscript(loadedTranscript)) {
        console.debug("YTAI: Transcript loaded from panel.");
        return loadedTranscript;
      }

      console.debug(
        "YTAI: Panel extraction failed. Trying caption-track fallback...",
      );
      const captionTranscript = await loadTranscriptFromCaptionTracks();
      if (isUsableTranscript(captionTranscript)) {
        console.debug("YTAI: Transcript loaded from caption-track fallback.");
        return captionTranscript;
      }

      console.debug(
        "YTAI: Caption-track fallback failed. Trying page-fetch fallback...",
      );
      const fetchedTranscript = await loadTranscriptFromFetchedPage();
      if (isUsableTranscript(fetchedTranscript)) {
        console.debug("YTAI: Transcript loaded from page-fetch fallback.");
        return fetchedTranscript;
      }

      console.warn(
        "YTAI: Failed to load usable transcript from panel and caption tracks.",
      );
      return "";
    }

    async function loadTranscriptFromCaptionTracks() {
      try {
        const tracks = getCaptionTracksFromPlayerData();
        if (!tracks.length) {
          return "";
        }

        const orderedTracks = orderCaptionTracks(tracks);
        for (const track of orderedTracks) {
          if (!track?.baseUrl) {
            continue;
          }

          const json3Url = track.baseUrl.includes("fmt=")
            ? track.baseUrl
            : `${track.baseUrl}&fmt=json3`;

          const transcriptFromJson = await fetchTranscriptFromJson3(json3Url);
          if (isUsableTranscript(transcriptFromJson)) {
            return transcriptFromJson;
          }

          const transcriptFromXml = await fetchTranscriptFromXml(track.baseUrl);
          if (isUsableTranscript(transcriptFromXml)) {
            return transcriptFromXml;
          }
        }

        return "";
      } catch (error) {
        console.debug("YTAI: Caption-track fallback failed", error);
        return "";
      }
    }

    async function loadTranscriptFromFetchedPage() {
      const videoId = getVideoId();
      if (!videoId) {
        return "";
      }

      try {
        const response = await fetch(
          `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
          { credentials: "include" },
        );
        if (!response.ok) {
          return "";
        }

        const html = await response.text();
        if (!html.includes("captionTracks")) {
          return "";
        }

        const parsed = parseJsonAssignment(html, "ytInitialPlayerResponse");
        if (!parsed) {
          return "";
        }

        const tracks =
          parsed?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (!Array.isArray(tracks) || !tracks.length) {
          return "";
        }

        const orderedTracks = orderCaptionTracks(
          tracks.filter((t) => t && typeof t.baseUrl === "string"),
        );

        for (const track of orderedTracks) {
          const json3Url = track.baseUrl.includes("fmt=")
            ? track.baseUrl
            : `${track.baseUrl}&fmt=json3`;

          const transcriptFromJson = await fetchTranscriptFromJson3(json3Url);
          if (isUsableTranscript(transcriptFromJson)) {
            return transcriptFromJson;
          }

          const transcriptFromXml = await fetchTranscriptFromXml(track.baseUrl);
          if (isUsableTranscript(transcriptFromXml)) {
            return transcriptFromXml;
          }
        }
      } catch (error) {
        console.debug("YTAI: Page-fetch fallback failed", error);
      }

      return "";
    }

    function getCaptionTracksFromPlayerData() {
      const tracks = [];

      // window.ytInitialPlayerResponse is accessible when YouTube uses var/window
      // assignment (not let/const). Try it first as a fast path.
      const playerResponse = window.ytInitialPlayerResponse;
      const directTracks =
        playerResponse?.captions?.playerCaptionsTracklistRenderer
          ?.captionTracks;
      if (Array.isArray(directTracks) && directTracks.length) {
        tracks.push(...directTracks);
      }

      if (!tracks.length) {
        // Fallback: parse inline <script> tags using a balanced-brace parser.
        // A simple regex is unreliable because the JSON value may contain "};"
        // inside string literals, causing premature termination.
        const scriptTags = Array.from(document.querySelectorAll("script"));
        for (const script of scriptTags) {
          const text = script.textContent || "";
          if (
            !text.includes("ytInitialPlayerResponse") ||
            !text.includes("captionTracks")
          ) {
            continue;
          }

          const parsed = parseJsonAssignment(text, "ytInitialPlayerResponse");
          if (!parsed) {
            continue;
          }

          const parsedTracks =
            parsed?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
          if (Array.isArray(parsedTracks) && parsedTracks.length) {
            tracks.push(...parsedTracks);
            break;
          }
        }
      }

      return tracks.filter(
        (track) => track && typeof track.baseUrl === "string",
      );
    }

    // Extracts and JSON-parses the value assigned to `varName` inside `text`
    // using a balanced-brace walk rather than a regex. This correctly handles
    // nested objects and string values that contain "}" or "};".
    function parseJsonAssignment(text, varName) {
      const jsonParsePrefix = new RegExp(
        `${varName}\\s*=\\s*JSON\\.parse\\((['\"])`,
      );
      const parseMatch = jsonParsePrefix.exec(text);
      if (parseMatch) {
        const quote = parseMatch[1];
        const literalStart = parseMatch.index + parseMatch[0].length - 1;
        const literal = extractStringLiteral(text, literalStart, quote);
        if (literal != null) {
          try {
            return JSON.parse(literal);
          } catch {
            // Fall through to object-literal parser below.
          }
        }
      }

      const keyPattern = new RegExp(varName + "\\s*=\\s*\\{");
      const keyMatch = keyPattern.exec(text);
      if (!keyMatch) {
        return null;
      }

      const startIdx = text.indexOf("{", keyMatch.index + varName.length);
      if (startIdx === -1) {
        return null;
      }

      let depth = 0;
      let inString = false;
      let escape = false;

      for (let i = startIdx; i < text.length; i++) {
        const c = text[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (c === "\\" && inString) {
          escape = true;
          continue;
        }
        if (c === '"') {
          inString = !inString;
          continue;
        }
        if (inString) {
          continue;
        }
        if (c === "{") {
          depth++;
        } else if (c === "}") {
          depth--;
          if (depth === 0) {
            try {
              return JSON.parse(text.slice(startIdx, i + 1));
            } catch {
              return null;
            }
          }
        }
      }
      return null;
    }

    function extractStringLiteral(text, quoteStartIndex, quoteChar) {
      if (text[quoteStartIndex] !== quoteChar) {
        return null;
      }

      let escaped = false;
      let raw = "";

      for (let i = quoteStartIndex + 1; i < text.length; i++) {
        const ch = text[i];
        if (escaped) {
          raw += `\\${ch}`;
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (ch === quoteChar) {
          try {
            const jsonReady = `"${raw.replace(/"/g, '\\"')}"`;
            return JSON.parse(jsonReady);
          } catch {
            return null;
          }
        }
        raw += ch;
      }

      return null;
    }

    function orderCaptionTracks(tracks) {
      if (!Array.isArray(tracks) || !tracks.length) {
        return [];
      }

      const score = (track) => {
        let value = 0;
        const language = (track?.languageCode || "").toLowerCase();
        const isAsr = track?.kind === "asr";

        if (!isAsr) value += 10;
        if (language.startsWith("en")) value += 3;
        if (track?.isTranslatable) value += 1;

        return value;
      };

      return [...tracks].sort((a, b) => score(b) - score(a));
    }

    async function fetchTranscriptFromJson3(url) {
      try {
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) {
          return "";
        }

        const data = await response.json();
        const events = Array.isArray(data?.events) ? data.events : [];

        const lines = events
          .map((event) => {
            const segs = Array.isArray(event?.segs) ? event.segs : [];
            const text = segs
              .map((seg) => (seg?.utf8 || "").replace(/\n/g, " ").trim())
              .filter(Boolean)
              .join(" ")
              .trim();
            return normalizeTranscriptLine(text);
          })
          .filter(Boolean);

        return dedupeTranscriptLines(lines).join("\n");
      } catch (_error) {
        return "";
      }
    }

    async function fetchTranscriptFromXml(url) {
      try {
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) {
          return "";
        }

        const text = await response.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, "text/xml");
        const nodes = Array.from(xml.querySelectorAll("text"));

        const lines = nodes
          .map((node) => normalizeTranscriptLine(node.textContent || ""))
          .filter(Boolean);

        return dedupeTranscriptLines(lines).join("\n");
      } catch (_error) {
        return "";
      }
    }

    async function openTranscriptPanelIfNeeded() {
      if (extractTranscriptText()) {
        return;
      }

      if (isTranscriptPanelOpen()) {
        return;
      }

      // Some layouts hide transcript actions until description is expanded.
      expandDescriptionIfCollapsed();

      let transcriptButton = findTranscriptButton();
      if (!transcriptButton) {
        const moreActionsButton = findMoreActionsButton();
        if (moreActionsButton) {
          moreActionsButton.click();
          await new Promise((resolve) => window.setTimeout(resolve, 500));
          transcriptButton = findTranscriptButton();
        }
      }

      if (transcriptButton) {
        transcriptButton.click();
        await new Promise((resolve) => window.setTimeout(resolve, 600));

        // Retry once if the first click targeted a menu item that closed
        // without opening the transcript panel.
        if (!isTranscriptPanelOpen()) {
          const retryButton = findTranscriptButton();
          if (retryButton) {
            retryButton.click();
            await new Promise((resolve) => window.setTimeout(resolve, 700));
          }
        }
      }
    }

    function isTranscriptPanelOpen() {
      const panel = getTranscriptPanelRoot();
      if (!panel) {
        return false;
      }

      const visibility = panel.getAttribute("visibility");
      if (visibility === "ENGAGEMENT_PANEL_VISIBILITY_HIDDEN") {
        return false;
      }
      if (visibility === "ENGAGEMENT_PANEL_VISIBILITY_EXPANDED") {
        return true;
      }

      // Fallback: check computed style — avoids offsetParent issues with
      // position:fixed panels (YouTube's engagement panels are fixed).
      const style = window.getComputedStyle(panel);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }

      const rect = panel.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    function findMoreActionsButton() {
      const candidates = Array.from(
        document.querySelectorAll(
          "#actions button, ytd-menu-renderer button, #top-level-buttons-computed button, button",
        ),
      );
      return (
        candidates.find((btn) => {
          const label = (btn.getAttribute("aria-label") || "").toLowerCase();
          const text = (btn.textContent || "").toLowerCase().trim();
          return (
            label.includes("more actions") ||
            text === "..." ||
            label.includes("more options")
          );
        }) || null
      );
    }

    function findTranscriptButton() {
      const directButtons = Array.from(
        document.querySelectorAll(
          "button, tp-yt-paper-button, ytd-button-renderer button, ytd-menu-service-item-renderer, tp-yt-paper-item, [role='menuitem'], #primary-button ytd-button-renderer button, ytd-video-description-transcript-section-renderer button, [aria-label*='transcript' i], [title*='transcript' i]",
        ),
      );

      const match = directButtons.find((btn) => {
        const text = (btn.textContent || "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();
        const label = (btn.getAttribute("aria-label") || "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();
        const title = (btn.getAttribute("title") || "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();
        const combined = `${text} ${label} ${title}`;
        return (
          combined.includes("show transcript") ||
          (combined.includes("transcript") && !combined.includes("search"))
        );
      });

      return match || null;
    }

    function expandDescriptionIfCollapsed() {
      const candidates = Array.from(
        document.querySelectorAll(
          "#description-inline-expander button, #expand button, ytd-text-inline-expander button, tp-yt-paper-button, button",
        ),
      );

      const expandButton = candidates.find((btn) => {
        const text = (btn.textContent || "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();
        const label = (btn.getAttribute("aria-label") || "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();
        const combined = `${text} ${label}`;
        return (
          combined === "more" ||
          combined.includes("show more") ||
          combined.includes("expand")
        );
      });

      if (expandButton) {
        expandButton.click();
      }
    }

    function extractTranscriptText() {
      const panelRoot = getTranscriptPanelRoot();
      if (!panelRoot) {
        return "";
      }

      const segmentNodes = Array.from(
        panelRoot.querySelectorAll("ytd-transcript-segment-renderer"),
      );

      let lines = [];

      if (segmentNodes.length > 0) {
        lines = segmentNodes
          .map((segment) => {
            const directText =
              segment.querySelector(".segment-text, #segment-text")
                ?.textContent || "";
            const snippetText =
              segment.querySelector("#snippet, .segment-snippet")
                ?.textContent || "";
            const formattedCandidates = Array.from(
              segment.querySelectorAll("yt-formatted-string"),
            )
              .map((node) => (node.textContent || "").trim())
              .filter(Boolean);

            const bestFormatted =
              formattedCandidates.find((value) => !isTimestampOnly(value)) ||
              "";
            const ariaLabel = (segment.getAttribute("aria-label") || "").trim();

            const bestLine =
              directText ||
              snippetText ||
              bestFormatted ||
              ariaLabel ||
              segment.textContent ||
              "";
            return normalizeTranscriptLine(bestLine);
          })
          .filter(Boolean);
      }

      if (lines.length === 0) {
        // Broader fallback: any yt-formatted-string in the panel, filtering out timestamps
        const allFormattedStrings = Array.from(
          panelRoot.querySelectorAll("yt-formatted-string"),
        );
        const formattedLines = allFormattedStrings
          .map((node) => {
            const text = (node.textContent || "").trim();
            if (isTimestampOnly(text)) return "";
            return normalizeTranscriptLine(text);
          })
          .filter(Boolean);

        if (formattedLines.length > 0) {
          lines = formattedLines;
        }
      }

      if (lines.length === 0) {
        // Fallback: specific container selectors
        const fallbackTextNodes = Array.from(
          panelRoot.querySelectorAll(
            "#segments-container yt-formatted-string, ytd-transcript-segment-list-renderer yt-formatted-string, .segment-text, #segment-text, #snippet, .segment-snippet, yt-attributed-string",
          ),
        );
        lines = fallbackTextNodes
          .map((node) => normalizeTranscriptLine(node.textContent || ""))
          .filter(Boolean);
      }

      if (lines.length === 0) {
        // Last resort: read raw innerText of the panel and parse line by line
        const rawText = panelRoot.innerText || panelRoot.textContent || "";
        lines = rawText
          .split("\n")
          .map((line) => normalizeTranscriptLine(line))
          .filter((line) => line.length >= 20);
      }

      const uniqueLines = dedupeTranscriptLines(lines);
      return uniqueLines.join("\n");
    }

    function getTranscriptPanelRoot() {
      const allPanels = Array.from(
        document.querySelectorAll("ytd-engagement-panel-section-list-renderer"),
      );

      const transcriptPanels = allPanels.filter((panel) => {
        const targetId = (panel.getAttribute("target-id") || "").toLowerCase();
        if (targetId.includes("transcript")) {
          return true;
        }
        return Boolean(
          panel.querySelector("ytd-transcript-renderer") ||
          panel.querySelector("ytd-transcript-search-panel-renderer"),
        );
      });

      if (transcriptPanels.length) {
        const expanded = transcriptPanels.find(
          (panel) =>
            panel.getAttribute("visibility") ===
            "ENGAGEMENT_PANEL_VISIBILITY_EXPANDED",
        );
        if (expanded) {
          return expanded;
        }

        const visible = transcriptPanels.find((panel) => {
          const style = window.getComputedStyle(panel);
          if (style.display === "none" || style.visibility === "hidden") {
            return false;
          }
          const rect = panel.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });

        if (visible) {
          return visible;
        }

        return transcriptPanels[0] || null;
      }

      const transcriptRenderer = document.querySelector(
        "ytd-transcript-renderer, ytd-transcript-search-panel-renderer",
      );
      if (transcriptRenderer instanceof HTMLElement) {
        const parentPanel = transcriptRenderer.closest(
          "ytd-engagement-panel-section-list-renderer",
        );
        return parentPanel || transcriptRenderer;
      }

      return null;
    }

    function dedupeTranscriptLines(lines) {
      const output = [];
      const seen = new Set();
      for (const rawLine of lines) {
        const line = (rawLine || "").trim();
        if (!line) {
          continue;
        }
        // Simplified dedupe: also normalize for better matching
        const normalized = line.toLowerCase().replace(/\s+/g, " ");
        if (seen.has(normalized)) {
          continue;
        }
        seen.add(normalized);
        output.push(line);
      }
      return output;
    }

    function normalizeTranscriptLine(value) {
      if (!value) {
        return "";
      }

      // Remove timestamp prefixes like "1:23", "01:23", "1:23:45"
      const withoutPrefixTimestamp = value
        .replace(/^\d{1,2}:\d{2}(?::\d{2})?\s*/, "")
        .replace(/^\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*[\-–—]?\s*/, "")
        .replace(/\s+/g, " ")
        .trim();

      if (!withoutPrefixTimestamp || isTimestampOnly(withoutPrefixTimestamp)) {
        return "";
      }

      const lowered = withoutPrefixTimestamp.toLowerCase();
      const ignoredUiLabels = new Set([
        "transcript",
        "show transcript",
        "search in video",
        "search transcript",
        "loading...",
        "sort by",
      ]);
      if (ignoredUiLabels.has(lowered)) {
        return "";
      }

      return withoutPrefixTimestamp;
    }

    function isTimestampOnly(value) {
      return /^\[?\d{1,2}:\d{2}(?::\d{2})?\]?$/.test((value || "").trim());
    }

    async function waitForTranscriptText(timeoutMs) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const transcript = extractTranscriptText();
        if (isUsableTranscript(transcript)) {
          return transcript;
        }

        // Try to find the scrollable container and scroll down to trigger lazy loading
        const panel = getTranscriptPanelRoot();
        if (panel) {
          const scrollableCandidates = Array.from(
            panel.querySelectorAll(
              "#segments-container, #content-container, ytd-transcript-segment-list-renderer, #body, #contents",
            ),
          );
          for (const scrollable of scrollableCandidates) {
            if (scrollable instanceof HTMLElement) {
              scrollable.scrollTop = scrollable.scrollHeight;
            }
          }
        }

        await new Promise((resolve) => window.setTimeout(resolve, 500));
      }
      return "";
    }

    function isUsableTranscript(transcript) {
      const value = (transcript || "")
        .split("\n")
        .map((line) => normalizeTranscriptLine(line))
        .filter(Boolean)
        .join("\n")
        .trim();

      if (!value) {
        return false;
      }

      const lowered = value.toLowerCase();
      if (
        lowered === "transcript" ||
        lowered === "show transcript" ||
        lowered === "loading..."
      ) {
        return false;
      }

      // Reject pure symbols/numbers; allow non-Latin languages.
      const hasAlphanumericLikeChars = /[\p{L}\p{N}]/u.test(value);
      if (!hasAlphanumericLikeChars) {
        return false;
      }

      const lines = value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const words = value.split(/\s+/).filter(Boolean);
      const totalChars = value.replace(/\s+/g, "").length;

      // Be permissive for short videos while still avoiding UI-only snippets.
      if (lines.length < 2 && words.length < 4 && totalChars < 18) {
        return false;
      }

      const uiWords = new Set([
        "transcript",
        "show",
        "search",
        "video",
        "loading",
        "sort",
        "by",
      ]);
      const meaningfulWords = words.filter((word) => {
        const normalized = word
          .toLowerCase()
          .replace(/[^a-z0-9\u00C0-\u017F]/g, "");
        return normalized.length >= 3 && !uiWords.has(normalized);
      });

      return meaningfulWords.length >= 1;
    }

    function setStatus(message, type) {
      if (!statusElement) {
        return;
      }

      const trimmedMessage = (message || "").trim();
      statusElement.textContent = trimmedMessage;

      if (!trimmedMessage) {
        statusElement.className = "ytai-status ytai-hidden";
        return;
      }

      statusElement.className = `ytai-status ytai-${type}`;
    }

    function composePrompt(transcript, mode) {
      const instruction = modeOptions[mode] || modeOptions.summarize;
      return `${instruction}\n\nTranscript:\n${transcript}`;
    }

    function loadModePreference() {
      try {
        const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
        if (stored && modeOptions[stored]) {
          return stored;
        }
      } catch (error) {
        console.debug("Could not read mode preference", error);
      }
      return "summarize";
    }

    function saveModePreference(mode) {
      try {
        window.localStorage.setItem(MODE_STORAGE_KEY, mode);
      } catch (error) {
        console.debug("Could not save mode preference", error);
      }
    }

    function capitalize(value) {
      if (!value) {
        return "";
      }
      return value.charAt(0).toUpperCase() + value.slice(1);
    }

    function getVideoId() {
      return new URLSearchParams(window.location.search).get("v") || "";
    }
  }

  function initAiAutofill() {
    const runtime = globalThis.chrome?.runtime;
    if (!runtime?.sendMessage) {
      return;
    }

    runtime.sendMessage(
      { action: "getPendingTranscript" },
      async (response) => {
        if (runtime.lastError || !response?.success) {
          return;
        }

        const payload = response.payload || {};
        const prompt = payload.prompt || payload.transcript;
        if (!prompt) {
          return;
        }

        const inserted = await tryInsertPrompt(prompt);
        if (inserted && runtime.sendMessage) {
          runtime.sendMessage({ action: "pendingTranscriptConsumed" });
        }
      },
    );
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_error) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "readonly");
      textarea.style.position = "fixed";
      textarea.style.top = "-9999px";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    }
  }

  async function tryInsertPrompt(text) {
    const targets = [
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="message"]',
      'textarea[placeholder*="Ask"]',
      "textarea[data-id]",
      "textarea",
      '[contenteditable="true"][role="textbox"]',
      '[contenteditable="true"]',
    ];

    for (let attempt = 0; attempt < 20; attempt += 1) {
      for (const selector of targets) {
        const input = document.querySelector(selector);
        if (!input) {
          continue;
        }

        if (
          input instanceof HTMLTextAreaElement ||
          input instanceof HTMLInputElement
        ) {
          input.focus();
          input.value = text;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }

        input.focus();
        input.textContent = text;
        input.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            inputType: "insertText",
            data: text,
          }),
        );
        return true;
      }

      // Wait for AI app UI to finish hydration
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }

    return false;
  }
})();
