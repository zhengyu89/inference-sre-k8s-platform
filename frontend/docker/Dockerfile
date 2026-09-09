# Build context is the `frontend/` directory (see docker-compose.yml / k8s
# build instructions), this Dockerfile just lives in frontend/docker/.

# --- build stage -----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- runtime stage -----------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Only substitute our own vars in the template — leaves nginx's built-in
# $host/$remote_addr/etc. runtime variables untouched.
ENV NGINX_ENVSUBST_FILTER=^BACKEND_
ENV BACKEND_HOST=backend
ENV BACKEND_PORT=3000

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
