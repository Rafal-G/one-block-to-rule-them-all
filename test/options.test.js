import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSettings } from "../extension/core.js";

for (const storedSeconds of [undefined, 12]) {
  test(`settings load ${storedSeconds ?? "legacy default"} seconds and save a new duration`, async () => {
    const elements = new Map();
    let submit;
    function element(key) {
      if (!elements.has(key))
        elements.set(key, {
          value: "",
          get valueAsNumber() {
            return Number(this.value);
          },
          addEventListener(type, callback) {
            if (type === "submit") submit = callback;
          },
        });
      return elements.get(key);
    }
    globalThis.document = {
      querySelector: element,
      getElementById: element,
    };
    let stored = {
      blocked: ["example.com"],
      cooldown: ["reddit.com"],
      cooldownSeconds: storedSeconds,
    };
    globalThis.chrome = {
      storage: {
        local: {
          async get() {
            return { settings: stored };
          },
        },
      },
      runtime: {
        async sendMessage(message) {
          assert.equal(message.type, "save");
          stored = normalizeSettings(message.settings);
          return { settings: stored };
        },
      },
    };
    await import(`../extension/options.js?test=${storedSeconds}`);
    assert.equal(element("cooldown-seconds").value, storedSeconds ?? 30);
    assert.equal(element("blocked").value, "example.com");
    assert.equal(element("cooldown").value, "reddit.com");
    assert.equal(element("#save").disabled, false);
    element("cooldown-seconds").value = "7";
    await submit({ preventDefault() {} });
    assert.deepEqual(stored, {
      blocked: ["example.com"],
      cooldown: ["reddit.com"],
      cooldownSeconds: 7,
    });
    assert.equal(element("#status").textContent, "Saved. Your paths are set.");
    assert.equal(element("#save").disabled, false);
  });
}
