(() => {
  "use strict";

  const logic = globalThis.GlobisMypageLogic;
  const inputs = Array.from(document.querySelectorAll("[data-setting]"));
  const statusEl = document.getElementById("status");
  const resetButton = document.getElementById("reset");

  function setStatus(text) {
    statusEl.textContent = text;
    if (!text) return;
    setTimeout(() => {
      if (statusEl.textContent === text) statusEl.textContent = "";
    }, 1600);
  }

  function getStorage() {
    return chrome.storage.sync;
  }

  function loadSettings() {
    return new Promise((resolve) => {
      getStorage().get(logic.SETTINGS_KEY, (result) => {
        resolve(logic.normalizeSettings(result && result[logic.SETTINGS_KEY]));
      });
    });
  }

  function saveSettings(settings) {
    return new Promise((resolve) => {
      getStorage().set({ [logic.SETTINGS_KEY]: settings }, resolve);
    });
  }

  function render(settings) {
    for (const input of inputs) {
      input.checked = Boolean(settings[input.dataset.setting]);
    }
  }

  function readForm() {
    const settings = logic.normalizeSettings();
    for (const input of inputs) {
      settings[input.dataset.setting] = input.checked;
    }
    return settings;
  }

  async function init() {
    render(await loadSettings());

    for (const input of inputs) {
      input.addEventListener("change", async () => {
        await saveSettings(readForm());
        setStatus("保存しました");
      });
    }

    resetButton.addEventListener("click", async () => {
      const defaults = logic.normalizeSettings();
      await saveSettings(defaults);
      render(defaults);
      setStatus("初期化しました");
    });
  }

  init();
})();
