# 🚀 CI/CD Setup Guide - BOC-LINK

## 📋 Quy Trình CI/CD

```
Your Local Machine
        ↓
    git push main
        ↓
GitLab Pipeline
        ├─ Build Stage: Build Docker image
        ├─ Push to Docker Hub
        ↓
Deploy Stage
        └─ SSH to VPS
           ├─ Git clone/pull repo
           ├─ Generate .env
           ├─ Pull Docker image
           ├─ Run docker-compose
           ├─ Run migrations
           └─ Health check
```

## ⚙️ Lần Đầu Setup (15 phút)

### Step 1: VPS Setup (SSH vào VPS)

```bash
# SSH vào VPS
ssh root@your-vps-ip

# Download & run setup script
curl -O https://your-gitlab-repo/raw/main/setup-vps-auto.sh
bash setup-vps-auto.sh

# Nếu download không được, copy script từ:
# /Volumes/KIOXIA/CODE/boc-link/setup-vps-auto.sh
# và paste lên VPS
```

### Step 2: Setup Deploy Key (SSH vào VPS)

```bash
# Chạy script setup SSH key
curl -O https://your-gitlab-repo/raw/main/setup-deploy-key.sh
bash setup-deploy-key.sh

# Copy SSH public key được hiển thị
```

### Step 3: Add Deploy Key to GitLab

1. Vào **GitLab → Your Project**
2. Settings → **Deploy keys**
3. Click **"Add new key"**
4. Đặt tên: `boc-link-vps-deploy`
5. Paste SSH public key từ step 2
6. ✅ **Enable "Write access"**
7. Click **"Add key"**

### Step 4: Configure GitLab CI Variables

Vào **Settings → CI/CD → Variables**

Thêm các biến sau (lấy từ `.env` của bạn):

| Biến | Giá trị | Protected | Masked |
|------|--------|-----------|--------|
| `NEXTAUTH_URL` | https://yourdomain.com | ✓ | ✗ |
| `NEXTAUTH_SECRET` | your-secret | ✓ | ✓ |
| `DB_ROOT_PASSWORD` | your-password | ✓ | ✓ |
| `DB_NAME` | boclink | ✓ | ✗ |
| `DB_USER` | boclink_user | ✓ | ✗ |
| `DB_PASSWORD` | your-password | ✓ | ✓ |
| `DATABASE_URL` | mysql://user:pass@mariadb:3306/boclink | ✓ | ✓ |
| `DOCKER_IMAGE_NAME` | boc-link | ✓ | ✗ |
| `DOCKER_USERNAME` | your-dockerhub | ✓ | ✓ |
| `DOCKER_PASSWORD` | your-docker-token | ✓ | ✓ |
| `VPS_HOST` | your-vps-ip | ✓ | ✗ |
| `VPS_USER` | root | ✓ | ✗ |
| `SSH_PRIVATE_KEY` | SSH_KEY_CONTENT | ✓ | ✓ |

**Cách lấy SSH_PRIVATE_KEY:**
```bash
# Chạy trong terminal của bạn
cat ~/.ssh/id_rsa
# Copy toàn bộ output (từ -----BEGIN đến -----END)
```

### Step 5: Test First Deploy

```bash
# Trên máy local của bạn
git add .
git commit -m "feat: initial CI/CD setup"
git push origin main

# Vào GitLab xem CI/CD pipeline chạy
# Menu: Build → Pipelines
```

## 🔄 Từ Giờ Trở Đi - Chỉ Cần Code & Push

### Thay đổi code:
```bash
# Tại máy local
git add .
git commit -m "feat: your feature"
git push origin main
```

### Thay đổi biến env:
```bash
# Vào GitLab → Settings → CI/CD → Variables
# Edit giá trị
# Lần push tiếp theo sẽ tự động dùng biến mới
```

### Deploy ngay lập tức:
```bash
# Vào GitLab → Build → Pipelines
# Click bên phải → Play (deploy)
# Hoặc tạo commit để trigger lại
```

## 🐛 Debug & Troubleshooting

### Xem logs:
```bash
# GitLab → Build → Pipelines → Click pipeline
# Click job để xem logs
```

### SSH vào VPS để check:
```bash
ssh root@your-vps-ip

# Kiểm tra containers
docker ps

# Xem logs app
docker logs boc-link-app

# Xem logs database
docker logs boc-link-db

# Restart containers
cd /root/boc-link && docker-compose restart

# Check git status
cd /root/boc-link && git status && git log --oneline -5
```

### Nếu deploy fail:
```bash
# SSH vào VPS
ssh root@your-vps-ip

# Xem chi tiết error
docker logs boc-link-app --tail 100

# Dừng containers
cd /root/boc-link && docker-compose down

# Xóa old images (nếu cần)
docker rmi your-image:latest

# Chạy lại CI/CD
# Hoặc chạy thủ công:
cd /root/boc-link && docker-compose pull && docker-compose up -d
```

## 📁 File Structure

```
project-root/
├── .gitlab-ci.yml          ← CI/CD pipeline config
├── .env                    ← Secrets (gitignored)
├── .env.example            ← Template
├── .gitignore              ← Git ignore rules
├── setup-vps-auto.sh       ← VPS setup script
├── setup-deploy-key.sh     ← Deploy key setup
├── docker-compose.yml      ← Production compose
├── Dockerfile              ← Multi-stage build
└── ...
```

## ✅ Checklist

- [ ] SSH vào VPS & chạy `setup-vps-auto.sh`
- [ ] Chạy `setup-deploy-key.sh` & lấy public key
- [ ] Add Deploy Key vào GitLab
- [ ] Cấu hình tất cả CI/CD Variables trong GitLab
- [ ] Test push lên main → xem pipeline chạy
- [ ] Verify app chạy trên VPS
- [ ] Hoàn tất! 🎉

## 🔒 Safety Policy (Khong Mat Du Lieu)

- Chi dung `prisma migrate deploy` tren production.
- KHONG dung `prisma db push --accept-data-loss` tren production.
- KHONG dung `prisma migrate reset` tren production.
- Truoc moi lan deploy dau tien co migration moi: backup DB.

## 🆘 Support

Nếu có vấn đề:
1. Kiểm tra CI logs trên GitLab
2. SSH vào VPS & check docker logs
3. Xem `.gitlab-ci.yml` section deploy_vps
4. Verify SSH keys & deploy keys setup

---

**Lưu ý:**
- Mỗi push lên `main` sẽ tự động build & deploy
- Thay đổi biến env sẽ được apply ở lần deploy tiếp theo
- Toàn bộ quy trình chạy tự động - chỉ cần code & push! ✨
