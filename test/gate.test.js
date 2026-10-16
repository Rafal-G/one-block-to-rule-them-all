import test from "node:test";
import assert from "node:assert/strict";

// Exercise the actual page script without a browser or a real 30-second delay.
async function openGate(mode, durationSeconds = 30) {
  const elements = new Map();
  const callbacks = new Map();
  globalThis.document = {
    querySelector(selector) {
      if (!elements.has(selector))
        elements.set(selector, {
          hidden: ["#timer", "#continue"].includes(selector),
          disabled: selector === "#continue",
          textContent: "",
          addEventListener(type, fn) {
            callbacks.set(`${selector}:${type}`, fn);
          },
        });
      return elements.get(selector);
    },
  };
  const requests = [];
  const start = Date.now();
  globalThis.chrome = {
    runtime: {
      async sendMessage(message) {
        requests.push(message.type);
        return message.type === "start"
          ? {
              mode,
              target: "https://youtube.com/",
              readyAt: start + durationSeconds * 1000,
            }
          : { ok: true };
      },
    },
  };
  await import(`../extension/gate.js?test=${mode}-${durationSeconds}`);
  return { elements, callbacks, requests, start };
}

for (const durationSeconds of [5, 30, 60])
  test(`cooldown page requires a click after ${durationSeconds} seconds`, async () => {
    const originalInterval = globalThis.setInterval;
    const originalClear = globalThis.clearInterval;
    const originalNow = Date.now;
    let tick;
    globalThis.setInterval = (callback) => {
      tick = callback;
      return 1;
    };
    globalThis.clearInterval = () => {};
    try {
      const { elements, callbacks, requests, start } = await openGate(
        "cooldown",
        durationSeconds,
      );
      assert.equal(elements.get("#heading").textContent, "Pause. Then choose.");
      assert.equal(elements.get("#timer").hidden, false);
      assert.equal(elements.get("#seconds").textContent, durationSeconds);
      assert.equal(elements.get("#continue").hidden, false);
      assert.equal(elements.get("#continue").disabled, true);
      Date.now = () => start + durationSeconds * 1000 - 1;
      tick();
      assert.equal(elements.get("#continue").disabled, true);
      Date.now = () => start + durationSeconds * 1000;
      tick();
      assert.equal(elements.get("#continue").disabled, false);
      assert.deepEqual(requests, ["start"]);
      await callbacks.get("#continue:click")();
      assert.deepEqual(requests, ["start", "continue"]);
    } finally {
      globalThis.setInterval = originalInterval;
      globalThis.clearInterval = originalClear;
      Date.now = originalNow;
    }
  });

test("blocked page never shows a timer or continue action", async () => {
  const { elements, callbacks } = await openGate("blocked");
  assert.equal(elements.get("#heading").textContent, "You shall not pass.");
  assert.equal(callbacks.has("#continue:click"), false);
  assert.equal(elements.has("#timer"), false);
});
