#!/bin/bash

# GITLAB CI/CD SETUP SCRIPT
# Chạy lệnh này trên máy LOCAL để setup CI/CD

echo "=========================================="
echo "GITLAB CI/CD SETUP"
echo "=========================================="

# Thêm SSH key vào GitLab
echo "[1/3] Thêm SSH key vào VPS..."
if [ ! -f ~/.ssh/id_rsa ]; then
    echo "⚠️ SSH key không tìm thấy!"
    echo "Tạo SSH key mới? (Y/n)"
    read -r response
    if [[ "$response" != "n" ]]; then
        ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""
    fi
fi

# Copy SSH key
ssh-copy-id -i ~/.ssh/id_rsa.pub root@160.191.87.43

echo "[2/3] Copy docker-compose.yml vào VPS..."
scp docker-compose.yml root@160.191.87.43:/root/boc-link/
scp Dockerfile root@160.191.87.43:/root/boc-link/

echo ""
echo "=========================================="
echo "✅ SSH KEY & FILES SETUP HOÀN TẤT!"
echo "=========================================="
echo ""
echo "📝 Bước tiếp theo trên VPS:"
echo "1. SSH vào VPS:"
echo "   ssh root@160.191.87.43"
echo ""
echo "2. Register GitLab Runner:"
echo "   gitlab-runner register"
echo ""
echo "3. Lấy Registration Token từ:"
echo "   https://gitlab.com/your-project → Settings → CI/CD → Runners"
echo ""
echo "4. Nhập khi prompt:"
echo "   ✓ GitLab URL: https://gitlab.com/"
echo "   ✓ Token: [paste token]"
echo "   ✓ Description: boc-link-vps-runner"
echo "   ✓ Tags: docker,vps"
echo "   ✓ Executor: docker"
echo "   ✓ Docker image: docker:latest"
echo ""
echo "5. Sau đó push code:"
echo "   git add ."
echo "   git commit -m 'Add Docker & CI/CD setup'"
echo "   git push origin main"
echo ""
echo "=========================================="
