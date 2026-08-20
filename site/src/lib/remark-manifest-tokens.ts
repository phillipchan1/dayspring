/**
 * Substitute `{{token}}` spans in help prose with values from the app manifest.
 *
 * This is what stops an article from hard-coding "$7 a month" or "a 14-day
 * trial". Write `{{billing.web.monthly}}` and the number comes from the app's
 * own source at build time; change the price in the app and the sentence
 * changes with it.
 *
 * An unknown token throws. The alternative — leaving it as literal
 * "{{billing.trial-days}}" on a live page, or silently emitting nothing — is
 * how a docs site ends up publishing a blank where a fact should be.
 *
 * Only `text` nodes are touched, so a token inside a code span or fence stays
 * literal and this file can document its own syntax.
 */

import { value } from "./manifest";

const TOKEN = /\{\{\s*([\w.-]+)\s*\}\}/g;

interface Node {
  type: string;
  value?: string;
  children?: Node[];
}

interface VFile {
  path?: string;
}

export function remarkManifestTokens() {
  return function transformer(tree: Node, file: VFile) {
    const where = file.path ?? "a help article";

    const walk = (node: Node) => {
      if (node.type === "text" && typeof node.value === "string" && node.value.includes("{{")) {
        node.value = node.value.replace(TOKEN, (_match, token: string) => {
          try {
            return String(value(token));
          } catch (err) {
            throw new Error(`${where}: ${(err as Error).message}`);
          }
        });
      }
      node.children?.forEach(walk);
    };

    walk(tree);
  };
}

export default remarkManifestTokens;
