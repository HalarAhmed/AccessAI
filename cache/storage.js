export const CacheLayer = {
  async get(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        if (result[key] && result[key].timestamp > Date.now() - 1000 * 60 * 60 * 24 * 7) { // 7 day cache
          resolve(result[key].value);
        } else {
          resolve(null);
        }
      });
    });
  },

  async set(key, value) {
    return new Promise((resolve) => {
      const data = {};
      data[key] = {
        value: value,
        timestamp: Date.now()
      };
      chrome.storage.local.set(data, resolve);
    });
  }
};
