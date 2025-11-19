# Codex MCP 工具授权指南

## 问题

当使用 Claude Code 调用 Codex MCP 工具时，会提示：
```
看起来需要先授权才能使用 Codex CLI 工具
```

## 原因

Claude Code 有权限保护机制，MCP 工具需要用户明确授权才能使用。

## 解决方案

### 方法 1：交互式授权（推荐）

1. **启动交互式 Claude Code 会话**：
   ```bash
   claude
   ```

2. **请求使用 Codex 工具**：
   ```
   请使用 mcp__codex-cli__codex 工具，用 Python 写一个 Hello World 程序
   ```

3. **当 Claude 询问权限时，输入 "yes" 或 "允许"**：
   ```
   Would you like to allow the tool mcp__codex-cli__codex? (yes/no)
   > yes
   ```

4. **权限会被保存**，下次就不需要再授权了

### 方法 2：命令行参数（临时授权）

每次使用时添加 `--allowed-tools` 参数：

```bash
echo "请使用 codex 工具写代码" | claude --allowed-tools "mcp__codex-cli__*"
```

### 方法 3：配置文件（永久授权）

编辑 `~/.claude.json`，在项目配置中添加：

```json
{
  "projects": {
    "/Users/xuqian/workspace/kiro-for-cc": {
      "allowedTools": [
        "mcp__codex-cli__codex",
        "mcp__codex-cli__ping",
        "mcp__codex-cli__help",
        "mcp__codex-cli__listSessions"
      ],
      "mcpServers": {
        "codex-cli": {
          "type": "stdio",
          "command": "node",
          "args": [
            "/Users/xuqian/workspace/codex-mcp-server/dist/index.js"
          ],
          "env": {}
        }
      }
    }
  }
}
```

**注意**：手动编辑配置文件有风险，推荐使用方法 1。

### 方法 4：在 Kiro for CC 中自动授权

当你在 Kiro for CC 中点击 "Review Design" 时，第一次会弹出授权提示。

**步骤**：
1. 创建一个测试 Spec
2. 右键 `design.md` → "Review Design"
3. 当提示授权时，点击 "Allow" 或 "允许"
4. 权限会被保存，以后就不需要再授权

## 快速测试

### 交互式测试（最简单）

```bash
# 1. 启动 Claude Code
claude

# 2. 输入以下内容
请使用 mcp__codex-cli__codex 工具回答：用 Python 写一个冒泡排序算法

# 3. 当询问是否允许工具时，输入 yes
```

### 命令行测试

```bash
# 使用 --allowed-tools 参数
cat <<'EOF' | claude --allowed-tools "mcp__codex-cli__*"
请使用 mcp__codex-cli__codex 工具：
分析这段代码的时间复杂度

def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
EOF
```

## 验证授权成功

授权成功后，你会看到：

1. **Claude 调用工具**：
   ```
   [调用工具: mcp__codex-cli__codex]
   参数: {
     "prompt": "用 Python 写一个冒泡排序算法",
     "reasoningEffort": "medium"
   }
   ```

2. **Codex 返回结果**：
   ```python
   def bubble_sort(arr):
       # ... 代码实现 ...
   ```

3. **Claude 总结**：
   ```
   根据 Codex 的分析，这是一个标准的冒泡排序实现...
   ```

## 在 Kiro for CC 中使用

授权后，Codex 深度分析功能就可以正常使用了：

1. **刷新 MCP SERVERS 视图**（点击 ♻️ 按钮）
2. **创建测试 Spec**
3. **右键 design.md** → "Review Design"
4. **查看 Codex 分析结果**

## 故障排查

### 问题 1: 一直提示需要授权

**可能原因**：
- 没有在交互式会话中授权
- 配置文件格式错误

**解决**：
```bash
# 启动交互式会话
claude

# 手动授权一次
请使用 mcp__codex-cli__ping 工具测试连接
> (输入 yes 授权)
```

### 问题 2: 工具未找到

**检查**：
```bash
# 确认 MCP 服务器已配置
claude mcp list

# 应该看到：
# codex-cli: ... - ✓ Connected
```

**解决**：
```bash
# 重新添加 MCP 服务器
claude mcp add codex-cli -- node /Users/xuqian/workspace/codex-mcp-server/dist/index.js
```

### 问题 3: 授权保存失败

**检查**：
```bash
# 查看权限配置
cat ~/.claude.json | jq '.projects["/Users/xuqian/workspace/kiro-for-cc"].allowedTools'
```

**解决**：
- 确保 `~/.claude.json` 有写权限
- 检查 JSON 格式是否正确

## 安全提示

⚠️ **授权 MCP 工具意味着允许它：**
- 调用 OpenAI Codex API（会产生费用）
- 访问你的 OpenAI API Key
- 执行代码分析

✅ **推荐做法**：
- 只授权你信任的 MCP 服务器
- 定期检查 API 使用量
- 使用有限额度的 API Key

## 总结

**最简单的授权方法**：

```bash
# 1. 启动交互式会话
claude

# 2. 请求使用工具
请使用 mcp__codex-cli__codex 工具写代码

# 3. 输入 yes 授权
> yes

# 完成！权限已保存
```

授权后，Kiro for CC 的 Codex 深度分析功能就可以正常使用了！🎉
