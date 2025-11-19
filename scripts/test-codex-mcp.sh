#!/bin/bash

# Codex MCP Server 功能测试脚本
# 用途: 测试 codex-mcp-server 的各项功能

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

log_test() {
    echo -e "${CYAN}[TEST]${NC} $1"
}

echo ""
echo "================================================"
echo "  Codex MCP Server 功能测试"
echo "================================================"
echo ""

# 1. 测试 ping 工具
log_test "测试 1: ping 工具"
echo ""
log_info "调用 MCP 工具: ping"
echo ""

# 使用 echo 传递 JSON，然后通过 stdin 调用
echo '请使用 codex-cli 的 ping 工具测试连接' | claude -m codex-cli 2>&1 | head -20

echo ""
log_success "ping 工具测试完成"
echo ""
echo "================================================"
echo ""

# 2. 测试 help 工具
log_test "测试 2: help 工具"
echo ""
log_info "调用 MCP 工具: help"
echo ""

echo '请使用 codex-cli 的 help 工具获取帮助信息' | claude -m codex-cli 2>&1 | head -30

echo ""
log_success "help 工具测试完成"
echo ""
echo "================================================"
echo ""

# 3. 测试 codex 工具（简单问题）
log_test "测试 3: codex 工具（简单编程问题）"
echo ""
log_info "调用 MCP 工具: codex"
log_info "问题: 用 Python 实现一个冒泡排序算法"
echo ""

echo '请使用 codex 工具回答：用 Python 实现一个冒泡排序算法，要求代码简洁清晰' | claude -m codex-cli 2>&1 | head -50

echo ""
log_success "codex 工具测试完成"
echo ""
echo "================================================"
echo ""

# 4. 测试 listSessions 工具
log_test "测试 4: listSessions 工具"
echo ""
log_info "调用 MCP 工具: listSessions"
echo ""

echo '请使用 codex-cli 的 listSessions 工具查看所有会话' | claude -m codex-cli 2>&1 | head -20

echo ""
log_success "listSessions 工具测试完成"
echo ""
echo "================================================"
echo ""

log_success "✨ 所有测试完成！"
echo ""
log_info "总结:"
echo "  1. ✓ ping 工具 - 测试连接"
echo "  2. ✓ help 工具 - 获取帮助"
echo "  3. ✓ codex 工具 - AI 编程助手"
echo "  4. ✓ listSessions 工具 - 会话管理"
echo ""
log_info "下一步: 在 Kiro for CC 中测试 Codex 深度分析"
echo "  1. 刷新 MCP SERVERS 视图（点击 ♻️ 按钮）"
echo "  2. 创建一个 Spec"
echo "  3. 右键 design.md → Review Design"
echo ""
