// The /features voice picker is hand-copied from the app's voice registry;
// this keeps the labels, blurbs and light/dark availability in step with it.
// Read as text, not imported — the site build can't pull app modules in.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { voices } from "./features";

const SRC = readFileSync(
  fileURLToPath(new URL("../../../src/lib/voices.ts", import.meta.url)),
  "utf8",
);

function appVoices() {
  const body = SRC.slice(SRC.indexOf("export const VOICES"));
  return body
    .split(/\n  \{\n/)
    .slice(1)
    .map((c) => c.split("\n  },")[0])
    .map((c) => ({
      id: /\bid:\s*'([^']+)'/.exec(c)?.[1],
      label: /\blabel:\s*'([^']+)'/.exec(c)?.[1],
      blurb: /\bblurb:\s*'([^']+)'/.exec(c)?.[1],
      hasLight: !/\blight:\s*null/.test(c),
    }))
    .filter((v) => v.id);
}

describe("/features voice picker matches the app", () => {
  const app = appVoices();

  it("reads the app's voices", () => {
    expect(app.length).toBeGreaterThanOrEqual(6);
  });

  it("has the same voices, labels and blurbs, in the same order", () => {
    expect(voices.map((v) => [v.id, v.label, v.blurb])).toEqual(
      app.map((v) => [v.id, v.label, v.blurb]),
    );
  });

  it("offers light only where the voice has a light palette", () => {
    expect(voices.map((v) => v.modes.includes("light"))).toEqual(app.map((v) => v.hasLight));
  });
});
