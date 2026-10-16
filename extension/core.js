export const DEFAULT_COOLDOWN_SECONDS = 30;
export const EMPTY_SETTINGS = {
  blocked: [],
  cooldown: [],
  cooldownSeconds: DEFAULT_COOLDOWN_SECONDS,
};

export function normalizeDomain(input) {
  const value = input.trim();
  if (!value || /[\s*]/.test(value))
    throw new Error(`Invalid website: ${input}`);
  let url;
  try {
    url = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    throw new Error(`Invalid website: ${input}`);
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(
      `Use a domain only, such as reddit.com (no paths, ports, or wildcards): ${input}`,
    );
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    host.length > 253 ||
    !host
      .split(".")
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  ) {
    throw new Error(`Invalid domain: ${input}`);
  }
  return host;
}

export function normalizeSettings(value) {
  const result = {};
  for (const key of ["blocked", "cooldown"]) {
    if (!Array.isArray(value?.[key]))
      throw new Error("Both website lists are required.");
    result[key] = [...new Set(value[key].map(normalizeDomain))].sort();
  }
  if (result.blocked.length + result.cooldown.length > 500)
    throw new Error("Please use at most 500 websites.");
  const cooldownSeconds =
    value.cooldownSeconds === undefined
      ? DEFAULT_COOLDOWN_SECONDS
      : value.cooldownSeconds;
  if (
    !Number.isSafeInteger(cooldownSeconds) ||
    cooldownSeconds < 1 ||
    !Number.isSafeInteger(cooldownSeconds * 1000)
  ) {
    throw new Error("Enter a positive whole number of seconds.");
  }
  result.cooldownSeconds = cooldownSeconds;
  return result;
}

export function matchesDomain(host, domain) {
  host = host.toLowerCase().replace(/\.$/, "");
  return host === domain || host.endsWith(`.${domain}`);
}

export function classify(target, settings) {
  const url = new URL(target);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Only HTTP and HTTPS websites are supported.");
  for (const mode of ["blocked", "cooldown"]) {
    const domain = settings[mode].find((domain) =>
      matchesDomain(url.hostname, domain),
    );
    if (domain) return { mode, domain };
  }
  return { mode: "allowed", domain: url.hostname };
}

export function compileRules(settings, gateUrl) {
  let id = 1;
  return ["blocked", "cooldown"].flatMap((mode) =>
    settings[mode].map((domain) => ({
      id: id++,
      priority: mode === "blocked" ? 100 : 10,
      action: {
        type: "redirect",
        redirect: { regexSubstitution: `${gateUrl}#\\0` },
      },
      condition: {
        regexFilter: `^https?://([^/@:]+\\.)?${domain.replaceAll(".", "\\.")}\\.?(?::[0-9]+)?([/?].*)?$`,
        resourceTypes: ["main_frame"],
      },
    })),
  );
}
