/**
 * Sandbox Runtime: Ephemeral Container Execution Manager
 * 
 * Manages the lifecycle of Docker-based sandboxed agent execution:
 *   build → configure → run → collect output → destroy
 * 
 * Security Constraints (enforced at container level):
 *   --network none    : No internet access
 *   --read-only       : Immutable root filesystem
 *   --memory 256m     : Memory cap
 *   --cpus 0.5        : CPU cap
 *   --user agent      : Non-root execution
 *   timeout 30        : Hard kill after 30 seconds
 * 
 * Compliance: ISO 42001 - Agent Containment, constitution.md Art. I
 */

import { execSync, ExecSyncOptionsWithStringEncoding } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ─── Types ───

export interface SandboxConfig {
    /** Maximum execution time in seconds */
    timeoutSeconds: number;
    /** Memory limit (Docker format, e.g. '256m') */
    memoryLimit: string;
    /** CPU limit (e.g. '0.5' for half a core) */
    cpuLimit: string;
    /** Allow network access (default: false — DANGEROUS) */
    networkEnabled: boolean;
    /** Mount workspace as read-only (default: true) */
    readOnlyMount: boolean;
    /** Additional environment variables passed to the container */
    env: Record<string, string>;
}

export interface SandboxResult {
    /** Unique execution ID for forensic correlation */
    executionId: string;
    /** Exit code from the container (0 = success) */
    exitCode: number;
    /** Captured stdout */
    stdout: string;
    /** Captured stderr */
    stderr: string;
    /** Wall-clock duration in milliseconds */
    durationMs: number;
    /** Whether the container was killed due to timeout */
    timedOut: boolean;
}

const DEFAULT_CONFIG: SandboxConfig = {
    timeoutSeconds: 30,
    memoryLimit: '256m',
    cpuLimit: '0.5',
    networkEnabled: false,
    readOnlyMount: true,
    env: {},
};

const SANDBOX_IMAGE = 'agent-sandbox';

// ─── Sandbox Runtime ───

export class SandboxRuntime {
    private config: SandboxConfig;
    private imageBuilt: boolean = false;
    private dockerfilePath: string;

    constructor(projectRoot: string, config?: Partial<SandboxConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.dockerfilePath = path.join(projectRoot, 'docker', 'agent_sandbox');

        console.log('🐳 Sandbox Runtime initialized.');
        console.log(`   Memory: ${this.config.memoryLimit} | CPU: ${this.config.cpuLimit} | Timeout: ${this.config.timeoutSeconds}s`);
        console.log(`   Network: ${this.config.networkEnabled ? '⚠️ ENABLED' : '🔒 DISABLED'}`);
    }

    /**
     * Ensures the sandbox Docker image is built.
     * Idempotent — skips if already built this session.
     */
    public ensureImage(): void {
        if (this.imageBuilt) return;

        if (!this.isDockerAvailable()) {
            console.warn('⚠️ Docker not available. Sandbox will operate in DRY-RUN mode.');
            return;
        }

        console.log('🔨 Building sandbox image...');
        try {
            execSync(`docker build -t ${SANDBOX_IMAGE} .`, {
                cwd: this.dockerfilePath,
                encoding: 'utf-8',
                stdio: 'pipe',
            });
            this.imageBuilt = true;
            console.log('✅ Sandbox image built.');
        } catch (error) {
            console.error('❌ Failed to build sandbox image:', (error as Error).message);
            throw new Error('Sandbox image build failed. Cannot proceed without containment.');
        }
    }

    /**
     * Executes a task script inside the ephemeral sandbox container.
     * 
     * @param taskScript - JavaScript/TypeScript code to execute
     * @param workspacePath - Host path to mount as /workspace (read-only)
     * @returns SandboxResult with output and metadata
     */
    public execute(taskScript: string, workspacePath: string): SandboxResult {
        const executionId = crypto.randomUUID();
        const startTime = Date.now();

        // If Docker is not available, use dry-run mode
        if (!this.isDockerAvailable()) {
            return this.dryRun(executionId, taskScript, startTime);
        }

        this.ensureImage();

        // Write task script to a temporary file
        const tmpDir = path.join(workspacePath, '.sandbox-tmp');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }
        const taskFile = path.join(tmpDir, `task-${executionId.slice(0, 8)}.js`);
        fs.writeFileSync(taskFile, taskScript, 'utf-8');

