#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as tmux from "./tmux.js";
import * as git from "./git.js";

const defaultAgentCommands = {
  codex: "codex",
  claudecode: "claudecode",
  gemini: "gemini"
} as const;

type AgentKey = keyof typeof defaultAgentCommands;

function validateEnvKey(key: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    throw new Error(`Invalid environment variable name: ${key}`);
  }
}

function buildExportCommand(key: string, value: string): string {
  validateEnvKey(key);
  const escaped = value.replace(/(["\\])/g, "\\$1");
  return `export ${key}="${escaped}"`;
}

function buildCdCommand(path: string): string {
  const escaped = path.replace(/(["\\])/g, "\\$1");
  return `cd "${escaped}"`;
}

// Create MCP server
const server = new McpServer({
  name: "tmux-mcp",
  version: "0.2.2"
}, {
  capabilities: {
    resources: {
      subscribe: true,
      listChanged: true
    },
    tools: {
      listChanged: true
    },
    logging: {}
  }
});

// List all tmux sessions - Tool
server.tool(
  "list-sessions",
  "List all active tmux sessions",
  {},
  async () => {
    try {
      const sessions = await tmux.listSessions();
      return {
        content: [{
          type: "text",
          text: JSON.stringify(sessions, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error listing tmux sessions: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Find session by name - Tool
server.tool(
  "find-session",
  "Find a tmux session by name",
  {
    name: z.string().describe("Name of the tmux session to find")
  },
  async ({ name }) => {
    try {
      const session = await tmux.findSessionByName(name);
      return {
        content: [{
          type: "text",
          text: session ? JSON.stringify(session, null, 2) : `Session not found: ${name}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error finding tmux session: ${error}`
        }],
        isError: true
      };
    }
  }
);

// List windows in a session - Tool
server.tool(
  "list-windows",
  "List windows in a tmux session",
  {
    sessionId: z.string().describe("ID of the tmux session")
  },
  async ({ sessionId }) => {
    try {
      const windows = await tmux.listWindows(sessionId);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(windows, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error listing windows: ${error}`
        }],
        isError: true
      };
    }
  }
);

// List panes in a window - Tool
server.tool(
  "list-panes",
  "List panes in a tmux window",
  {
    windowId: z.string().describe("ID of the tmux window")
  },
  async ({ windowId }) => {
    try {
      const panes = await tmux.listPanes(windowId);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(panes, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error listing panes: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Capture pane content - Tool
server.tool(
  "capture-pane",
  "Capture content from a tmux pane with configurable lines count and optional color preservation",
  {
    paneId: z.string().describe("ID of the tmux pane"),
    lines: z.string().optional().describe("Number of lines to capture"),
    colors: z.boolean().optional().describe("Include color/escape sequences for text and background attributes in output")
  },
  async ({ paneId, lines, colors }) => {
    try {
      // Parse lines parameter if provided
      const linesCount = lines ? parseInt(lines, 10) : undefined;
      const includeColors = colors || false;
      const content = await tmux.capturePaneContent(paneId, linesCount, includeColors);
      return {
        content: [{
          type: "text",
          text: content || "No content captured"
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error capturing pane content: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Create new session - Tool
server.tool(
  "create-session",
  "Create a new tmux session",
  {
    name: z.string().describe("Name for the new tmux session")
  },
  async ({ name }) => {
    try {
      const session = await tmux.createSession(name);
      return {
        content: [{
          type: "text",
          text: session
            ? `Session created: ${JSON.stringify(session, null, 2)}`
            : `Failed to create session: ${name}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error creating session: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Create new window - Tool
server.tool(
  "create-window",
  "Create a new window in a tmux session",
  {
    sessionId: z.string().describe("ID of the tmux session"),
    name: z.string().describe("Name for the new window")
  },
  async ({ sessionId, name }) => {
    try {
      const window = await tmux.createWindow(sessionId, name);
      return {
        content: [{
          type: "text",
          text: window
            ? `Window created: ${JSON.stringify(window, null, 2)}`
            : `Failed to create window: ${name}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error creating window: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Kill session - Tool
server.tool(
  "kill-session",
  "Kill a tmux session by ID",
  {
    sessionId: z.string().describe("ID of the tmux session to kill")
  },
  async ({ sessionId }) => {
    try {
      await tmux.killSession(sessionId);
      return {
        content: [{
          type: "text",
          text: `Session ${sessionId} has been killed`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error killing session: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Kill window - Tool
server.tool(
  "kill-window",
  "Kill a tmux window by ID",
  {
    windowId: z.string().describe("ID of the tmux window to kill")
  },
  async ({ windowId }) => {
    try {
      await tmux.killWindow(windowId);
      return {
        content: [{
          type: "text",
          text: `Window ${windowId} has been killed`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error killing window: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Kill pane - Tool
server.tool(
  "kill-pane",
  "Kill a tmux pane by ID",
  {
    paneId: z.string().describe("ID of the tmux pane to kill")
  },
  async ({ paneId }) => {
    try {
      await tmux.killPane(paneId);
      return {
        content: [{
          type: "text",
          text: `Pane ${paneId} has been killed`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error killing pane: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Split pane - Tool
server.tool(
  "split-pane",
  "Split a tmux pane horizontally or vertically",
  {
    paneId: z.string().describe("ID of the tmux pane to split"),
    direction: z.enum(["horizontal", "vertical"]).optional().describe("Split direction: 'horizontal' (side by side) or 'vertical' (top/bottom). Default is 'vertical'"),
    size: z.number().min(1).max(99).optional().describe("Size of the new pane as percentage (1-99). Default is 50%")
  },
  async ({ paneId, direction, size }) => {
    try {
      const newPane = await tmux.splitPane(paneId, direction || 'vertical', size);
      return {
        content: [{
          type: "text",
          text: newPane
            ? `Pane split successfully. New pane: ${JSON.stringify(newPane, null, 2)}`
            : `Failed to split pane ${paneId}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error splitting pane: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Execute command in pane - Tool
server.tool(
  "execute-command",
  "Execute a command in a tmux pane and get results. For interactive applications (REPLs, editors), use `rawMode=true`. IMPORTANT: When `rawMode=false` (default), avoid heredoc syntax (cat << EOF) and other multi-line constructs as they conflict with command wrapping. For file writing, prefer: printf 'content\\n' > file, echo statements, or write to temp files instead",
  {
    paneId: z.string().describe("ID of the tmux pane"),
    command: z.string().describe("Command to execute"),
    rawMode: z.boolean().optional().describe("Execute command without wrapper markers for REPL/interactive compatibility. Disables get-command-result status tracking. Use capture-pane after execution to verify command outcome."),
    noEnter: z.boolean().optional().describe("Send keystrokes without pressing Enter. For TUI navigation in apps like btop, vim, less. Supports special keys (Up, Down, Escape, Tab, etc.) and strings (sent char-by-char for proper filtering). Automatically applies rawMode. Use capture-pane after to see results.")
  },
  async ({ paneId, command, rawMode, noEnter }) => {
    try {
      // If noEnter is true, automatically apply rawMode
      const effectiveRawMode = noEnter || rawMode;
      const commandId = await tmux.executeCommand(paneId, command, effectiveRawMode, noEnter);

      if (effectiveRawMode) {
        const modeText = noEnter ? "Keys sent without Enter" : "Interactive command started (rawMode)";
        return {
          content: [{
            type: "text",
            text: `${modeText}.\n\nStatus tracking is disabled.\nUse 'capture-pane' with paneId '${paneId}' to verify the command outcome.\n\nCommand ID: ${commandId}`
          }]
        };
      }

      // Create the resource URI for this command's results
      const resourceUri = `tmux://command/${commandId}/result`;

      return {
        content: [{
          type: "text",
          text: `Command execution started.\n\nTo get results, subscribe to and read resource: ${resourceUri}\n\nStatus will change from 'pending' to 'completed' or 'error' when finished.`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error executing command: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Get command result - Tool
server.tool(
  "get-command-result",
  "Get the result of an executed command",
  {
    commandId: z.string().describe("ID of the executed command")
  },
  async ({ commandId }) => {
    try {
      // Check and update command status
      const command = await tmux.checkCommandStatus(commandId);

      if (!command) {
        return {
          content: [{
            type: "text",
            text: `Command not found: ${commandId}`
          }],
          isError: true
        };
      }

      // Format the response based on command status
      let resultText;
      if (command.status === 'pending') {
        if (command.result) {
          resultText = `Status: ${command.status}\nCommand: ${command.command}\n\n--- Message ---\n${command.result}`;
        } else {
          resultText = `Command still executing...\nStarted: ${command.startTime.toISOString()}\nCommand: ${command.command}`;
        }
      } else {
        resultText = `Status: ${command.status}\nExit code: ${command.exitCode}\nCommand: ${command.command}\n\n--- Output ---\n${command.result}`;
      }

      return {
        content: [{
          type: "text",
          text: resultText
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error retrieving command result: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Launch agent in a new pane - Tool
server.tool(
  "launch-agent-pane",
`Split a tmux pane and launch an AI coding agent CLI (Codex/ClaudeCode/Gemini 等) を自動化します。
ステップ: 1) targetPaneId 未指定時は target からアクティブ pane を取得
2) 指定方向へ split し、新 pane をフォーカスおよびリネーム
3) worktree オプション指定時は git worktree を ensure し、作成済みを再利用
4) workingDirectory / environment / paneTitle を pane 内で先に整備
5) agentCommand または agent プリセットをそのまま実行し、必要なら initialMessage を投げ込む
完了後は capture-pane / list-panes などで進捗確認し、タスク完了時は kill-pane を呼び出してください。`,
  {
    targetPaneId: z.string().optional().describe("Existing pane ID to split. If omitted, the active pane is used."),
    target: z.string().optional().describe("tmux target (session[:window[.pane]]) used to resolve the active pane when targetPaneId is not provided."),
    direction: z.enum(["horizontal", "vertical"]).optional().describe("Split direction. Defaults to 'vertical' (top/bottom)."),
    size: z.number().min(1).max(99).optional().describe("Size of the new pane as a percentage (1-99)."),
    agent: z.enum(["codex", "claudecode", "gemini"]).optional().describe("Preset agent CLI to launch."),
    agentCommand: z.string().optional().describe("Explicit command to run in the new pane. Overrides the agent preset."),
    workingDirectory: z.string().optional().describe("Directory to cd into before launching the agent. Defaults to the worktree path when worktree options are provided."),
    paneTitle: z.string().optional().describe("Optional pane title to apply after creation."),
    focus: z.boolean().optional().describe("Focus the new pane after creation. Defaults to true."),
    environment: z.record(z.string()).optional().describe("Environment variables to export before launching the agent."),
    initialMessage: z.string().optional().describe("Optional instruction to send to the agent CLI after it starts (例: タスク説明)。"),
    initialMessageDelayMs: z.number().min(0).optional().describe("Delay in milliseconds before sending initialMessage. Defaults to 500."),
    worktree: z.object({
      repoPath: z.string().describe("Path inside the target git repository."),
      branchName: z.string().describe("Branch name to use for the worktree."),
      worktreePath: z.string().optional().describe("Directory for the worktree. Relative paths are resolved from the repo root."),
      baseRef: z.string().optional().describe("Starting point for a new branch (requires createBranch=true)."),
      createBranch: z.boolean().optional().describe("Create a new branch for the worktree. Defaults to false."),
      force: z.boolean().optional().describe("Force worktree creation even if the branch is checked out elsewhere.")
    }).optional().describe("Optional git worktree configuration.")
  },
  async (input) => {
    try {
      const direction = input.direction ?? 'vertical';
      const targetPane = input.targetPaneId ?? await tmux.getActivePaneId(input.target);
      const newPane = await tmux.splitPane(targetPane, direction, input.size);

      if (!newPane) {
        throw new Error(`Failed to create a new pane from target ${targetPane}`);
      }

      const newPaneId = newPane.id;
      const operations: string[] = [];
      const sizeSuffix = input.size ? `, size ${input.size}%` : "";
      operations.push(`Split pane ${targetPane} -> ${newPaneId} (${direction}${sizeSuffix})`);

      const shouldFocus = input.focus ?? true;
      if (shouldFocus) {
        await tmux.selectPane(newPaneId);
        operations.push("Focused new pane");
      }

      const inferredTitle = input.paneTitle ?? (input.agent ? `Agent | ${input.agent.toUpperCase()}` : undefined);
      if (inferredTitle) {
        await tmux.renamePane(newPaneId, inferredTitle);
        operations.push(`Set pane title to \"${inferredTitle}\"`);
      }

      let workingDirectory = input.workingDirectory;

      if (input.worktree) {
        const worktreeResult = await git.ensureWorktree({
          repoPath: input.worktree.repoPath,
          branchName: input.worktree.branchName,
          worktreePath: input.worktree.worktreePath,
          baseRef: input.worktree.baseRef,
          createBranch: input.worktree.createBranch,
          force: input.worktree.force
        });

        if (!workingDirectory) {
          workingDirectory = worktreeResult.worktreePath;
        }

        if (worktreeResult.created) {
          operations.push(`Created worktree at ${worktreeResult.worktreePath} (branch ${worktreeResult.branch})`);
        } else if (worktreeResult.existingWorktree) {
          const branchLabel = worktreeResult.existingWorktree.branch ?? worktreeResult.branch;
          operations.push(`Reused existing worktree at ${worktreeResult.worktreePath} (branch ${branchLabel})`);
        }
      }

      if (workingDirectory) {
        await tmux.sendKeysToPane(newPaneId, buildCdCommand(workingDirectory));
        operations.push(`Changed directory to ${workingDirectory}`);
      }

      if (input.environment) {
        for (const [key, value] of Object.entries(input.environment)) {
          const exportCommand = buildExportCommand(key, value);
          await tmux.sendKeysToPane(newPaneId, exportCommand);
          operations.push(`Exported ${key}`);
        }
      }

      const agentKey = input.agent as AgentKey | undefined;
      const presetCommand = agentKey ? defaultAgentCommands[agentKey] : undefined;
      const launchCommand = input.agentCommand ?? presetCommand;

      if (launchCommand) {
        await tmux.sendKeysToPane(newPaneId, launchCommand);
        operations.push(`Started command: ${launchCommand}`);
      } else {
        operations.push("No launch command supplied; pane left idle.");
      }

      if (input.initialMessage) {
        const delayMs = input.initialMessageDelayMs ?? 500;
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        await tmux.sendKeysToPane(newPaneId, input.initialMessage);
        operations.push("Posted initial message to agent CLI");
      }

      const messageLines = [
        `New pane ${newPaneId} ready.`,
        ...operations.map(item => `- ${item}`)
      ];

      return {
        content: [{
          type: "text",
          text: messageLines.join("\n")
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error launching agent pane: ${error}`
        }],
        isError: true
      };
    }
  }
);

// List git worktrees - Tool
server.tool(
  "list-worktrees",
  "List git worktrees for a repository path.",
  {
    repoPath: z.string().describe("Path inside the git repository.")
  },
  async ({ repoPath }) => {
    try {
      const worktrees = await git.listWorktrees(repoPath);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(worktrees, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error listing worktrees: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Create or reuse a git worktree - Tool
server.tool(
  "create-worktree",
  "Create (or reuse) a git worktree for the specified branch.",
  {
    repoPath: z.string().describe("Path inside the git repository."),
    branchName: z.string().describe("Branch name for the worktree."),
    worktreePath: z.string().optional().describe("Directory for the worktree. Relative paths resolve from the repo root."),
    baseRef: z.string().optional().describe("Starting point when creating a new branch (requires createBranch=true)."),
    createBranch: z.boolean().optional().describe("Create a new branch for the worktree. Defaults to false."),
    force: z.boolean().optional().describe("Force worktree creation even if the branch is checked out elsewhere.")
  },
  async ({ repoPath, branchName, worktreePath, baseRef, createBranch, force }) => {
    try {
      const result = await git.ensureWorktree({
        repoPath,
        branchName,
        worktreePath,
        baseRef,
        createBranch,
        force
      });

      const status = result.created
        ? `Created worktree at ${result.worktreePath}`
        : `Worktree already exists at ${result.worktreePath}`;

      const details = {
        repoPath: result.repoPath,
        worktreePath: result.worktreePath,
        branch: result.branch,
        created: result.created,
        existingWorktree: result.existingWorktree
      };

      return {
        content: [{
          type: "text",
          text: `${status}\n\n${JSON.stringify(details, null, 2)}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error creating worktree: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Remove git worktree - Tool
server.tool(
  "remove-worktree",
  "Remove a git worktree directory.",
  {
    repoPath: z.string().describe("Path inside the git repository."),
    worktreePath: z.string().describe("Worktree directory to remove."),
    force: z.boolean().optional().describe("Force removal (cleans even if worktree has changes).")
  },
  async ({ repoPath, worktreePath, force }) => {
    try {
      await git.removeWorktree({ repoPath, worktreePath, force });
      return {
        content: [{
          type: "text",
          text: `Removed worktree at ${worktreePath}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error removing worktree: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Expose tmux session list as a resource
server.resource(
  "Tmux Sessions",
  "tmux://sessions",
  async () => {
    try {
      const sessions = await tmux.listSessions();
      return {
        contents: [{
          uri: "tmux://sessions",
          text: JSON.stringify(sessions.map(session => ({
            id: session.id,
            name: session.name,
            attached: session.attached,
            windows: session.windows
          })), null, 2)
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: "tmux://sessions",
          text: `Error listing tmux sessions: ${error}`
        }]
      };
    }
  }
);

// Expose pane content as a resource
server.resource(
  "Tmux Pane Content",
  new ResourceTemplate("tmux://pane/{paneId}", {
    list: async () => {
      try {
        // Get all sessions
        const sessions = await tmux.listSessions();
        const paneResources = [];

        // For each session, get all windows
        for (const session of sessions) {
          const windows = await tmux.listWindows(session.id);

          // For each window, get all panes
          for (const window of windows) {
            const panes = await tmux.listPanes(window.id);

            // For each pane, create a resource with descriptive name
            for (const pane of panes) {
              paneResources.push({
                name: `Pane: ${session.name} - ${pane.id} - ${pane.title} ${pane.active ? "(active)" : ""}`,
                uri: `tmux://pane/${pane.id}`,
                description: `Content from pane ${pane.id} - ${pane.title} in session ${session.name}`
              });
            }
          }
        }

        return {
          resources: paneResources
        };
      } catch (error) {
        server.server.sendLoggingMessage({
          level: 'error',
          data: `Error listing panes: ${error}`
        });

        return { resources: [] };
      }
    }
  }),
  async (uri, { paneId }) => {
    try {
      // Ensure paneId is a string
      const paneIdStr = Array.isArray(paneId) ? paneId[0] : paneId;
      // Default to no colors for resources to maintain clean programmatic access
      const content = await tmux.capturePaneContent(paneIdStr, 200, false);
      return {
        contents: [{
          uri: uri.href,
          text: content || "No content captured"
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `Error capturing pane content: ${error}`
        }]
      };
    }
  }
);

// Create dynamic resource for command executions
server.resource(
  "Command Execution Result",
  new ResourceTemplate("tmux://command/{commandId}/result", {
    list: async () => {
      // Only list active commands that aren't too old
      tmux.cleanupOldCommands(10); // Clean commands older than 10 minutes

      const resources = [];
      for (const id of tmux.getActiveCommandIds()) {
        const command = tmux.getCommand(id);
        if (command) {
          resources.push({
            name: `Command: ${command.command.substring(0, 30)}${command.command.length > 30 ? '...' : ''}`,
            uri: `tmux://command/${id}/result`,
            description: `Execution status: ${command.status}`
          });
        }
      }

      return { resources };
    }
  }),
  async (uri, { commandId }) => {
    try {
      // Ensure commandId is a string
      const commandIdStr = Array.isArray(commandId) ? commandId[0] : commandId;

      // Check command status
      const command = await tmux.checkCommandStatus(commandIdStr);

      if (!command) {
        return {
          contents: [{
            uri: uri.href,
            text: `Command not found: ${commandIdStr}`
          }]
        };
      }

      // Format the response based on command status
      let resultText;
      if (command.status === 'pending') {
        // For rawMode commands, we set a result message while status remains 'pending'
        // since we can't track their actual completion
        if (command.result) {
          resultText = `Status: ${command.status}\nCommand: ${command.command}\n\n--- Message ---\n${command.result}`;
        } else {
          resultText = `Command still executing...\nStarted: ${command.startTime.toISOString()}\nCommand: ${command.command}`;
        }
      } else {
        resultText = `Status: ${command.status}\nExit code: ${command.exitCode}\nCommand: ${command.command}\n\n--- Output ---\n${command.result}`;
      }

      return {
        contents: [{
          uri: uri.href,
          text: resultText
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `Error retrieving command result: ${error}`
        }]
      };
    }
  }
);

function showHelp() {
  console.log(`
tmux-mcp v0.2.2
MCP Server for interfacing with tmux sessions

USAGE:
  tmux-mcp [OPTIONS]

OPTIONS:
  -s, --shell-type <TYPE>  Shell type to use for command execution
                           Options: bash, zsh, fish
                           Default: bash

  -h, --help              Show this help message and exit

DESCRIPTION:
  A Model Context Protocol server that enables AI assistants to interact
  with tmux sessions. Provides tools and resources for reading terminal
  content, executing commands, and managing tmux sessions/windows/panes.

EXAMPLES:
  tmux-mcp                      # Start with default bash shell
  tmux-mcp --shell-type=zsh     # Start with zsh shell type
  tmux-mcp -s fish              # Start with fish shell type

For more information, visit: https://github.com/nickgnd/tmux-mcp
`);
}

async function main() {
  try {
    const { values } = parseArgs({
      options: {
        'shell-type': { type: 'string', default: 'bash', short: 's' },
        'help': { type: 'boolean', short: 'h' }
      }
    });

    // Show help if requested
    if (values.help) {
      showHelp();
      process.exit(0);
    }

    // Set shell configuration
    tmux.setShellConfig({
      type: values['shell-type'] as string
    });

    // Start the MCP server
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
