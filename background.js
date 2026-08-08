import { CacheLayer } from './cache/storage.js';
import { GeminiService } from './services/gemini.js';
import { TTSService } from './services/tts.js';

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_IMAGE_DESCRIPTION') {
    handleImageDescription(request.imageUrl).then(sendResponse);
    return true; 
  }
  
  if (request.action === 'SIMPLIFY_TEXT') {
    handleTextSimplification(request.text).then(sendResponse);
    return true;
  }

  if (request.action === 'READ_ALOUD') {
    chrome.storage.local.get(['ttsVoice', 'ttsSpeed'], (result) => {
      const voice = result.ttsVoice || 'chrome-en-US';
      const speed = parseFloat(result.ttsSpeed) || 1.0;
      TTSService.speak(request.text, voice, speed).then(sendResponse);
    });
    return true;
  }
  
  if (request.action === 'STOP_READING') {
    TTSService.stop().then(sendResponse);
    return true;
  }
});

const imageQueue = [];
let isProcessingImageQueue = false;

async function handleImageDescription(imageUrl) {
  const cached = await CacheLayer.get(`img_v2_${imageUrl}`);
  if (cached) return { description: cached };

  return new Promise((resolve) => {
    imageQueue.push({ imageUrl, resolve, retries: 0 });
    processImageQueue();
  });
}

let isQuotaLocked = false;

async function processImageQueue() {
  if (isProcessingImageQueue) return;
  isProcessingImageQueue = true;

  while (imageQueue.length > 0) {
    const task = imageQueue[0];
    
    if (isQuotaLocked) {
      task.resolve({ description: "Description unavailable due to rate limits." });
      imageQueue.shift();
      continue;
    }

    try {
      const description = await GeminiService.describeImage(task.imageUrl);
      await CacheLayer.set(`img_v2_${task.imageUrl}`, description);
      task.resolve({ description });
      imageQueue.shift();
    } catch (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes('quota') || msg.includes('429')) {
        console.warn("Quota exceeded! Locking AI requests for 60 seconds.");
        isQuotaLocked = true;
        setTimeout(() => { isQuotaLocked = false; }, 60000);
        
        task.resolve({ description: "Description unavailable due to rate limits." });
        imageQueue.shift();
      } else {
        console.error("AI Description error:", error);
        task.resolve({ error: true, description: null });
        imageQueue.shift();
      }
    }
    
    if (imageQueue.length > 0 && !isQuotaLocked) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  
  isProcessingImageQueue = false;
}

async function handleTextSimplification(text) {
  const textKey = `text_v2_${text.substring(0, 50)}`;
  const cached = await CacheLayer.get(textKey);
  if (cached) return { simplified: cached };

  try {
    const simplified = await GeminiService.simplifyText(text);
    await CacheLayer.set(textKey, simplified);
    return { simplified };
  } catch (error) {
    console.error("AI Simplification error:", error);
    return { simplified: "Error: " + error.message };
  }
}
