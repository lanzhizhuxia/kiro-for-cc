#!/bin/bash

# Codex MCP Server 快速配置脚本
# 用途: 自动配置本地 codex-mcp-server 到 Claude Code

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# codex-mcp-server 项目路径
CODEX_MCP_SERVER_PATH="/Users/xuqian/workspace/codex-mcp-server"

echo ""
echo "================================================"
echo "  Codex MCP Server 快速配置"
echo "================================================"
echo ""

# 检查 codex-mcp-server 是否存在
if [ ! -d "$CODEX_MCP_SERVER_PATH" ]; then
    log_error "未找到 codex-mcp-server 项目"
    log_info "请确保项目位于: $CODEX_MCP_SERVER_PATH"
    exit 1
fi

log_success "找到 codex-mcp-server 项目"

# 检查 Codex CLI 是否安装
if ! command -v codex &> /dev/null; then
    log_error "未找到 Codex CLI"
    echo ""
    log_info "请先安装 Codex CLI:"
    echo "  npm install -g @openai/codex"
    echo ""
    exit 1
fi

log_success "Codex CLI 已安装 ($(codex --version 2>&1 | head -n 1))"

# 检查 Codex CLI 是否已认证
if [ ! -f ~/.codex/auth.json ]; then
    log_warning "Codex CLI 未认证"
    echo ""
    log_info "请先运行认证:"
    echo "  codex login --api-key \"your-openai-api-key\""
    echo ""
    read -p "是否已完成认证? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "请先完成认证后再运行此脚本"
        exit 1
    fi
fi

log_success "Codex CLI 已认证"

# 构建 codex-mcp-server
log_info "构建 codex-mcp-server..."
cd "$CODEX_MCP_SERVER_PATH"

if [ ! -d "node_modules" ]; then
    log_info "安装依赖..."
    npm install
fi

log_info "编译 TypeScript..."
npm run build

if [ ! -f "dist/index.js" ]; then
    log_error "构建失败: dist/index.js 未生成"
    exit 1
fi

log_success "codex-mcp-server 构建完成"

# 配置 Claude Code MCP
log_info "配置 Claude Code MCP..."

# 检查是否已配置
if claude mcp list 2>&1 | grep -q "codex-cli"; then
    log_warning "codex-cli 已配置，将重新配置..."
    claude mcp remove codex-cli 2>/dev/null || true
fi

# 添加 MCP 配置
log_info "添加 MCP 服务器配置..."
claude mcp add codex-cli -- node "$CODEX_MCP_SERVER_PATH/dist/index.js"

log_success "MCP 配置完成"

# 验证配置
log_info "验证配置..."
if claude mcp list | grep -q "codex-cli"; then
    log_success "✓ codex-cli 已成功配置"
else
    log_error "配置验证失败"
    exit 1
fi

# 测试连接
log_info "测试 MCP 服务器连接..."
if timeout 5 claude mcp call codex-cli ping 2>&1 | grep -q "pong\|success"; then
    log_success "✓ MCP 服务器连接正常"
else
    log_warning "MCP 服务器连接测试超时（这可能是正常的）"
fi

echo ""
echo "================================================"
log_success "✨ 配置完成！"
echo "================================================"
echo ""
log_info "下一步："
echo "  1. 重启 Cursor"
echo "  2. 在 Kiro for CC 左侧栏查看 'MCP SERVERS' 部分"
echo "  3. 创建一个 Spec，编辑 design.md"
echo "  4. 右键 design.md → 'Review Design'"
echo "  5. 查看 Codex 深度分析结果！"
echo ""
log_info "文档:"
echo "  - 集成指南: docs/CODEX_MCP_INTEGRATION.md"
echo "  - 配置指南: docs/CODEX_SETUP.md"
echo ""
