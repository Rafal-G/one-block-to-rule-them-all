import {
  EMPTY_SETTINGS,
  normalizeSettings,
  classify,
  compileRules,
  matchesDomain,
} from "./core.js";

// Serialize rule/settings changes and approval so a simultaneous save cannot grant a stale bypass.
let queue = Promise.resolve();
function serial(task) {
  const next = queue.then(task);
  queue = next.catch(() => {});
  return next;
}
const gateUrl = chrome.runtime.getURL("gate.html");
const settingsUrl = chrome.runtime.getURL("options.html");
async function getSettings() {
  return normalizeSettings(
    (await chrome.storage.local.get("settings")).settings ?? EMPTY_SETTINGS,
  );
}
async function removePass(tabId) {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [tabId + 1],
  });
  await chrome.storage.session.remove(`pass:${tabId}`);
}
async function saveSettings(value) {
  const settings = normalizeSettings(value);
  const old = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: old.map((rule) => rule.id),
    addRules: compileRules(settings, gateUrl),
  });
  await chrome.storage.local.set({ settings });
  const session = await chrome.declarativeNetRequest.getSessionRules();
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: session.map((rule) => rule.id),
  });
  await chrome.storage.session.clear();
  return { settings };
}

async function handle(message, sender) {
  if (sender.id !== chrome.runtime.id) throw new Error("Untrusted sender.");
  if (message.type === "save") {
    if (sender.url !== settingsUrl)
      throw new Error("Open settings to edit your lists.");
    return saveSettings(message.settings);
  }
  if (!["start", "continue"].includes(message.type))
    throw new Error("Unknown request.");
  if (!sender.url?.startsWith(`${gateUrl}#`) || !sender.documentId)
    throw new Error("Open the pause page in a tab.");
  // Extension documents need not populate MessageSender.tab/frameId. Resolve the
  // actual live document instead; this also rejects stale pages and subframes.
  const [context] = await chrome.runtime.getContexts({
    contextTypes: ["TAB"],
    documentIds: [sender.documentId],
  });
  if (
    !context ||
    context.frameId !== 0 ||
    context.tabId < 0 ||
    context.documentUrl !== sender.url
  ) {
    throw new Error("This pause page is no longer active.");
  }
  const tabId = context.tabId;
  const target = sender.url.slice(gateUrl.length + 1);
  const settings = await getSettings();
  const choice = classify(target, settings);
  const key = `wait:${tabId}`;
  if (message.type === "start") {
    await removePass(tabId);
    let wait = (await chrome.storage.session.get(key))[key];
    if (!wait || wait.target !== target) {
      wait = { target, readyAt: Date.now() + settings.cooldownSeconds * 1000 };
      await chrome.storage.session.set({ [key]: wait });
    }
    return { ...choice, target, readyAt: wait.readyAt };
  }
  if (choice.mode === "blocked")
    throw new Error("This website is always blocked.");
  if (choice.mode === "cooldown") {
    const wait = (await chrome.storage.session.get(key))[key];
    if (!wait || wait.target !== target || Date.now() < wait.readyAt)
      throw new Error(
        `Take the full ${settings.cooldownSeconds} seconds before continuing. If settings changed, reopen the website to start a new pause.`,
      );
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [tabId + 1],
      addRules: [
        {
          id: tabId + 1,
          priority: 20,
          action: { type: "allow" },
          condition: {
            tabIds: [tabId],
            requestDomains: [choice.domain],
            resourceTypes: ["main_frame"],
          },
        },
      ],
    });
    await chrome.storage.session.set({ [`pass:${tabId}`]: choice.domain });
  }
  await chrome.storage.session.remove(key);
  await chrome.tabs.update(tabId, { url: target });
  return { ok: true };
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  serial(() => handle(message, sender)).then(reply, (error) =>
    reply({ error: error.message }),
  );
  return true;
});
chrome.runtime.onInstalled.addListener(() => {
  serial(async () => saveSettings(await getSettings())).catch(console.error);
});
chrome.runtime.onStartup.addListener(() => {
  serial(async () => {
    const rules = await chrome.declarativeNetRequest.getSessionRules();
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: rules.map((rule) => rule.id),
    });
    await chrome.storage.session.clear();
  }).catch(console.error);
});
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  serial(async () => {
    const domain = (await chrome.storage.session.get(`pass:${details.tabId}`))[
      `pass:${details.tabId}`
    ];
    if (domain && !matchesDomain(new URL(details.url).hostname, domain))
      await removePass(details.tabId);
    if (!details.url.startsWith(`${gateUrl}#`))
      await chrome.storage.session.remove(`wait:${details.tabId}`);
  }).catch(console.error);
});
chrome.tabs.onRemoved.addListener((tabId) => {
  serial(async () => {
    await removePass(tabId);
    await chrome.storage.session.remove(`wait:${tabId}`);
  }).catch(console.error);
});
