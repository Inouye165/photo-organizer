import test from "node:test";
import assert from "node:assert/strict";

import {
  validateAgentContent,
  validateMonitoredAgentFiles,
} from "./validate-agent-tools.mjs";

test("validator flags deprecated and unsupported tool names in agent frontmatter", () => {
  const content = `---
name: sample
tools:
  - runCommands
  - read_file
  - vscjava.migrate-java-to-azure/appmod-build-java-project
  - github/issue_read
---
body`;

  const issues = validateAgentContent(content, "sample.agent.md");
  assert.deepEqual(
    issues.map((issue) => issue.tool),
    ["runCommands", "read_file", "vscjava.migrate-java-to-azure/appmod-build-java-project", "github/issue_read"],
  );
});

test("monitored agent files validate clean on this machine", () => {
  const issues = validateMonitoredAgentFiles();
  assert.equal(
    issues.length,
    0,
    issues.map((issue) => `${issue.filePath}: ${issue.tool} -> ${issue.replacement}`).join("\n"),
  );
});