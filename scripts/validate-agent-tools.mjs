import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const monitoredAgentFiles = [
  "C:/Users/inouy/.vscode/extensions/vscjava.migrate-java-to-azure-1.14.1-win32-x64/agents/modernize-azure-java.agent.md",
  "C:/Users/inouy/.vscode/extensions/vscjava.migrate-java-to-azure-1.14.1-win32-x64/agents/modernize-java-upgrade.agent.md",
  "C:/Users/inouy/.vscode/extensions/vscjava.migrate-java-to-azure-1.14.1-win32-x64/agents/modernize-azure-dotnet.agent.md",
  "C:/Users/inouy/.vscode/extensions/vscjava.migrate-java-to-azure-1.14.1-win32-x64/agents/modernize-java-assessment.agent.md",
  "C:/Users/inouy/.vscode/extensions/vscjava.vscode-java-upgrade-2.1.0/agents/modernize-java.agent.md",
  "C:/Users/inouy/AppData/Roaming/Code/User/globalStorage/github.copilot-chat/ask-agent/Ask.agent.md",
  "C:/Users/inouy/AppData/Roaming/Code/User/globalStorage/github.copilot-chat/explore-agent/Explore.agent.md",
  "C:/Users/inouy/AppData/Roaming/Code/User/globalStorage/github.copilot-chat/plan-agent/Plan.agent.md",
];

