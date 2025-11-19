#!/bin/bash

# 快速更新脚本 - 用于开发时快速编译和重新加载
# 适用于已经在 Extension Development Host 中运行的场景

set -e

echo "🔄 快速编译..."
npm run compile

echo "✅ 编译完成！"
echo ""
echo "💡 提示："
echo "  - 如果在 Extension Development Host (F5) 中运行："
echo "    按 Cmd+R (macOS) / Ctrl+R (Linux/Windows) 重新加载窗口"
echo ""
echo "  - 如果需要完全重新安装："
echo "    运行: ./scripts/build-and-install.sh"
