document.addEventListener('DOMContentLoaded', () => {
  const toggleImageDesc = document.getElementById('toggle-image-desc');
  const toggleCaptions = document.getElementById('toggle-captions');
  const toggleSimplify = document.getElementById('toggle-simplify');
  const toggleRead = document.getElementById('toggle-read');
  const toggleDyslexia = document.getElementById('toggle-dyslexia');
  const btnOptions = document.getElementById('btn-options');

  // Load current states
  chrome.storage.local.get(['imageDesc', 'captions', 'simplifyText', 'readAloud', 'dyslexiaMode'], (result) => {
    toggleImageDesc.checked = result.imageDesc !== false;
    toggleCaptions.checked = result.captions !== false;
    toggleSimplify.checked = result.simplifyText !== false;
    toggleRead.checked = result.readAloud !== false;
    toggleDyslexia.checked = result.dyslexiaMode === true; // Default false
  });

  // Save state on change and notify content script
  function saveState() {
    const settings = {
      imageDesc: toggleImageDesc.checked,
      captions: toggleCaptions.checked,
      simplifyText: toggleSimplify.checked,
      readAloud: toggleRead.checked,
      dyslexiaMode: toggleDyslexia.checked
    };
    
    chrome.storage.local.set(settings, () => {
      // Notify active tab
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'UPDATE_SETTINGS',
            settings: settings
          }).catch(() => {}); // ignore error if content script not loaded
        }
      });
    });
  }

  toggleImageDesc.addEventListener('change', saveState);
  toggleCaptions.addEventListener('change', saveState);
  toggleSimplify.addEventListener('change', saveState);
  toggleRead.addEventListener('change', saveState);
  toggleDyslexia.addEventListener('change', saveState);

  btnOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});
