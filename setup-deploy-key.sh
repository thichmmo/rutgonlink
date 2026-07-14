#!/bin/bash

# ============================================
# BOC-LINK DEPLOY KEY SETUP
# Chỉ chạy lần đầu trên VPS
# ============================================

set -e

echo "🚀 BOC-LINK VPS Deploy Key Setup"
echo ""

# Check if root
if [ "$EUID" -ne 0 ]; then
   echo "❌ Please run as root (use: sudo su)"
   exit 1
fi

# ============================================
# 1. Create SSH key for GitLab
# ============================================
echo "🔐 Creating SSH key for GitLab Deploy..."
SSH_DIR="/root/.ssh"
SSH_KEY="$SSH_DIR/id_rsa_gitlab"

mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

if [ -f "$SSH_KEY" ]; then
    echo "⚠️  SSH key already exists at $SSH_KEY"
    echo "Using existing key."
else
    ssh-keygen -t rsa -b 4096 -f "$SSH_KEY" -N "" -C "boc-link-vps-$(date +%s)" 2>/dev/null
    chmod 600 "$SSH_KEY"
    echo "✅ SSH key created: $SSH_KEY"
fi

# ============================================
# 2. Create gitconfig for VPS git operations
# ============================================
echo "⚙️  Configuring Git..."

# Add GitLab to known_hosts if not exists
if ! grep -q "gitlab.com" /root/.ssh/known_hosts 2>/dev/null; then
    ssh-keyscan -H gitlab.com >> /root/.ssh/known_hosts 2>/dev/null || true
fi

cat >> /root/.ssh/config << 'EOF'

Host gitlab.com
  HostName gitlab.com
  User git
  IdentityFile ~/.ssh/id_rsa_gitlab
  StrictHostKeyChecking accept-new
EOF

chmod 600 /root/.ssh/config

# ============================================
# 3. Display public key
# ============================================
echo ""
echo "✨ Setup Complete!"
echo ""
echo "📋 NEXT STEPS:"
echo ""
echo "1️⃣  Copy this SSH PUBLIC KEY:"
echo "================================================"
cat "$SSH_KEY.pub"
echo "================================================"
echo ""
echo "2️⃣  Add to GitLab Deploy Keys:"
echo "   - URL: Settings → Deploy keys"
echo "   - Click: 'Add new key'"
echo "   - Name: 'boc-link-vps'"
echo "   - Paste the key above"
echo "   - ✅ Check: 'Grant write access'"
echo "   - Click: 'Add key'"
echo ""
echo "3️⃣  After adding Deploy Key:"
echo "   - Wait 30 seconds for sync"
echo "   - Push code to GitLab"
echo "   - CI/CD will auto-deploy! 🚀"
echo ""
echo "Test key (should show welcome from GitLab):"
echo "  ssh -i ~/.ssh/id_rsa_gitlab git@gitlab.com"
echo ""
