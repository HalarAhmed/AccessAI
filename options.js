document.addEventListener('DOMContentLoaded', () => {
  const geminiKeyInput = document.getElementById('gemini-key');
  const deepgramKeyInput = document.getElementById('deepgram-key');
  const ttsVoiceSelect = document.getElementById('tts-voice');
  const ttsSpeedInput = document.getElementById('tts-speed');
  const speedVal = document.getElementById('speed-val');
  const btnSave = document.getElementById('btn-save');
  const statusMsg = document.getElementById('save-status');

  // Load settings
  chrome.storage.local.get(['geminiKey', 'deepgramKey', 'ttsVoice', 'ttsSpeed'], (result) => {
    if (result.geminiKey) geminiKeyInput.value = result.geminiKey;
    if (result.deepgramKey) deepgramKeyInput.value = result.deepgramKey;
    if (result.ttsVoice) ttsVoiceSelect.value = result.ttsVoice;
    if (result.ttsSpeed) {
      ttsSpeedInput.value = result.ttsSpeed;
      speedVal.textContent = result.ttsSpeed;
    }
  });

  ttsSpeedInput.addEventListener('input', () => {
    speedVal.textContent = parseFloat(ttsSpeedInput.value).toFixed(1);
  });

  btnSave.addEventListener('click', () => {
    const settings = {
      geminiKey: geminiKeyInput.value.trim(),
      deepgramKey: deepgramKeyInput.value.trim(),
      ttsVoice: ttsVoiceSelect.value,
      ttsSpeed: parseFloat(ttsSpeedInput.value)
    };

    chrome.storage.local.set(settings, () => {
      statusMsg.textContent = 'Settings saved successfully!';
      statusMsg.style.opacity = 1;
      setTimeout(() => {
        statusMsg.style.opacity = 0;
      }, 3000);
    });
  });
});
