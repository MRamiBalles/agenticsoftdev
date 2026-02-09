# Agent Sandbox: Ephemeral Execution Environment
# Security: No network, non-root user, 30s timeout
# Compliance: ISO 42001 - Agent Containment

FROM node:20-alpine

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

# ============================================
# USAGE (from host):
# docker build -t agent-sandbox .
# docker run --rm --network none \
#   -v $(pwd)/task:/workspace:ro \
#   agent-sandbox
# ============================================

# SECURITY NOTES:
# --network none: Blocks ALL network access
# :ro mount: Read-only filesystem
# timeout 30: Prevents infinite loops
# non-root: Limits system access
