(() => {
  "use strict";

  const logic = globalThis.GlobisMypageLogic;
  const inputs = Array.from(document.querySelectorAll("[data-setting]"));
  const statusEl = document.getElementById("status");
  const resetButton = document.getElementById("reset");
  let currentSettings = logic.normalizeSettings();

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

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
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

  async function requireCalendarReauth() {
    try {
      const response = await sendMessage({ type: "GLOBIS_REQUIRE_CALENDAR_REAUTH" });
      return Boolean(response && response.ok);
    } catch (_error) {
      return false;
    }
  }

  async function init() {
    currentSettings = await loadSettings();
    render(currentSettings);

    for (const input of inputs) {
      input.addEventListener("change", async () => {
        const key = input.dataset.setting;
        const wasGoogleCalendarSyncEnabled = currentSettings.googleCalendarSync;
        const nextSettings = readForm();

        await saveSettings(nextSettings);
        currentSettings = nextSettings;

        if (key === "googleCalendarSync") {
          if (input.checked && !wasGoogleCalendarSyncEnabled) {
            await requireCalendarReauth();
            setStatus("保存しました");
            return;
          }

          if (!input.checked) {
            sendMessage({ type: "GLOBIS_CLEAR_CALENDAR_AUTH" }).catch(() => {});
          }
        }

        setStatus("保存しました");
      });
    }

    resetButton.addEventListener("click", async () => {
      const defaults = logic.normalizeSettings();
      const shouldRequireCalendarReauth = defaults.googleCalendarSync && !currentSettings.googleCalendarSync;
      await saveSettings(defaults);
      if (shouldRequireCalendarReauth) await requireCalendarReauth();
      render(defaults);
      currentSettings = defaults;
      setStatus("初期化しました");
    });
  }

  init();
})();
