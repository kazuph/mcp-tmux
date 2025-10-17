# Tmux MCP Server

Model Context Protocol server that enables Claude Desktop to interact with and view tmux session content. This integration allows AI assistants to read from, control, and observe your terminal sessions.

## Features

- List and search tmux sessions
- View and navigate tmux windows and panes
- Capture and expose terminal content from any pane
- Execute commands in tmux panes and retrieve results (use it at your own risk ⚠️)
- Create new tmux sessions and windows
- Split panes horizontally or vertically with customizable sizes
- Kill tmux sessions, windows, and panes

Check out this short video to get excited!

</br>

[![youtube video](http://i.ytimg.com/vi/3W0pqRF1RS0/hqdefault.jpg)](https://www.youtube.com/watch?v=3W0pqRF1RS0)

## Prerequisites

- Node.js
- tmux installed and running

## Usage

### Configure Claude Desktop

Add this MCP server to your Claude Desktop configuration:

```json
"mcpServers": {
  "tmux": {
    "command": "npx",
    "args": ["-y", "tmux-mcp"]
  }
}
```

### MCP server options

You can optionally specify the command line shell you are using, if unspecified it defaults to `bash`

```json
"mcpServers": {
  "tmux": {
    "command": "npx",
    "args": ["-y", "tmux-mcp", "--shell-type=fish"]
  }
}
```

The MCP server needs to know the shell only when executing commands, to properly read its exit status.

## Available Resources

- `tmux://sessions` — list all tmux sessions
- `tmux://pane/{paneId}` — view content of a specific tmux pane
- `tmux://command/{commandId}/result` — results from executed commands

## Available Tools and Parameters

### list-sessions
- 説明: 現在稼働中の tmux セッション一覧を返します
- パラメーター: なし

### find-session
- 説明: 名前で tmux セッションを検索します
- パラメーター
  - `name` (string) セッション名

### list-windows
- 説明: 指定セッション内のウィンドウを列挙します
- パラメーター
  - `sessionId` (string) セッションID

### list-panes
- 説明: 指定ウィンドウ内のペインを列挙します
- パラメーター
  - `windowId` (string) ウィンドウID

### capture-pane
- 説明: ペイン内容を取得します
- パラメーター
  - `paneId` (string) ペインID
  - `lines` (string, optional) 取得する行数
  - `colors` (boolean, optional) ANSIカラー保持の有無

### create-session
- 説明: 新しい tmux セッションを作成します
- パラメーター
  - `name` (string) セッション名

### create-window
- 説明: 指定セッションに新しいウィンドウを作成します
- パラメーター
  - `sessionId` (string) セッションID
  - `name` (string) ウィンドウ名

### split-pane
- 説明: 既存ペインを分割します
- パラメーター
  - `paneId` (string) 対象ペインID
  - `direction` (`horizontal`|`vertical`, optional) 分割方向、既定は `vertical`
  - `size` (number, optional) 新ペインの占有率 (1–99)

### kill-session / kill-window / kill-pane
- 説明: それぞれセッション、ウィンドウ、ペインを終了します
- パラメーター
  - `sessionId` / `windowId` / `paneId` (string)

### execute-command
- 説明: 指定ペインでコマンドを実行します
- パラメーター
  - `paneId` (string)
  - `command` (string)
  - `rawMode` (boolean, optional) マーカー無しで送るか
  - `noEnter` (boolean, optional) Enter を送信せずキー列として扱うか

### get-command-result
- 説明: `execute-command` の結果を取得します
- パラメーター
  - `commandId` (string)

### launch-agent-pane
- 説明: ペインを分割し AI コーディング CLI (Codex / Claude / Gemini など) を起動します。コンフリクト危険がない場合は worktree オプションを省略し、既存ディレクトリで作業してください。
- パラメーター
  - `targetPaneId` (string, optional) 分割対象のペインID。省略時は `target`
  - `target` (string, optional) tmux ターゲット (例: `session:window.pane`)
  - `direction` (`horizontal`|`vertical`, optional) 分割方向、既定は `vertical`
  - `size` (number, optional) 新ペインの占有率 (1–99)
  - `agent` (`codex`|`claude`|`gemini`, optional) プリセットCLI名
  - `agentCommand` (string, optional) 明示的に実行するコマンド
  - `workingDirectory` (string, optional) 事前に移動するディレクトリ
  - `paneTitle` (string, optional) 新ペインタイトル
  - `focus` (boolean, optional) 分割後にフォーカスするか。既定は true
  - `environment` (record, optional) `KEY: VALUE` 形式の環境変数
  - `initialMessage` (string, optional) CLI 起動後に送る初回メッセージ
  - Codexプリセット使用時は初回メッセージがある場合 `codex exec "<prompt>"` の形式で起動し、CLI 起動後に追加の自動送信は行いません
  - `initialMessageDelayMs` (number, optional) 初回メッセージ前の待機 (ms)
  - `worktree` (object, optional)
    - `repoPath` (string)
    - `branchName` (string)
    - `worktreePath` (string, optional)
    - `baseRef` (string, optional)
    - `createBranch` (boolean, optional)
    - `force` (boolean, optional)

### list-worktrees
- 説明: Git worktree 一覧を取得します
- パラメーター
  - `repoPath` (string)

### create-worktree
- 説明: 指定ブランチ向けに worktree を作成または再利用します
- パラメーター
  - `repoPath` (string)
  - `branchName` (string)
  - `worktreePath` (string, optional)
  - `baseRef` (string, optional)
  - `createBranch` (boolean, optional)
  - `force` (boolean, optional)

### remove-worktree
- 説明: worktree を削除します。`force=true` は未コミット変更を失う恐れがあるため、必ず人間に確認してください。
- パラメーター
  - `repoPath` (string)
  - `worktreePath` (string)
  - `force` (boolean, optional)
