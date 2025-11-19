#!/bin/bash

# Codex MCP Server 交互式测试
# 用途: 通过 Claude Code CLI 测试 codex-mcp-server

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_test() {
    echo -e "${CYAN}[TEST]${NC} $1"
}

echo ""
echo "================================================"
echo "  Codex MCP Server 交互式测试"
echo "================================================"
echo ""

log_info "这个测试会通过 Claude Code CLI 调用 codex-mcp-server"
log_info "你将看到 Claude 使用 codex 工具来回答编程问题"
echo ""

# 测试 1: 简单编程问题
log_test "测试 1: 让 Claude 使用 codex 工具写一个 Hello World"
echo ""
log_info "提示词: '请使用 codex 工具，用 Python 写一个打印 Hello World 的程序'"
echo ""
echo "按 Enter 开始测试..."
read

echo '请使用 codex 工具，用 Python 写一个打印 Hello World 的程序' | claude

echo ""
log_success "测试 1 完成"
echo ""
echo "================================================"
echo ""

# 测试 2: 代码解释
log_test "测试 2: 让 Claude 使用 codex 工具解释代码"
echo ""
log_info "提示词: '请使用 codex 工具解释这段代码：def bubble_sort(arr): ...'"
echo ""
echo "按 Enter 继续..."
read

cat <<'EOF' | claude
请使用 codex 工具解释下面这段代码的工作原理：

def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n-i-1):
            if arr[j] > arr[j+1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]
    return arr
EOF

echo ""
log_success "测试 2 完成"
echo ""
echo "================================================"
echo ""

# 测试 3: 检查可用工具
log_test "测试 3: 检查 Claude 能看到哪些 MCP 工具"
echo ""
log_info "提示词: '列出你当前可用的所有工具'"
echo ""
echo "按 Enter 继续..."
read

echo '列出你当前可用的所有工具，特别是 MCP 工具' | claude

echo ""
log_success "测试 3 完成"
echo ""
echo "================================================"
echo ""

log_success "✨ 交互式测试完成！"
echo ""
log_info "你应该能看到："
echo "  1. Claude 调用 codex 工具来回答编程问题"
echo "  2. codex 工具返回的代码和解释"
echo "  3. MCP 工具列表中包含 codex、ping、help、listSessions"
echo ""
log_info "如果看到了这些，说明 codex-mcp-server 工作正常！"
echo ""
