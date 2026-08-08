# AccessAI

Make every website instantly accessible using Artificial Intelligence.

## Features
- **Image Descriptions**: Automatically generates alt text for images using Gemini Vision.
- **Video Captions**: (Prototype) Provides captions for HTML5 videos.
- **Simplify Text**: Simplifies complex paragraphs into readable language.
- **Read Aloud**: Select any text on a page to have it read aloud using TTS.

## Setup
1. Clone this repository or download the source code.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode" in the top right corner.
4. Click "Load unpacked" and select the `access-ai` directory.
5. Click on the extension icon in the toolbar, go to **Settings** (⚙️), and enter your Gemini API Key.

## Architecture
- **background.js**: Service worker orchestrating AI calls and cache management.
- **content.js**: Injected into pages to scan the DOM and apply accessibility layers.
- **services/**: Modular wrappers for Gemini, TTS, and STT capabilities.
- **cache/**: IndexedDB/Storage layer to avoid duplicate API hits.
