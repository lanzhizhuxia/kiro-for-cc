# 如何暂时禁用 Codex 功能

如果你暂时不需要 Codex 深度分析功能，可以通过以下步骤禁用它：

## 方法一：修改代码（推荐）

### 步骤 1：编辑 specManager.ts

打开 `src/features/spec/specManager.ts` 文件，找到第 37-39 行的 `isCodexAvailable()` 方法：

```typescript
isCodexAvailable(): boolean {
    return !!this.codexOrchestrator;
}
```

修改为：

```typescript
isCodexAvailable(): boolean {
    // 暂时禁用 Codex 功能
    return false;
    // return !!this.codexOrchestrator;
}
```

### 步骤 2：重新编译和安装

```bash
npm run compile
./scripts/build-and-install.sh cursor
```

### 步骤 3：重启 Cursor

重启 Cursor 后，Spec 树中的 design.md 和 requirements.md 将不再显示 "Review Design" 和 "Review Requirements" 按钮。

## 方法二：使用 VSCode 设置（未来支持）

未来版本将支持通过 VSCode 设置禁用：

```json
{
  "kfc.codex.enabled": false
}
```

## 效果对比

### 禁用前
```
📁 bubble-sort
  📄 requirements  [右键菜单: Review Requirements]
  📄 design        [右键菜单: Review Design]
  📄 tasks
```

### 禁用后
```
📁 bubble-sort
  📄 requirements  [普通文档，无特殊菜单]
  📄 design        [普通文档，无特殊菜单]
  📄 tasks
```

## 重新启用

如果以后想重新启用 Codex，只需：

1. 将 `isCodexAvailable()` 改回 `return !!this.codexOrchestrator;`
2. 配置 MCP 服务器（参考 [CODEX_SETUP.md](./CODEX_SETUP.md)）
3. 重新编译安装

## 注意事项

- ✅ 禁用 Codex **不影响** Spec 的基本功能（创建、查看、导航、编辑）
- ✅ 禁用后可以减少扩展启动时间
- ✅ Sam 功能完全不受影响
- ⚠️ 禁用后无法使用深度分析功能

---

**相关文档**：
- [Codex 配置指南](./CODEX_SETUP.md)
- [架构文档](./codex-architecture.md)
