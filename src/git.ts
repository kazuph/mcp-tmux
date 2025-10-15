import { execFile as execFileCallback } from "child_process";
import { promisify } from "util";
import { isAbsolute, normalize, resolve } from "path";

const execFile = promisify(execFileCallback);

export interface WorktreeInfo {
  path: string;
  head?: string;
  branch?: string;
  bare?: boolean;
  detached?: boolean;
  locked?: string;
  prunable?: string;
}

export interface EnsureWorktreeOptions {
  repoPath: string;
  branchName: string;
  worktreePath?: string;
  baseRef?: string;
  createBranch?: boolean;
  force?: boolean;
}

export interface EnsureWorktreeResult {
  repoPath: string;
  worktreePath: string;
  branch: string;
  created: boolean;
  existingWorktree?: WorktreeInfo;
}

export interface RemoveWorktreeOptions {
  repoPath: string;
  worktreePath: string;
  force?: boolean;
}

async function runGit(repoPath: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFile("git", ["-C", repoPath, ...args]);
    return { stdout: stdout.toString(), stderr: stderr.toString() };
  } catch (error: any) {
    const stderr = typeof error?.stderr === "string" ? error.stderr : error?.stderr?.toString?.() ?? "";
    const message = stderr.trim() || error?.message || `git ${args.join(" ")}`;
    throw new Error(`git ${args.join(" ")} failed: ${message}`);
  }
}

async function resolveRepoPath(repoPath: string): Promise<string> {
  const normalized = normalize(repoPath);
  const { stdout } = await runGit(normalized, ["rev-parse", "--show-toplevel"]);
  return normalize(stdout.trim());
}

function parseWorktreeBranch(value: string): string {
  const trimmed = value.trim();
  const prefix = "refs/heads/";
  if (trimmed.startsWith(prefix)) {
    return trimmed.slice(prefix.length);
  }
  return trimmed;
}

export async function listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
  const root = await resolveRepoPath(repoPath);
  const { stdout } = await runGit(root, ["worktree", "list", "--porcelain"]);

  const lines = stdout.split(/\r?\n/);
  const worktrees: WorktreeInfo[] = [];
  let current: WorktreeInfo | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (current) {
        worktrees.push(current);
        current = null;
      }
      continue;
    }

    if (line.startsWith("worktree ")) {
      if (current) {
        worktrees.push(current);
      }

      const path = line.slice("worktree ".length).trim();
      const absolutePath = isAbsolute(path) ? path : resolve(root, path);
      current = { path: normalize(absolutePath) };
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith("HEAD ")) {
      current.head = line.slice("HEAD ".length).trim();
      continue;
    }

    if (line.startsWith("branch ")) {
      current.branch = parseWorktreeBranch(line.slice("branch ".length));
      continue;
    }

    if (line === "bare") {
      current.bare = true;
      continue;
    }

    if (line === "detached") {
      current.detached = true;
      continue;
    }

    if (line.startsWith("locked")) {
      const reason = line.slice("locked".length).trim();
      current.locked = reason.replace(/^\(|\)$/g, '') || "locked";
      continue;
    }

    if (line.startsWith("prunable")) {
      const reason = line.slice("prunable".length).trim();
      current.prunable = reason.replace(/^\(|\)$/g, '') || "prunable";
    }
  }

  if (current) {
    worktrees.push(current);
  }

  return worktrees.map(entry => ({
    ...entry,
    path: normalize(entry.path)
  }));
}

export async function ensureWorktree(options: EnsureWorktreeOptions): Promise<EnsureWorktreeResult> {
  const { repoPath, branchName, worktreePath, baseRef, createBranch, force } = options;

  if (!branchName.trim()) {
    throw new Error("branchName is required");
  }

  if (!createBranch && baseRef) {
    throw new Error("baseRef can only be used when createBranch is true");
  }

  const repoRoot = await resolveRepoPath(repoPath);
  const candidatePath = worktreePath
    ? (isAbsolute(worktreePath) ? normalize(worktreePath) : normalize(resolve(repoRoot, worktreePath)))
    : normalize(resolve(repoRoot, "..", branchName));

  const worktrees = await listWorktrees(repoRoot);
  const existingByPath = worktrees.find(entry => normalize(entry.path) === candidatePath);

  if (existingByPath) {
    return {
      repoPath: repoRoot,
      worktreePath: candidatePath,
      branch: existingByPath.branch ?? branchName,
      created: false,
      existingWorktree: existingByPath
    };
  }

  const branchInUse = worktrees.find(entry => entry.branch === branchName);
  if (branchInUse && normalize(branchInUse.path) !== candidatePath && !force) {
    throw new Error(`Branch ${branchName} is already checked out at ${branchInUse.path}. ` +
      "Use force=true to reuse the branch or choose a different branch name.");
  }

  const args: string[] = ["worktree", "add"];

  if (force) {
    args.push("--force");
  }

  if (createBranch) {
    args.push("-b", branchName);
  }

  args.push(candidatePath);

  if (createBranch && baseRef) {
    args.push(baseRef);
  } else if (!createBranch) {
    args.push(branchName);
  }

  await runGit(repoRoot, args);

  return {
    repoPath: repoRoot,
    worktreePath: candidatePath,
    branch: branchName,
    created: true
  };
}

export async function removeWorktree(options: RemoveWorktreeOptions): Promise<void> {
  const { repoPath, worktreePath, force } = options;
  const repoRoot = await resolveRepoPath(repoPath);
  const targetPath = isAbsolute(worktreePath)
    ? normalize(worktreePath)
    : normalize(resolve(repoRoot, worktreePath));

  const args: string[] = ["worktree", "remove"];

  if (force) {
    args.push("--force");
  }

  args.push(targetPath);

  await runGit(repoRoot, args);
}
