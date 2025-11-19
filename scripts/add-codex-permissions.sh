#!/bin/bash

# 添加 Codex MCP 工具权限
# 用途: 自动授权 codex-cli 的所有工具

set -e

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

echo ""
echo "================================================"
echo "  添加 Codex MCP 工具权限"
echo "================================================"
echo ""

PROJECT_PATH="/Users/xuqian/workspace/kiro-for-cc"

log_info "备份当前配置..."
cp ~/.claude.json ~/.claude.json.backup
log_success "备份完成: ~/.claude.json.backup"

log_info "添加工具权限..."

# 使用 jq 添加 allowedTools
cat ~/.claude.json | jq \
  --arg project "$PROJECT_PATH" \
  '.projects[$project].allowedTools = [
    "mcp__codex-cli__codex",
    "mcp__codex-cli__ping",
    "mcp__codex-cli__help",
    "mcp__codex-cli__listSessions"
  ]' > ~/.claude.json.tmp

mv ~/.claude.json.tmp ~/.claude.json

log_success "权限已添加"

log_info "验证配置..."
echo ""
cat ~/.claude.json | jq -r --arg project "$PROJECT_PATH" \
  '.projects[$project].allowedTools[]'

echo ""
log_success "✨ 完成！"
echo ""
log_info "已授权的工具:"
echo "  1. mcp__codex-cli__codex - AI 编程助手"
echo "  2. mcp__codex-cli__ping - 连接测试"
echo "  3. mcp__codex-cli__help - 帮助信息"
echo "  4. mcp__codex-cli__listSessions - 会话管理"
echo ""
log_info "下一步:"
echo "  1. 重启 Cursor"
echo "  2. 右键 design.md → Review Design"
echo "  3. 应该能直接使用 Codex 分析，无需再次授权"
echo ""
