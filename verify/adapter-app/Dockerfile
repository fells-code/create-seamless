FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY package.json ./
RUN npm install
COPY server.mjs ./
EXPOSE 3000
CMD ["node", "server.mjs"]
