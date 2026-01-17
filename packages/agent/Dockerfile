# Minimal Dockerfile for bundled agent
FROM node:20-alpine

WORKDIR /app

# Install only the native dependencies that can't be bundled
RUN npm init -y && \
    npm install --omit=dev \
      systeminformation@^5.30.4 \
      dockerode@^4.0.9 && \
    rm -rf /root/.npm /tmp/*

# Copy the bundled agent (built outside Docker)
COPY packages/agent/dist/agent.cjs ./agent.cjs

# Create non-root user
RUN addgroup -g 1001 -S neon && \
    adduser -S neon -u 1001 -G neon && \
    chown -R neon:neon /app

USER neon

CMD ["node", "agent.cjs"]
