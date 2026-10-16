import { EMPTY_SETTINGS, normalizeSettings } from "./core.js";
const form = document.querySelector("form");
const status = document.querySelector("#status");
const button = document.querySelector("#save");
button.disabled = true;
try {
  const { settings = EMPTY_SETTINGS } =
    await chrome.storage.local.get("settings");
  showSettings(normalizeSettings(settings));
  button.disabled = false;
} catch (error) {
  status.textContent = error.message;
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  status.textContent = "Saving…";
  try {
    const settings = Object.fromEntries(
      ["blocked", "cooldown"].map((key) => [
        key,
        document
          .getElementById(key)
          .value.split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      ]),
    );
    settings.cooldownSeconds =
      document.getElementById("cooldown-seconds").valueAsNumber;
    const response = await chrome.runtime.sendMessage({
      type: "save",
      settings,
    });
    if (response.error) throw new Error(response.error);
    showSettings(response.settings);
    status.textContent = "Saved. Your paths are set.";
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

function showSettings(settings) {
  for (const key of ["blocked", "cooldown"])
    document.getElementById(key).value = settings[key].join("\n");
  document.getElementById("cooldown-seconds").value = settings.cooldownSeconds;
}