const deprecatedToolMap = new Map([
  ["runCommands", "execute/runInTerminal or execute/getTerminalOutput"],
  ["usages", "search/usages"],
  ["problems", "read/problems"],
  ["changes", "search/changes"],
  ["testFailure", "execute/testFailure"],
  ["fetch", "web/fetch"],
  ["githubRepo", "web/githubRepo"],
  ["todos", "todo"],
  ["runSubagent", "agent"],
  ["askQuestions", "vscode/askQuestions"],
  ["read_file", "read"],
  ["create_file", "edit"],
  ["insert_edit_into_file", "edit"],
  ["replace_string_in_file", "edit"],
  ["file_search", "search"],
  ["apply_patch", "edit"],
  ["grep_search", "search"],
  ["semantic_search", "search"],
  ["list_dir", "read"],
  ["run_in_terminal", "execute/runInTerminal"],
  ["get_terminal_output", "execute/getTerminalOutput"],
  ["get_errors", "read/problems"],
  ["show_content", "read"],
  ["open_file", "read"],
  ["appmod-build-java-project", "vscjava.migrate-java-to-azure/appmod-build-java-project"],
  ["appmod-run-tests-for-java", "vscjava.migrate-java-to-azure/appmod-run-tests-for-java"],
  ["appmod-validate-cves-for-java", "vscjava.migrate-java-to-azure/appmod-validate-cves-for-java"],
  ["appmod-completeness-validation", "vscjava.migrate-java-to-azure/appmod-completeness-validation"],
  ["appmod-consistency-validation", "vscjava.migrate-java-to-azure/appmod-consistency-validation"],
  ["appmod-create-migration-summary", "vscjava.migrate-java-to-azure/appmod-create-migration-summary"],
  ["appmod-fetch-knowledgebase", "vscjava.migrate-java-to-azure/appmod-fetch-knowledgebase"],
  ["appmod-get-vscode-config", "vscjava.migrate-java-to-azure/appmod-get-vscode-config"],
  ["appmod-preview-markdown", "vscjava.migrate-java-to-azure/appmod-preview-markdown"],
  ["appmod-run-task", "vscjava.migrate-java-to-azure/appmod-run-task"],
  ["appmod-search-file", "vscjava.migrate-java-to-azure/appmod-search-file"],
  ["appmod-search-knowledgebase", "vscjava.migrate-java-to-azure/appmod-search-knowledgebase"],
  ["appmod-version-control", "vscjava.migrate-java-to-azure/appmod-version-control"],
  ["appmod-list-jdks", "vscjava.migrate-java-to-azure/appmod-list-jdks"],
  ["appmod-list-mavens", "vscjava.migrate-java-to-azure/appmod-list-mavens"],
  ["appmod-install-jdk", "vscjava.migrate-java-to-azure/appmod-install-jdk"],
  ["appmod-install-maven", "vscjava.migrate-java-to-azure/appmod-install-maven"],
  ["appmod-dotnet-build-project", "vscjava.migrate-java-to-azure/appmod-dotnet-build-project"],
  ["appmod-dotnet-cve-check", "vscjava.migrate-java-to-azure/appmod-dotnet-cve-check"],
  ["appmod-dotnet-run-test", "vscjava.migrate-java-to-azure/appmod-dotnet-run-test"],
  ["appmod-run-assessment-action", "vscjava.migrate-java-to-azure/appmod-run-assessment-action"],
  ["appmod-cwe-rules-assessment", "vscjava.migrate-java-to-azure/appmod-cwe-rules-assessment"],
  ["appmod-run-assessment-report", "vscjava.migrate-java-to-azure/appmod-run-assessment-report"],
  ["uploadAssessSummaryReport", "vscjava.migrate-java-to-azure/uploadAssessSummaryReport"],
  ["migration_assessmentReport", "vscjava.migrate-java-to-azure/migration_assessmentReport"],
  ["migration_assessmentReportsList", "vscjava.migrate-java-to-azure/migration_assessmentReportsList"],
  ["appmod-mcp-server/appmod-report-event", "vscjava.migrate-java-to-azure/appmod-report-event"],
  ["appmod-mcp-server/appmod-confirm-upgrade-plan", "vscjava.migrate-java-to-azure/appmod-confirm-upgrade-plan"],
  ["appmod-mcp-server/appmod-list-jdks", "vscjava.migrate-java-to-azure/appmod-list-jdks"],
  ["appmod-mcp-server/appmod-list-mavens", "vscjava.migrate-java-to-azure/appmod-list-mavens"],
  ["appmod-mcp-server/appmod-install-jdk", "vscjava.migrate-java-to-azure/appmod-install-jdk"],
  ["appmod-mcp-server/appmod-install-maven", "vscjava.migrate-java-to-azure/appmod-install-maven"],
  ["appmod-mcp-server/appmod-build-java-project", "vscjava.migrate-java-to-azure/appmod-build-java-project"],
  ["appmod-mcp-server/appmod-run-tests-for-java", "vscjava.migrate-java-to-azure/appmod-run-tests-for-java"],
  ["appmod-mcp-server/appmod-validate-cves-for-java", "vscjava.migrate-java-to-azure/appmod-validate-cves-for-java"],
  ["appmod-mcp-server/appmod-generate-tests-for-java", "vscjava.migrate-java-to-azure/appmod-generate-tests-for-java"],
  ["appmod-confirm-upgrade-plan", "vscjava.migrate-java-to-azure/appmod-confirm-upgrade-plan"],
  ["appmod-generate-tests-for-java", "vscjava.migrate-java-to-azure/appmod-generate-tests-for-java"],
  ["vscjava.migrate-java-to-azure/appmod-build-java-project", "execute/runInTerminal"],
  ["vscjava.migrate-java-to-azure/appmod-run-tests-for-java", "execute/runInTerminal or execute/testFailure"],
  ["vscjava.migrate-java-to-azure/appmod-validate-cves-for-java", "execute/runInTerminal"],
  ["vscjava.migrate-java-to-azure/appmod-generate-tests-for-java", "execute/runInTerminal or agent"],
  ["appmod-mcp-server/report_event", "vscjava.vscode-java-upgrade/report_event"],
  ["appmod-mcp-server/list_jdks", "vscjava.vscode-java-upgrade/list_jdks"],
  ["appmod-mcp-server/list_mavens", "vscjava.vscode-java-upgrade/list_mavens"],
  ["appmod-mcp-server/install_jdk", "vscjava.vscode-java-upgrade/install_jdk"],
  ["appmod-mcp-server/install_maven", "vscjava.vscode-java-upgrade/install_maven"],
  ["appmod-mcp-server/build_java_project", "vscjava.vscode-java-upgrade/build_java_project"],
  ["appmod-mcp-server/run_tests_for_java", "vscjava.vscode-java-upgrade/run_tests_for_java"],
  ["appmod-mcp-server/validate_cves_for_java", "vscjava.vscode-java-upgrade/validate_cves_for_java"],
  ["appmod-mcp-server/generate_tests_for_java", "vscjava.vscode-java-upgrade/generate_tests_for_java"],
  ["report_event", "vscjava.vscode-java-upgrade/report_event"],
  ["list_jdks", "vscjava.vscode-java-upgrade/list_jdks"],
  ["list_mavens", "vscjava.vscode-java-upgrade/list_mavens"],
  ["install_jdk", "vscjava.vscode-java-upgrade/install_jdk"],
  ["install_maven", "vscjava.vscode-java-upgrade/install_maven"],
  ["build_java_project", "vscjava.vscode-java-upgrade/build_java_project"],
  ["run_tests_for_java", "vscjava.vscode-java-upgrade/run_tests_for_java"],
  ["validate_cves_for_java", "vscjava.vscode-java-upgrade/validate_cves_for_java"],
  ["generate_tests_for_java", "vscjava.vscode-java-upgrade/generate_tests_for_java"],
  ["vscjava.vscode-java-upgrade/build_java_project", "execute/runInTerminal"],
  ["vscjava.vscode-java-upgrade/run_tests_for_java", "execute/runInTerminal or execute/testFailure"],
  ["vscjava.vscode-java-upgrade/validate_cves_for_java", "execute/runInTerminal"],
  ["vscjava.vscode-java-upgrade/generate_tests_for_java", "execute/runInTerminal or agent"],
  ["github/issue_read", "remove unsupported GitHub issue tools or install the provider"],
  ["github.vscode-pull-request-github/issue_fetch", "remove unsupported GitHub PR tools or install the provider"],
  ["github.vscode-pull-request-github/activePullRequest", "remove unsupported GitHub PR tools or install the provider"],
]);

