console.log("AccessAI Content Script Loaded");

let isImageDescEnabled = false;
let isSimplifyTextEnabled = false;
let isReadAloudEnabled = false;
let isDyslexiaModeEnabled = false;

// Load settings
chrome.storage.local.get(['imageDesc', 'simplifyText', 'readAloud', 'dyslexiaMode'], (result) => {
  isImageDescEnabled = result.imageDesc !== false; // Default true
  isSimplifyTextEnabled = result.simplifyText !== false;
  isReadAloudEnabled = result.readAloud !== false;
  isDyslexiaModeEnabled = result.dyslexiaMode === true;

  if (isDyslexiaModeEnabled) document.body.classList.add('accessai-dyslexia-mode');

  if (isReadAloudEnabled) {
    setTimeout(() => pageReader.start(), 1000); // Give DOM a second to settle
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'UPDATE_SETTINGS') {
    isImageDescEnabled = request.settings.imageDesc;
    isSimplifyTextEnabled = request.settings.simplifyText;
    isReadAloudEnabled = request.settings.readAloud;
    isDyslexiaModeEnabled = request.settings.dyslexiaMode;
    
    if (isDyslexiaModeEnabled) {
      document.body.classList.add('accessai-dyslexia-mode');
    } else {
      document.body.classList.remove('accessai-dyslexia-mode');
    }
    
    if (isReadAloudEnabled) pageReader.start();
    else pageReader.stop();
  }
});

async function processImage(img) {
    if (!img.src || img.src.startsWith('data:')) return; 
    
    const wrapper = document.createElement('div');
    wrapper.style.display = 'inline-block';
    wrapper.style.position = 'relative';
    img.parentNode.insertBefore(wrapper, img);
    wrapper.appendChild(img);

    const loadingEl = document.createElement('div');
    loadingEl.className = 'accessai-alt-text';
    loadingEl.textContent = "👁️ AI: Thinking... (in queue)";
    wrapper.appendChild(loadingEl);
    
    try {
      const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'GET_IMAGE_DESCRIPTION', imageUrl: img.src }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ error: chrome.runtime.lastError.message });
          } else {
            resolve(res);
          }
        });
      });
      
      loadingEl.remove(); // Remove loading indicator
      
      if (response && response.description) {
        img.setAttribute('alt', response.description);
        
        const descEl = document.createElement('div');
        descEl.className = 'accessai-alt-text';
        descEl.textContent = "👁️ AI: " + response.description;
        wrapper.appendChild(descEl);
      }
    } catch (err) {
      loadingEl.remove();
      console.error("Failed to get image description", err);
    }
}

class PageReader {
  constructor() {
    this.elements = [];
    this.currentIndex = 0;
    this.isPlaying = false;
    this.stopBtn = null;
  }

  buildReadableList() {
    this.elements = [];
    
    // Expanded tag list to ensure we don't skip lists, quotes, or captions "in between"
    const nodes = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, img, td, figcaption, caption');
    
    const pageHeight = Math.max(document.body.scrollHeight, document.body.offsetHeight);
    
    nodes.forEach(node => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      
      // 1. Visibility Check
      if (rect.width === 0 || rect.height === 0 || style.visibility === 'hidden' || style.opacity === '0' || style.display === 'none') {
        return;
      }

      // 2. Positional Boilerplate Filter (Extremely Safe)
      const absoluteTop = rect.top + window.scrollY;
      const isHeaderLike = node.closest('header, nav, [class*="header" i], [id*="header" i], [class*="nav" i], [id*="nav" i]');
      const isFooterLike = node.closest('footer, [class*="footer" i], [id*="footer" i]');
      
      // Skip if it's named "header/nav" AND it's physically in the top 25% of the page
      if (isHeaderLike && absoluteTop < pageHeight * 0.25) {
        return;
      }
      
      // Skip if it's named "footer" AND it's physically in the bottom 25% of the page
      if (isFooterLike && absoluteTop > pageHeight * 0.75) {
        return;
      }

      this.elements.push(node);
    });

