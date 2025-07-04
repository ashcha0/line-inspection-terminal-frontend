# 构建新的Docker镜像
docker build -t line-inspection-frontend:latest . --no-cache

# 查看容器状态
docker ps

# 查看Nginx日志（用于调试）
docker logs line-inspection-frontend

# 直接保存为tar包
docker save -o line-inspection-frontend.tar line-inspection-frontend:latest

# 导入镜像
docker load -i line-inspection-frontend.tar

# 运行新容器
docker run --network host -d --name line-inspection-frontend -p 80:80 line-inspection-frontend:latest