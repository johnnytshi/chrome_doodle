(function () {
  'use strict';

  const modeButtons = document.querySelectorAll('.modes button');
  const colorInput = document.getElementById('color');
  const sizeInput = document.getElementById('size');
  const sizeVal = document.getElementById('size-val');
  const undoBtn = document.getElementById('undo');
  const clearBtn = document.getElementById('clear');

  function sendMsg(msg) {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, msg, (resp) => {
            resolve(resp);
          });
        }
      });
    });
  }

  function setActiveButton(mode) {
    modeButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  }

  // Load current state
  sendMsg({ type: 'getState' }).then((state) => {
    if (!state) return;
    setActiveButton(state.mode);
    colorInput.value = state.color;
    sizeInput.value = state.size;
    sizeVal.textContent = state.size;
  });

  // Mode buttons
  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      setActiveButton(mode);
      sendMsg({ type: 'setMode', mode });
    });
  });

  // Color
  colorInput.addEventListener('input', () => {
    sendMsg({ type: 'setColor', color: colorInput.value });
  });

  // Size
  sizeInput.addEventListener('input', () => {
    sizeVal.textContent = sizeInput.value;
    sendMsg({ type: 'setSize', size: parseInt(sizeInput.value, 10) });
  });

  // Undo
  undoBtn.addEventListener('click', () => {
    sendMsg({ type: 'undo' });
  });

  // Clear
  clearBtn.addEventListener('click', () => {
    sendMsg({ type: 'clear' });
  });

  // Listen for mode changes from content script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'modeChanged') {
      setActiveButton(msg.mode);
    }
  });
})();
