import { readFileSync, writeFileSync } from "node:fs";

const rewrites = [
  {
    filePath: "C:/Users/inouy/AppData/Roaming/Code/User/globalStorage/github.copilot-chat/ask-agent/Ask.agent.md",
    toolsPattern: /tools:\s*\[[\s\S]*?\]\s*\n\s*agents:/u,
    toolsReplacement: "tools: ['search', 'read', 'web', 'vscode/memory', 'execute/getTerminalOutput', 'execute/testFailure', 'vscode.mermaid-chat-features/renderMermaidDiagram', 'vscode/askQuestions']\nagents:",
  },
  {
    filePath: "C:/Users/inouy/AppData/Roaming/Code/User/globalStorage/github.copilot-chat/explore-agent/Explore.agent.md",
    toolsPattern: /tools:\s*\[[\s\S]*?\]\s*\n\s*agents:/u,
    toolsReplacement: "tools: ['search', 'read', 'web', 'vscode/memory', 'execute/getTerminalOutput', 'execute/testFailure']\nagents:",
  },
  {
    filePath: "C:/Users/inouy/AppData/Roaming/Code/User/globalStorage/github.copilot-chat/plan-agent/Plan.agent.md",
    toolsPattern: /tools:\s*\[[\s\S]*?\]\s*\n\s*agents:/u,
    toolsReplacement: "tools: ['search', 'read', 'web', 'vscode/memory', 'execute/getTerminalOutput', 'execute/testFailure', 'agent', 'vscode/askQuestions']\nagents:",
  },
  {
    filePath: "C:/Users/inouy/.vscode/extensions/vscjava.migrate-java-to-azure-1.14.1-win32-x64/agents/modernize-azure-java.agent.md",
    toolsPattern: /tools:\s*\[[\s\S]*?\]\s*\n\s*model:/u,
    toolsReplacement: "tools: ['edit', 'search', 'read', 'search/usages', 'read/problems', 'search/changes', 'execute/runInTerminal', 'execute/getTerminalOutput', 'execute/testFailure', 'web/fetch', 'web/githubRepo', 'todo', 'agent', 'vscjava.migrate-java-to-azure/appmod-completeness-validation', 'vscjava.migrate-java-to-azure/appmod-consistency-validation', 'vscjava.migrate-java-to-azure/appmod-create-migration-summary', 'vscjava.migrate-java-to-azure/appmod-fetch-knowledgebase', 'vscjava.migrate-java-to-azure/appmod-get-vscode-config', 'vscjava.migrate-java-to-azure/appmod-preview-markdown', 'vscjava.migrate-java-to-azure/appmod-run-task', 'vscjava.migrate-java-to-azure/appmod-search-file', 'vscjava.migrate-java-to-azure/appmod-search-knowledgebase', 'vscjava.migrate-java-to-azure/appmod-version-control', 'vscjava.migrate-java-to-azure/appmod-list-jdks', 'vscjava.migrate-java-to-azure/appmod-list-mavens', 'vscjava.migrate-java-to-azure/appmod-install-jdk', 'vscjava.migrate-java-to-azure/appmod-install-maven']\n\nmodel:",
  },
  {
    filePath: "C:/Users/inouy/.vscode/extensions/vscjava.migrate-java-to-azure-1.14.1-win32-x64/agents/modernize-azure-dotnet.agent.md",
    toolsPattern: /tools:\s*\[[\s\S]*?\]\s*\n\s*model:/u,
    toolsReplacement: "tools: ['edit', 'search', 'read', 'search/usages', 'read/problems', 'search/changes', 'execute/runInTerminal', 'execute/getTerminalOutput', 'execute/testFailure', 'web/fetch', 'web/githubRepo', 'todo', 'vscjava.migrate-java-to-azure/appmod-completeness-validation', 'vscjava.migrate-java-to-azure/appmod-consistency-validation', 'vscjava.migrate-java-to-azure/appmod-create-migration-summary', 'vscjava.migrate-java-to-azure/appmod-fetch-knowledgebase', 'vscjava.migrate-java-to-azure/appmod-get-vscode-config', 'vscjava.migrate-java-to-azure/appmod-preview-markdown', 'vscjava.migrate-java-to-azure/appmod-run-task', 'vscjava.migrate-java-to-azure/appmod-search-file', 'vscjava.migrate-java-to-azure/appmod-search-knowledgebase', 'vscjava.migrate-java-to-azure/appmod-version-control', 'vscjava.migrate-java-to-azure/appmod-dotnet-build-project', 'vscjava.migrate-java-to-azure/appmod-dotnet-cve-check', 'vscjava.migrate-java-to-azure/appmod-dotnet-run-test']\n\nmodel:",
  },
  {
    filePath: "C:/Users/inouy/.vscode/extensions/vscjava.migrate-java-to-azure-1.14.1-win32-x64/agents/modernize-java-assessment.agent.md",
    toolsPattern: /tools:\s*\[[\s\S]*?\]\s*\nmodel:/u,
    toolsReplacement: "tools: ['agent', 'search', 'edit', 'web/fetch', 'todo', 'vscjava.migrate-java-to-azure/appmod-run-assessment-action', 'vscjava.migrate-java-to-azure/appmod-cwe-rules-assessment', 'vscjava.migrate-java-to-azure/appmod-run-assessment-report', 'vscjava.migrate-java-to-azure/uploadAssessSummaryReport', 'vscjava.migrate-java-to-azure/migration_assessmentReport', 'vscjava.migrate-java-to-azure/migration_assessmentReportsList']\nmodel:",
  },
  {
    filePath: "C:/Users/inouy/.vscode/extensions/vscjava.migrate-java-to-azure-1.14.1-win32-x64/agents/modernize-java-upgrade.agent.md",
    toolsPattern: /tools:\s*\[[\s\S]*?\]\s*\nhandoffs:/u,
    toolsReplacement: "tools: ['edit', 'search', 'read', 'read/problems', 'search/changes', 'web/fetch', 'todo', 'vscode/askQuestions', 'execute/runInTerminal', 'execute/getTerminalOutput', 'execute/testFailure', 'vscjava.migrate-java-to-azure/appmod-report-event', 'vscjava.migrate-java-to-azure/appmod-list-jdks', 'vscjava.migrate-java-to-azure/appmod-list-mavens', 'vscjava.migrate-java-to-azure/appmod-install-jdk', 'vscjava.migrate-java-to-azure/appmod-install-maven', 'vscjava.migrate-java-to-azure/appmod-preview-markdown']\nhandoffs:",
  },
  {
    filePath: "C:/Users/inouy/.vscode/extensions/vscjava.vscode-java-upgrade-2.1.0/agents/modernize-java.agent.md",
    toolsPattern: /tools:\s*[\s\S]*?\nargument-hint:/u,
    toolsReplacement: "tools: ['edit', 'search', 'read', 'read/problems', 'search/changes', 'web/fetch', 'todo', 'vscode/askQuestions', 'execute/runInTerminal', 'execute/getTerminalOutput', 'execute/testFailure', 'vscjava.vscode-java-upgrade/report_event', 'vscjava.vscode-java-upgrade/list_jdks', 'vscjava.vscode-java-upgrade/list_mavens', 'vscjava.vscode-java-upgrade/install_jdk', 'vscjava.vscode-java-upgrade/install_maven', 'vscjava.migrate-java-to-azure/appmod-preview-markdown']\nargument-hint:",
  },
];

for (const rewrite of rewrites) {
  const content = readFileSync(rewrite.filePath, "utf8");
  if (!rewrite.toolsPattern.test(content)) {
    throw new Error(`Expected tools pattern not found in ${rewrite.filePath}`);
  }

  let updated = content.replace(rewrite.toolsPattern, rewrite.toolsReplacement);
  if (rewrite.filePath.endsWith("modernize-java.agent.md")) {
    updated = updated
      .replace("using tool `#validate_cves_for_java`", "using the available terminal and test failure tools")
      .replace("using tool `#generate_tests_for_java`.", "using the available terminal and test failure tools.");
  }

  if (rewrite.filePath.endsWith("modernize-java-upgrade.agent.md")) {
    updated = updated
      .replace("using tool `#vscjava.migrate-java-to-azure/appmod-validate-cves-for-java`", "using the available terminal and test failure tools")
      .replace("using tool `#vscjava.migrate-java-to-azure/appmod-generate-tests-for-java`.", "using the available terminal and test failure tools.");
  }

  writeFileSync(rewrite.filePath, updated, "utf8");
  console.log(`updated ${rewrite.filePath}`);
}