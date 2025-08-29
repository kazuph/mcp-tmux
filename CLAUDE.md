# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server that enables interaction with tmux sessions. It provides tools and resources for reading terminal content, executing commands, and managing tmux sessions/windows/panes.

## Development Commands

```bash
# Install dependencies
npm install

# Build the TypeScript code
npm run build

# Development mode (watch for changes)
npm run dev

# Run the compiled server
npm start

# Quick run via npx (no installation needed)
npx -y tmux-mcp
```

## Architecture

### Core Components

1. **MCP Server (`src/index.ts`)**
   - Implements the MCP protocol using `@modelcontextprotocol/sdk`
   - Exposes tools for tmux operations (list sessions, execute commands, etc.)
   - Provides resources for dynamic content (pane content, command results)
   - Tracks command executions with UUIDs

2. **tmux Integration (`src/tmux.ts`)**
   - Wraps tmux CLI commands with TypeScript promises
   - Key functions:
     - `getSessions()`: Returns all tmux sessions
     - `getWindows(sessionName)`: Returns windows in a session
     - `getPanes(sessionName, windowIndex)`: Returns panes in a window
     - `capturePane(paneId, lines)`: Captures pane content
     - `executeCommand(paneId, command, shellType)`: Executes commands with tracking
   - Implements command tracking using shell-specific markers (bash/zsh/fish)

### Key Design Patterns

- **Command Execution Tracking**: Commands are wrapped with unique markers to track their start/end and capture exit codes
- **Resource URIs**: Uses `tmux://` protocol for resource identification
- **Async Operations**: All tmux interactions are promise-based
- **Shell Compatibility**: Supports bash, zsh, and fish shells with appropriate command markers

## Important Implementation Details

### Command Execution Flow

1. Command is wrapped with unique markers (UUID-based)
2. Sent to tmux pane via `send-keys`
3. Result retrieval captures content between markers
4. Exit code is extracted based on shell type

### Resource Subscription

The server supports subscribing to:
- Pane content changes (`tmux://pane/{paneId}`)
- Command execution results (`tmux://command/{commandId}/result`)

### Security Considerations

- Commands are executed directly without sanitization
- The server has full access to all tmux sessions
- Users should be aware of the security implications

## Configuration

The server accepts a `--shell-type` argument (defaults to `bash`):
- `bash`
- `zsh`
- `fish`

This affects how command exit codes are captured.