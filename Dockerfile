# 基础镜像，使用 Node.js 18 作为构建环境
FROM node:18-alpine AS build-stage

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json 到工作目录
COPY package*.json ./

# 安装项目依赖
RUN npm install

# 复制项目所有文件到工作目录
COPY . .

# 构建项目（跳过类型检查）
RUN npm run build-only

# 使用 Nginx 作为生产环境的 Web 服务器
FROM nginx:stable-alpine AS production-stage

# 复制构建好的文件到 Nginx 的默认静态文件目录
COPY --from=build-stage /app/dist /usr/share/nginx/html

# 复制自定义Nginx配置文件
COPY default.conf /etc/nginx/conf.d/default.conf

# 暴露 80 端口
EXPOSE 80

# 启动 Nginx 服务
CMD ["nginx", "-g", "daemon off;"]