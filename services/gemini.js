export const GeminiService = {
  async getApiKey() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['geminiKey'], (result) => {
        resolve(result.geminiKey);
      });
    });
  },

  async _urlToBase64(url) {
    try {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.byteLength; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
      }
      
      let mimeType = response.headers.get('content-type') || 'image/jpeg';
      if (!mimeType.startsWith('image/')) {
        mimeType = 'image/jpeg';
      }

      return {
        base64: btoa(binary),
        mimeType: mimeType
      };
    } catch (e) {
      console.error("Failed to fetch image for base64 conversion", e);
      throw e;
    }
  },

  async describeImage(imageUrl) {
    const apiKey = await this.getApiKey();
    if (!apiKey) throw new Error("Gemini API key not configured. Please add it in settings.");

    try {
      // 1. Fetch image and convert to base64
      const { base64, mimeType } = await this._urlToBase64(imageUrl);

      // 2. Call Gemini API
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{
          parts: [
            { text: "Describe this image in a concise, natural language sentence for a visually impaired user. Focus on the main subject and context." },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64
              }
            }
          ]
        }]
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message);
      }
      
      if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
         throw new Error("Invalid response from Gemini (possible safety block).");
      }

      return data.candidates[0].content.parts[0].text.trim();
    } catch (e) {
      console.error("Gemini Image Description Error:", e);
      throw e;
    }
  },

  async simplifyText(text) {
    const apiKey = await this.getApiKey();
    if (!apiKey) throw new Error("Gemini API key not configured. Please add it in settings.");

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{
          parts: [
            { text: `Rewrite this text so that a 12-year-old can understand it without changing the meaning. Respond ONLY with the simplified text:\n\n${text}` }
          ]
        }]
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message);
      }

      return data.candidates[0].content.parts[0].text.trim();
    } catch (e) {
      console.error("Gemini Text Simplification Error:", e);
      throw e;
    }
  }
};
