FROM node:24-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY package.json ./
RUN npm install
# --local mode: install locally-built @seamless-auth/* tarballs over the registry
# versions. vendor/ is empty in --released mode, so this is a no-op there.
COPY vendor/ ./vendor/
RUN if ls ./vendor/*.tgz >/dev/null 2>&1; then \
      npm install ./vendor/seamless-auth-core-*.tgz ./vendor/seamless-auth-fastify-*.tgz; \
    fi
COPY server.mjs ./
EXPOSE 3001
CMD ["node", "server.mjs"]
