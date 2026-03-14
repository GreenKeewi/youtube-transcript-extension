# YouTube Transcript to AI Extension

A lightweight Chrome extension that injects a small panel inside YouTube watch pages and opens AI chat platforms with the video transcript.

## Features

- In-page panel on YouTube right-side feed column
- Small minimal UI (4 direct AI buttons)
- Automatic transcript extraction from YouTube transcript segments
- One-click open to ChatGPT, Claude, Gemini, or DeepSeek
- Automatic transcript insert in AI prompt when possible

## How It Works

1. Open a YouTube watch page.
2. The extension injects a **Transcript to AI** card in the right column.
3. Click one of the 4 AI buttons.
4. The extension loads transcript, opens that AI site, and inserts transcript when possible.

## Installation

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `youtube-transcript-ai` folder.
5. Refresh any open YouTube watch page.

## Usage

1. Go to any `https://www.youtube.com/watch...` page.
2. In the right feed column, find **Transcript to AI**.
3. Optionally click **Refresh** if needed.
4. Click one of these buttons:
   - ChatGPT
   - Claude
   - Gemini
   - DeepSeek

## Supported AI Platforms

- ChatGPT (`chat.openai.com` / `chatgpt.com`)
- Claude (`claude.ai`)
- Gemini (`gemini.google.com`)
- DeepSeek (`chat.deepseek.com`)

## Project Structure

```text
youtube-transcript-ai/
├── manifest.json
├── background.js
├── content.js
├── styles.css
└── icons/
```

## Notes

- Works on YouTube watch pages with transcript availability.
- Some videos do not provide transcript.
- If AI site UI changes, auto-insert may fail and manual paste may be needed.
