#!/bin/bash

# MCP 配置调试脚本
# 用途: 检查 MCP 服务器配置状态

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

echo ""
echo "================================================"
echo "  MCP 配置调试"
echo "================================================"
echo ""

# 1. 检查 Codex CLI
log_info "检查 Codex CLI..."
if command -v codex &> /dev/null; then
    VERSION=$(codex --version 2>&1 | head -n 1)
    log_success "Codex CLI 已安装: $VERSION"
else
    log_error "Codex CLI 未安装"
    echo "  安装: npm install -g @openai/codex"
    exit 1
fi

# 2. 检查认证
log_info "检查 Codex CLI 认证..."
if [ -f ~/.codex/auth.json ]; then
    log_success "Codex CLI 已认证"
else
    log_error "Codex CLI 未认证"
    echo "  认证: codex login --api-key \"sk-...\""
    exit 1
fi

# 3. 检查 codex-mcp-server
log_info "检查 codex-mcp-server..."
if [ -f /Users/xuqian/workspace/codex-mcp-server/dist/index.js ]; then
    log_success "codex-mcp-server 已构建"
else
    log_error "codex-mcp-server 未构建"
    echo "  构建: cd /Users/xuqian/workspace/codex-mcp-server && npm run build"
    exit 1
fi

# 4. 检查 MCP 配置
log_info "检查 MCP 服务器配置..."
echo ""
claude mcp list
echo ""

# 5. 测试 MCP 连接
log_info "测试 codex-cli 连接..."
if timeout 5 claude mcp call codex-cli ping 2>&1 | grep -q "pong\|success"; then
    log_success "codex-cli 连接正常"
else
    log_warning "codex-cli 连接测试超时或失败（这可能是正常的）"
fi

# 6. 检查项目配置文件
log_info "检查项目 MCP 配置..."
if grep -q "codex-cli" ~/.claude.json 2>/dev/null; then
    log_success "codex-cli 已添加到 ~/.claude.json"
    echo ""
    echo "配置详情:"
    cat ~/.claude.json | jq '.projects["/Users/xuqian/workspace/kiro-for-cc"].mcpServers' 2>/dev/null || \
    cat ~/.claude.json | grep -A 10 "codex-cli" | head -15
else
    log_error "codex-cli 未在 ~/.claude.json 中找到"
fi

echo ""
echo "================================================"
log_info "调试完成"
echo "================================================"
echo ""
log_info "下一步:"
echo "  1. 在 Cursor 中，找到左侧 'MCP SERVERS' 部分"
echo "  2. 点击标题栏的刷新按钮（♻️ 图标）"
echo "  3. 应该能看到 'codex-cli' 服务器"
echo ""
log_info "如果还是看不到:"
echo "  1. 完全退出 Cursor（Cmd+Q）"
echo "  2. 重新打开 Cursor"
echo "  3. 打开 kiro-for-cc 项目"
echo ""