function normalizePath(filePath) {
  return path.normalize(filePath);
}

function readFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/u);
  return match?.[1] ?? "";
}

function extractTools(frontmatter) {
  const lines = frontmatter.split(/\r?\n/u);
  const startIndex = lines.findIndex((line) => /^tools:\s*/u.test(line));
  if (startIndex < 0) {
    return [];
  }

  const startLine = lines[startIndex];
  const inlineToolsMatch = startLine.match(/^tools:\s*\[(.*)\]\s*$/u);
  if (inlineToolsMatch) {
    const inlineTools = [...inlineToolsMatch[1].matchAll(/['"]([^'"\r\n]+)['"]/gu)].map((match) => match[1]);
    return [...new Set(inlineTools)];
  }

  const blockLines = [startLine];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\w[\w-]*:\s*/u.test(line)) {
      break;
    }
    blockLines.push(line);
  }

  const block = blockLines.join("\n");
  const quoted = [...block.matchAll(/['"]([^'"\r\n]+)['"]/gu)].map((match) => match[1]);
  const dashed = [...block.matchAll(/^\s*-\s+([^\s#]+)\s*$/gmu)].map((match) => match[1]);
  return [...new Set([...quoted, ...dashed])];
}

function validateAgentContent(content, filePath = "<content>") {
  const frontmatter = readFrontmatter(content);
  const tools = extractTools(frontmatter);
  return tools.flatMap((tool) => {
    const replacement = deprecatedToolMap.get(tool);
    if (!replacement) {
      return [];
    }

    return [{
      filePath,
      tool,
      replacement,
    }];
  });
}

function validateAgentFile(filePath) {
  const normalized = normalizePath(filePath);
  if (!existsSync(normalized)) {
    return [{
      filePath: normalized,
      tool: "<missing file>",
      replacement: "restore or reinstall the monitored agent file before validating it",
    }];
  }

  const content = readFileSync(normalized, "utf8");
  return validateAgentContent(content, normalized);
}

function formatIssues(issues) {
  return issues.map((issue) => `${issue.filePath}: '${issue.tool}' -> ${issue.replacement}`);
}

function validateMonitoredAgentFiles() {
  return monitoredAgentFiles.flatMap((filePath) => validateAgentFile(filePath));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1].replaceAll("\\", "/")}`) {
  const issues = validateMonitoredAgentFiles();
  if (issues.length > 0) {
    console.error("Deprecated or unsupported agent tools found:");
    for (const line of formatIssues(issues)) {
      console.error(`- ${line}`);
    }
    process.exitCode = 1;
  } else {
    console.log("All monitored agent files use the current tool names for this machine.");
  }
}

export {
  deprecatedToolMap,
  extractTools,
  formatIssues,
  monitoredAgentFiles,
  readFrontmatter,
  validateAgentContent,
  validateAgentFile,
  validateMonitoredAgentFiles,
};