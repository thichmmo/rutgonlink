# 🚀 CI/CD Setup - Simple Version

## 📋 Quy Trình

```
Your Local Machine
        ↓
    git push main
        ↓
GitLab Runner
  ├─ Build Docker image
  ├─ Push to Docker Hub
  └─ SSH to VPS (password auth)
       ├─ Pull Docker image
       ├─ Update docker-compose.yml
       ├─ Create .env
       ├─ Run docker-compose up -d
       └─ Run migrations
```

---

## ⚙️ Setup (ONE TIME - 3 phút)

### Step 1: Thêm biến vào GitLab

**Settings → CI/CD → Variables** thêm những biến này:

| Biến | Giá trị | Type |
|------|--------|------|
| `VPS_HOST` | `160.191.87.43` | Protected |
| `VPS_USER` | `root` | Protected |
| `VPS_PASSWORD` | `<pass SSH VPS của bạn>` | Protected + Masked |
| `DOCKER_USERNAME` | `your-docker-hub-username` | Protected + Masked |
| `DOCKER_PASSWORD` | `your-docker-hub-token` | Protected + Masked |
| `DOCKER_IMAGE_NAME` | `boc-link` | Protected |
| `NEXTAUTH_URL` | `https://yourdomain.com` | Protected |
| `NEXTAUTH_SECRET` | `your-secret` | Protected + Masked |
| `DB_ROOT_PASSWORD` | `password` | Protected + Masked |
| `DB_NAME` | `boclink` | Protected |
| `DB_USER` | `boclink_user` | Protected |
| `DB_PASSWORD` | `password` | Protected + Masked |
| `DATABASE_URL` | `mysql://user:pass@mariadb:3306/boclink` | Protected + Masked |

### Step 2: Chuẩn bị VPS

```bash
# SSH vào VPS
ssh root@160.191.87.43

# Tạo thư mục project
mkdir -p /root/boc-link

# Kiểm tra Docker & docker-compose
docker --version
docker-compose --version

# Nếu chưa cài: cài Docker
curl -fsSL https://get.docker.com | sh

# Nếu chưa cài docker-compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose && chmod +x /usr/local/bin/docker-compose

exit
```

---

## 🎉 Sử Dụng

### Code → Push → Auto Deploy

```bash
# Trên máy local
git add .
git commit -m "feat: your feature"
git push origin main
```

**CI/CD tự động:**
1. Build Docker image ✓
2. Push lên Docker Hub ✓
3. SSH vào VPS (password) ✓
4. Pull Docker image ✓
5. Update docker-compose.yml ✓
6. Tạo .env ✓
7. Run `docker-compose up -d` ✓
8. Chạy migrations ✓

### Xem logs:

```bash
# GitLab CI/CD logs:
# GitLab → Build → Pipelines → Click job để xem logs

# VPS container logs:
ssh root@160.191.87.43
docker logs boc-link-app
docker ps
```

### SSH vào VPS check:

```bash
ssh root@160.191.87.43

# Xem containers
docker ps

# Xem logs
docker logs boc-link-app --tail 50

# Restart
cd /root/boc-link && docker-compose restart

# Stop
cd /root/boc-link && docker-compose down
```

---

## ✅ Checklist

- [ ] Thêm tất cả CI/CD Variables vào GitLab
- [ ] Test SSH: `ssh root@160.191.87.43` (should work)
- [ ] Kiểm tra Docker & docker-compose trên VPS
- [ ] Test push code lên main branch
- [ ] Xem pipeline chạy trên GitLab
- [ ] Verify app chạy trên VPS ✨

---

## 🐛 Troubleshooting

### SSH login fails?
```bash
# Test SSH từ máy local
ssh root@160.191.87.43

# Nếu fail: Kiểm tra password VPS_PASSWORD trong GitLab Variables
# Đảm bảo password đúng!
```

### Docker image pull fails?
```bash
# SSH vào VPS
ssh root@160.191.87.43

# Test Docker Hub login
echo "your-token" | docker login -u your-username --password-stdin

# Try pull manually
docker pull your-username/boc-link:latest
```

### App container exits?
```bash
# Check logs
ssh root@160.191.87.43
docker logs boc-link-app

# Check .env
cat /root/boc-link/.env

# Check docker-compose.yml
cat /root/boc-link/docker-compose.yml
```

---

**Thế đó! Sau setup, chỉ cần code & push! 🚀**
