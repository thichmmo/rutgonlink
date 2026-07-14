#!/bin/bash

# BOC-LINK VPS SETUP SCRIPT
# Chạy lệnh này trên VPS: bash setup-vps.sh

set -e

echo "=========================================="
echo "BOC-LINK VPS SETUP"
echo "=========================================="

# Update system
echo "[1/8] Cập nhật hệ thống..."
apt update && apt upgrade -y

# Cài Docker
echo "[2/8] Cài đặt Docker..."
apt install -y docker.io docker-compose
systemctl start docker
systemctl enable docker

# Cài Nginx
echo "[3/8] Cài đặt Nginx..."
apt install -y nginx
systemctl start nginx
systemctl enable nginx

# Cài MariaDB Client (để connect từ local nếu cần)
echo "[4/8] Cài đặt MariaDB Client..."
apt install -y mariadb-client

# Cài Git
echo "[5/8] Cài đặt Git..."
apt install -y git

# Tạo folder project
echo "[6/8] Tạo folder project..."
mkdir -p /root/boc-link
cd /root/boc-link

# Setup Nginx reverse proxy
echo "[7/8] Setup Nginx reverse proxy..."
cat > /etc/nginx/sites-available/boc-link << 'EOF'
server {
    listen 80;
    server_name 160.191.87.43;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable Nginx site
ln -sf /etc/nginx/sites-available/boc-link /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Cài GitLab Runner
echo "[8/8] Cài đặt GitLab Runner..."
curl -L https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh | bash
apt-get install -y gitlab-runner

# Add gitlab-runner vào docker group
usermod -aG docker gitlab-runner

# Start GitLab Runner
systemctl start gitlab-runner
systemctl enable gitlab-runner

echo ""
echo "=========================================="
echo "✅ SETUP HOÀN TẤT!"
echo "=========================================="
echo ""
echo "📝 Bước tiếp theo:"
echo "1. Copy docker-compose.yml vào: /root/boc-link/"
echo "2. Register GitLab Runner:"
echo "   gitlab-runner register"
echo ""
echo "3. Khi prompt hỏi, nhập:"
echo "   - GitLab instance URL: https://gitlab.com/"
echo "   - Registration token: [Lấy từ Settings → CI/CD → Runners]"
echo "   - Description: boc-link-vps-runner"
echo "   - Tags: docker,vps"
echo "   - Executor: docker"
echo "   - Default Docker image: docker:latest"
echo ""
echo "4. SSH Key Setup (Trên máy LOCAL):"
echo "   ssh-copy-id -i ~/.ssh/id_rsa.pub root@160.191.87.43"
echo ""
echo "5. Push code lên GitLab:"
echo "   git add ."
echo "   git commit -m 'Add Docker setup'"
echo "   git push origin main"
echo ""
echo "🎉 App sẽ chạy ở: http://160.191.87.43:3000"
echo "                  https://vmeta.vn (qua Cloudflare)"
echo "=========================================="
