export const TTSService = {
  async getDeepgramKey() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['deepgramKey'], (result) => {
        resolve(result.deepgramKey);
      });
    });
  },

  async speak(text, voice = 'chrome-en-US', speed = 1.0) {
    if (voice.startsWith('deepgram-')) {
      const apiKey = await this.getDeepgramKey();
      if (!apiKey) {
        console.error("Deepgram API key not configured.");
        return { error: "Deepgram API key not configured." };
      }
      
      const model = voice.replace('deepgram-', '');
      try {
        const response = await fetch(`https://api.deepgram.com/v1/speak?model=${model}`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text })
        });
        
        if (!response.ok) {
          throw new Error(`Deepgram API error: ${response.status}`);
        }
        
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.byteLength; i += chunkSize) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
        }
        
        return { audioData: `data:audio/mp3;base64,${btoa(binary)}` };
      } catch (e) {
        console.error("Deepgram TTS Error:", e);
        return { error: e.message };
      }
    } else {
      // Chrome TTS fallback
      return new Promise((resolve) => {
        let lang = 'en-US';
        if (voice === 'chrome-en-GB') lang = 'en-GB';
        
        chrome.tts.speak(text, {
          lang: lang,
          rate: speed,
          onEvent: (event) => {
            if (event.type === 'end' || event.type === 'interrupted' || event.type === 'cancelled') {
              resolve({ playedLocal: true });
            } else if (event.type === 'error') {
              console.error("TTS Error:", event.errorMessage);
              resolve({ error: event.errorMessage }); 
            }
          }
        });
      });
    }
  },

  async stop() {
    return new Promise((resolve) => {
      chrome.tts.stop();
      resolve();
    });
  }
};