        try {
            const dockerArgs = this.buildDockerArgs(executionId, workspacePath, taskFile);
            const cmd = `docker run ${dockerArgs.join(' ')}`;

            const opts: ExecSyncOptionsWithStringEncoding = {
                encoding: 'utf-8',
                timeout: (this.config.timeoutSeconds + 5) * 1000, // Buffer for container overhead
                stdio: 'pipe',
                maxBuffer: 1024 * 1024, // 1MB output cap
            };

            const stdout = execSync(cmd, opts);
            const durationMs = Date.now() - startTime;

            return {
                executionId,
                exitCode: 0,
                stdout: stdout.toString().trim(),
                stderr: '',
                durationMs,
                timedOut: false,
            };
        } catch (error: any) {
            const durationMs = Date.now() - startTime;
            const timedOut = durationMs >= this.config.timeoutSeconds * 1000;

            return {
                executionId,
                exitCode: error.status ?? 1,
                stdout: (error.stdout ?? '').toString().trim(),
                stderr: (error.stderr ?? '').toString().trim(),
                durationMs,
                timedOut,
            };
        } finally {
            // Cleanup temp file
            this.cleanupTempFile(taskFile);
            this.cleanupTempDir(tmpDir);
        }
    }

    // ─── Private Helpers ───

    private buildDockerArgs(executionId: string, workspacePath: string, taskFile: string): string[] {
        const args: string[] = [
            '--rm', // Auto-remove container
            `--name sandbox-${executionId.slice(0, 8)}`,
            `--memory=${this.config.memoryLimit}`,
            `--cpus=${this.config.cpuLimit}`,
        ];

        // Network isolation
        if (!this.config.networkEnabled) {
            args.push('--network none');
        }

        // Read-only root filesystem
        if (this.config.readOnlyMount) {
            args.push('--read-only');
            // tmpfs for /tmp so node can still write temp files
            args.push('--tmpfs /tmp:rw,noexec,nosuid,size=64m');
        }

        // Mount workspace as read-only
        const normalizedWorkspace = workspacePath.replace(/\\/g, '/');
        args.push(`-v "${normalizedWorkspace}:/workspace:ro"`);

        // Mount the task file specifically
        const normalizedTask = taskFile.replace(/\\/g, '/');
        args.push(`-v "${normalizedTask}:/task/task.js:ro"`);

        // Environment variables
        for (const [key, value] of Object.entries(this.config.env)) {
            args.push(`-e ${key}="${value}"`);
        }

        // Security options
        args.push('--security-opt no-new-privileges');
        args.push('--pids-limit 64'); // Prevent fork bombs

        // Image and command
        args.push(SANDBOX_IMAGE);
        args.push(`timeout ${this.config.timeoutSeconds} node /task/task.js`);

        return args;
    }

    private dryRun(executionId: string, taskScript: string, startTime: number): SandboxResult {
        console.warn(`🏜️ DRY-RUN [${executionId.slice(0, 8)}]: Docker unavailable. Simulating execution.`);
        console.warn('   Script preview:', taskScript.slice(0, 100) + (taskScript.length > 100 ? '...' : ''));
        return {
            executionId,
            exitCode: 0,
            stdout: '[DRY-RUN] Sandbox execution simulated. Docker not available.',
            stderr: '',
            durationMs: Date.now() - startTime,
            timedOut: false,
        };
    }

    private isDockerAvailable(): boolean {
        try {
            execSync('docker info', { encoding: 'utf-8', stdio: 'pipe' });
            return true;
        } catch {
            return false;
        }
    }

    private cleanupTempFile(filePath: string): void {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch { /* best-effort cleanup */ }
    }

    private cleanupTempDir(dirPath: string): void {
        try {
            if (fs.existsSync(dirPath)) {
                const files = fs.readdirSync(dirPath);
                if (files.length === 0) {
                    fs.rmdirSync(dirPath);
                }
            }
        } catch { /* best-effort cleanup */ }
    }
}
