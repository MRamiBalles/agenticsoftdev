/**
 * Input Sanitizer: Anti-Prompt Injection Defense
 * 
 * Validates and sanitizes external inputs before they reach LLM agents.
 * 
 * Threats Mitigated:
 * - Direct Prompt Injection (malicious user input)
 * - Indirect Prompt Injection (hidden instructions in data)
 * - Command Injection (shell escape attempts)
 * 
 * Compliance: ISO 42001 - AI Input Validation
 */

// Dangerous patterns that indicate injection attempts
const INJECTION_PATTERNS: RegExp[] = [
    // Direct instruction override attempts
    /ignore\s+(previous|all|above)\s+instructions?/i,
    /disregard\s+(the\s+)?(system|user)\s+prompt/i,
    /you\s+are\s+now\s+/i,
    /act\s+as\s+(if|though)/i,
    /forget\s+(everything|all)/i,

    // Role hijacking
    /\[SYSTEM\]/i,
    /\[ADMIN\]/i,
    /\{\{.*\}\}/,  // Template injection

    // Command injection (shell)
    /;\s*(rm|del|format|sudo|chmod)/i,
    /\$\(.*\)/,  // Command substitution
    /`.*`/,      // Backtick execution

    // Data exfiltration attempts
    /print\s+(all\s+)?(system|env|config)/i,
    /show\s+(me\s+)?(the\s+)?api\s+key/i,
    /what\s+is\s+your\s+(system\s+)?prompt/i,
];

// Allowed command prefixes (whitelist approach)
const ALLOWED_COMMANDS: string[] = [
    'npm run',
    'npx tsx',
    'git status',
    'git diff',
    'ls',
    'dir',
    'cat',
    'type',
];

export interface SanitizeResult {
    safe: boolean;
    sanitized: string;
    threats: string[];
}

/**
 * Sanitizes user input for agent consumption.
 * Returns sanitized text and threat report.
 */
export function sanitizeInput(input: string): SanitizeResult {
    const threats: string[] = [];
    let sanitized = input;

    // Check for injection patterns
    for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(input)) {
            threats.push(`Injection pattern detected: ${pattern.source}`);
            // Neutralize by replacing with safe placeholder
            sanitized = sanitized.replace(pattern, '[REDACTED]');
        }
    }

    // Escape potentially dangerous characters
    sanitized = sanitized
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\\/g, '\\\\');

    return {
        safe: threats.length === 0,
        sanitized,
        threats,
    };
}

/**
 * Validates a command before execution.
 * Only allows whitelisted command prefixes.
 */
export function validateCommand(command: string): boolean {
    const trimmed = command.trim().toLowerCase();

    // Check against whitelist
    const isAllowed = ALLOWED_COMMANDS.some(allowed =>
        trimmed.startsWith(allowed.toLowerCase())
    );

    if (!isAllowed) {
        console.error(`🚫 Command blocked by firewall: ${command}`);
        return false;
    }

    // Additional check for dangerous operators
    if (/[;&|`$]/.test(command) && !command.includes('&&')) {
        console.error(`🚫 Dangerous operator detected: ${command}`);
        return false;
    }

    return true;
}

/**
 * Wraps agent output to prevent leaking sensitive data.
 */
export function sanitizeOutput(output: string): string {
    // Redact common secret patterns
    return output
        .replace(/sk-[a-zA-Z0-9]{48}/g, '[REDACTED_API_KEY]')
        .replace(/ghp_[a-zA-Z0-9]{36}/g, '[REDACTED_GITHUB_TOKEN]')
        .replace(/password\s*[:=]\s*\S+/gi, 'password: [REDACTED]')
        .replace(/secret\s*[:=]\s*\S+/gi, 'secret: [REDACTED]');
}

// CLI Usage
if (require.main === module) {
    const testInput = process.argv[2] || 'Hello, this is a test input.';
    console.log('🔍 Testing Input Sanitizer\n');

    const result = sanitizeInput(testInput);
    console.log('Input:', testInput);
    console.log('Safe:', result.safe);
    console.log('Sanitized:', result.sanitized);
    if (result.threats.length > 0) {
        console.log('Threats:', result.threats);
    }
}
