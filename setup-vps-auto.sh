#!/bin/bash

# ============================================
# BOC-LINK VPS AUTO SETUP SCRIPT
# Setup Docker + Git + SSH Keys
# ✅ Fully automated - no manual steps needed
# ============================================

set -e

echo "🚀 Starting VPS setup for BOC-LINK..."

# ============================================
# 1. Update system
# ============================================
echo "📦 Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

# ============================================
# 2. Install Docker
# ============================================
echo "🐳 Installing Docker..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
  rm get-docker.sh
  echo "✅ Docker installed"
else
  echo "✅ Docker already installed"
fi

# Add root user to docker group
usermod -aG docker root || true

# ============================================
# 3. Install Docker Compose
# ============================================
echo "🔧 Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
  DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d'"' -f4)
  curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose
  echo "✅ Docker Compose installed"
else
  echo "✅ Docker Compose already installed"
fi

# ============================================
# 4. Install dependencies
# ============================================
echo "📦 Installing dependencies..."
apt-get install -y -qq git openssh-client curl wget

# ============================================
# 5. Prepare SSH directory
# ============================================
echo "🔐 Preparing SSH directory..."
mkdir -p /root/.ssh
chmod 700 /root/.ssh

# Add GitLab to known hosts
ssh-keyscan -H gitlab.com >> /root/.ssh/known_hosts 2>/dev/null || true

echo "✅ SSH ready"

# ============================================
# 6. Docker service configuration
# ============================================
echo "⚙️  Configuring Docker service..."
systemctl enable docker 2>/dev/null || true
systemctl start docker 2>/dev/null || true

# ============================================
# 7. Create project directory
# ============================================
echo "📁 Creating project directory..."
mkdir -p /root/boc-link

# ============================================
# 8. Docker service configuration
# ============================================
echo "⚙️  Configuring Docker service..."
systemctl enable docker 2>/dev/null || true
systemctl start docker 2>/dev/null || true

# ============================================
# 9. Display setup complete
# ============================================
echo ""
echo "✨ VPS Setup Complete!"
echo ""
echo "📌 NEXT STEPS:"
echo "1. Run: bash setup-deploy-key.sh"
echo "2. Add SSH public key to GitLab Deploy Keys"
echo "3. Push your code to GitLab"
echo "4. CI/CD will auto-deploy! 🚀"
echo ""
echo "🔍 Verify installation:"
echo "   docker --version"
echo "   docker-compose --version"
echo ""
