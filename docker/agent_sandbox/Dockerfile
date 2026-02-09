# Agent Sandbox: Ephemeral Execution Environment
# Security: No network, non-root user, 30s timeout
# Compliance: ISO 42001 - Agent Containment
# Phase 3: Integrated with src/orchestrator/sandbox-runtime.ts

FROM node:20-alpine

LABEL maintainer="AgenticSoftDev Pod"
LABEL compliance="ISO/IEC 42001 - Agent Containment"
LABEL phase="3 - Security & Isolation"

# Security: Create non-root user
RUN addgroup -S sandbox && adduser -S agent -G sandbox

# Install minimal tools (no extra attack surface)
RUN apk add --no-cache tini

# Set working directory
WORKDIR /workspace

# Copy only what's needed (mounted at runtime)
# No COPY command - workspace is mounted read-only

# Security: Switch to non-root user
USER agent

# Timeout wrapper: Kill process after 30 seconds
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["timeout", "30", "node", "task.js"]

# Healthcheck: verify node is functional
HEALTHCHECK --interval=5s --timeout=3s --retries=1 \
  CMD node -e "process.exit(0)" || exit 1

# ============================================
# USAGE (from host - manual):
# docker build -t agent-sandbox .
# docker run --rm --network none \
#   --memory=256m --cpus=0.5 \
#   --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
#   --security-opt no-new-privileges \
#   --pids-limit 64 \
#   -v $(pwd)/task:/workspace:ro \
#   agent-sandbox
#
# AUTOMATED (via sandbox-runtime.ts):
#   The Orchestrator manages this container lifecycle.
#   See: src/orchestrator/sandbox-runtime.ts
# ============================================

# SECURITY LAYERS (enforced by sandbox-runtime.ts):
# --network none       : Blocks ALL network access
# --read-only          : Immutable root filesystem
# --tmpfs /tmp         : Writable tmp (noexec, 64MB cap)
# --memory=256m        : Memory cap (OOM kill)
# --cpus=0.5           : CPU throttle
# --pids-limit 64      : Fork bomb protection
# --no-new-privileges  : Prevent privilege escalation
# timeout 30           : Hard kill after 30 seconds
# USER agent           : Non-root execution
