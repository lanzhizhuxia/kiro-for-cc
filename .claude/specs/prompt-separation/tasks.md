# Implementation Plan

## 1. 项目配置和基础设施

- [ ] 1.1 配置 Webpack 支持 Markdown 文件导入
  - 安装 `raw-loader` 依赖
  - 修改 `webpack.config.js` 添加 .md 文件处理规则
  - 创建类型声明文件支持 .md 模块导入
  - _Requirements: 1.1, 1.3_

- [ ] 1.2 安装并配置必要的依赖包
  - 安装 `gray-matter` 用于解析 frontmatter
  - 安装 `handlebars` 用于模板渲染
  - 更新 `package.json` 依赖列表
  - _Requirements: 1.1, 3.2_

## 2. 创建 Prompt 文件结构

- [ ] 2.1 创建 prompt 目录结构
  - 创建 `src/prompts/spec/` 目录
  - 创建 `src/prompts/steering/` 目录
  - 创建 `src/prompts/shared/` 目录
  - _Requirements: 1.2_

- [ ] 2.2 将现有 spec prompts 转换为 Markdown 文件
  - 创建 `spec/agent-system.md` 包含系统提示
  - 创建 `spec/requirements-refine.md`
  - 创建 `spec/design-refine.md`
  - 创建 `spec/tasks-refine.md`
  - 为每个文件添加合适的 frontmatter 元数据
  - _Requirements: 2.1, 2.2, 2.7_

- [ ] 2.3 将现有 steering prompts 转换为 Markdown 文件
  - 创建 `steering/system.md`
  - 创建 `steering/initial-product.md`
  - 创建 `steering/initial-structure.md`
  - 创建 `steering/initial-tech.md`
  - 创建 `steering/initial-custom.md`
  - 创建 `steering/refine.md`
  - _Requirements: 2.1, 2.2, 2.7_

## 3. 实现 PromptLoader 服务

- [ ] 3.1 创建类型定义
  - 创建 `src/types/prompt.types.ts`
  - 定义 `PromptTemplate` 接口
  - 定义 `PromptMetadata` 接口
  - 定义 `PromptFrontmatter` 接口
  - _Requirements: 1.3, 1.4_

- [ ] 3.2 实现 PromptLoader 核心类
  - 创建 `src/services/promptLoader.ts`
  - 实现单例模式
  - 实现 `initialize()` 方法预加载所有模板
  - 实现 `loadPrompt()` 方法解析单个模板
  - 实现 `renderPrompt()` 方法渲染模板
  - _Requirements: 3.1, 3.2_

- [ ] 3.3 实现模板缓存机制
  - 创建内存缓存存储编译后的模板
  - 在初始化时预编译所有 Handlebars 模板
  - 实现缓存查找逻辑
  - _Requirements: 3.1, 3.2_

## 4. 更新现有代码接口

- [ ] 4.1 更新 specPrompts.ts
  - 导入 PromptLoader 服务
  - 修改 `getSpecAgentSystemPrompt()` 使用 PromptLoader
  - 修改 `SPEC_REFINE_PROMPTS` 对象使用 PromptLoader
  - 保持导出接口不变
  - _Requirements: 2.4, 3.1_

- [ ] 4.2 更新 steeringPrompts.ts
  - 导入 PromptLoader 服务
  - 修改所有常量导出使用 PromptLoader
  - 修改 `formatSteeringContext()` 函数
  - 保持导出接口不变
  - _Requirements: 2.4, 3.1_

- [ ] 4.3 更新 extension.ts 初始化流程
  - 在扩展激活时调用 `PromptLoader.initialize()`
  - 处理初始化错误
  - 确保在使用前完成加载
  - _Requirements: 3.1_

## 5. 测试和验证

- [ ] 5.1 创建单元测试
  - 测试 PromptLoader 的各个方法
  - 测试 frontmatter 解析
  - 测试模板渲染和变量替换
  - 测试错误处理
  - _Requirements: 2.3, 3.3_

- [ ] 5.2 端到端功能测试
  - 测试 spec 创建流程
  - 测试 steering 文档生成
  - 验证生成的 prompt 内容正确
  - 测试多环境配置
  - _Requirements: 3.5_

- [ ] 5.3 性能和兼容性测试
  - 测试启动时间影响
  - 测试内存占用
  - 验证与现有功能的兼容性
  - _Requirements: 3.1_

## 6. 清理和优化

- [ ] 6.1 移除旧的硬编码 prompt 常量
  - 清理 specPrompts.ts 中的字符串常量
  - 清理 steeringPrompts.ts 中的字符串常量
  - 确保没有遗留的硬编码内容
  - _Requirements: 2.1_

- [ ] 6.2 代码审查和重构
  - 审查所有修改的代码
  - 优化代码结构
  - 添加必要的注释
  - 更新相关文档
  - _Requirements: 2.4_