    // 3. Sort elements strictly by their visual top-to-bottom position on the page
    this.elements.sort((a, b) => {
      const aTop = a.getBoundingClientRect().top + window.scrollY;
      const bTop = b.getBoundingClientRect().top + window.scrollY;
      
      // If they are on the same horizontal line, sort left-to-right
      if (Math.abs(aTop - bTop) < 20) {
        const aLeft = a.getBoundingClientRect().left + window.scrollX;
        const bLeft = b.getBoundingClientRect().left + window.scrollX;
        return aLeft - bLeft;
      }
      
      return aTop - bTop;
    });
  }

  async start() {
    // If the list hasn't been built yet, or we've reached the end, rebuild and start from 0
    if (!this.elements || this.elements.length === 0 || this.currentIndex >= this.elements.length) {
      this.buildReadableList();
      this.currentIndex = 0;
    }
    // Otherwise, we retain currentIndex to resume exactly where we left off
    
    this.isPlaying = true;
    this.showStopButton();
    await this.readNext();
  }

  stop() {
    this.isPlaying = false;
    chrome.runtime.sendMessage({ action: 'STOP_READING' });
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (this.stopBtn) {
      this.stopBtn.remove();
      this.stopBtn = null;
    }
  }

  showStopButton() {
    if (this.stopBtn) return;
    this.stopBtn = document.createElement('button');
    this.stopBtn.textContent = '⏹️ Stop Reading';
    this.stopBtn.style.position = 'fixed';
    this.stopBtn.style.bottom = '20px';
    this.stopBtn.style.right = '20px';
    this.stopBtn.style.zIndex = 10000;
    this.stopBtn.style.padding = '10px 15px';
    this.stopBtn.style.background = '#f44336';
    this.stopBtn.style.color = '#fff';
    this.stopBtn.style.border = 'none';
    this.stopBtn.style.borderRadius = '5px';
    this.stopBtn.style.cursor = 'pointer';
    this.stopBtn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
    this.stopBtn.addEventListener('click', () => this.stop());
    document.body.appendChild(this.stopBtn);
  }

  async readNext() {
    if (!this.isPlaying || this.currentIndex >= this.elements.length) {
      this.stop();
      return;
    }

    const el = this.elements[this.currentIndex];
    this.currentIndex++;

    const oldBorder = el.style.outline;
    el.style.outline = '3px solid #2196F3';
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    let textToSpeak = '';

    if (el.tagName === 'IMG') {
      textToSpeak = await this.getImageDescriptionForReading(el);
    } else {
      textToSpeak = el.innerText.trim();
    }

    if (textToSpeak && textToSpeak.length > 0) {
      const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'READ_ALOUD', text: textToSpeak }, resolve);
      });
      
      if (response && response.audioData && this.isPlaying) {
        await new Promise((resolve) => {
          this.currentAudio = new Audio(response.audioData);
          this.currentAudio.onended = resolve;
          this.currentAudio.onerror = resolve; 
          this.currentAudio.play().catch(e => {
            console.error("Audio playback blocked/failed:", e);
            resolve();
          });
        });
        this.currentAudio = null;
      }
    }

    el.style.outline = oldBorder;
    
    if (this.isPlaying) {
      this.readNext();
    }
  }

  async getImageDescriptionForReading(img) {
    if (!isImageDescEnabled) return "";
    
    if (!img.hasAttribute('data-accessai-processed')) {
      img.setAttribute('data-accessai-processed', 'true');
      await processImage(img);
    }
    
    let alt = img.getAttribute('alt');
    if (alt && alt.includes("Unhandled AI Error")) return "Image description unavailable.";
    return alt ? "Image: " + alt : "Image";
  }
}

const pageReader = new PageReader();
class SelectionReader {
  constructor() {
    this.btn = null;
    this.currentAudio = null;
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    document.addEventListener('mousedown', this.handleMouseDown.bind(this));
  }

  handleMouseDown(e) {
    if (this.btn && !this.btn.contains(e.target)) {
      this.hideButton();
    }
  }

  handleMouseUp(e) {
    if (!isDyslexiaModeEnabled) return;
    
    // Slight delay to allow selection to finish registering
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      
      if (text.length > 0) {
        this.showButton(e.pageX, e.pageY, text);
      } else {
        this.hideButton();
      }
    }, 10);
  }

  showButton(x, y, textToSpeak) {
    if (!this.btn) {
      this.btn = document.createElement('button');
      this.btn.id = 'accessai-selection-btn';
      this.btn.textContent = '?? Play';
      document.body.appendChild(this.btn);
    }
    
    this.btn.style.left = (x + 10) + 'px';
    this.btn.style.top = (y + 10) + 'px';
    this.btn.style.display = 'flex';
    
    // Remove old listeners
    const newBtn = this.btn.cloneNode(true);
    this.btn.parentNode.replaceChild(newBtn, this.btn);
    this.btn = newBtn;
    
    this.btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      this.btn.textContent = '? Loading...';
      
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }
      
      const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'READ_ALOUD', text: textToSpeak }, resolve);
      });
      
      this.hideButton();
      
      if (response && response.audioData) {
        this.currentAudio = new Audio(response.audioData);
        this.currentAudio.play().catch(console.error);
      }
    });
  }

  hideButton() {
    if (this.btn) {
      this.btn.style.display = 'none';
    }
  }
}

const selectionReader = new SelectionReader();

// Keyboard Shortcut: Ctrl + Space to Toggle Reader
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.code === 'Space') {
    e.preventDefault(); // Prevent page scrolling
    if (pageReader.isPlaying) {
      pageReader.stop();
    } else {
      pageReader.start();
    }
  }
});
