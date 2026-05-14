FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:1.27-alpine

# Runtime env for /api/ → upstream (envsubst in the stock nginx entrypoint).
# Compose: defaults match the ``backend`` service. Render: set both to your deployed API, e.g.
#   API_PROXY_TARGET=https://your-api.onrender.com
#   API_PROXY_HOST=your-api.onrender.com
ENV API_PROXY_TARGET=http://backend:8000
ENV API_PROXY_HOST=backend

COPY default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
