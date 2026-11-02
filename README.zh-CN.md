<p align="center">
  <img src="https://img.shields.io/badge/Notion-000000?style=for-the-badge&logo=notion&logoColor=white" alt="Notion"/>
  <img src="https://img.shields.io/badge/%E2%86%92-gray?style=for-the-badge" alt="arrow"/>
  <img src="https://img.shields.io/badge/Obsidian-7C3AED?style=for-the-badge&logo=obsidian&logoColor=white" alt="Obsidian"/>
</p>

<h1 align="center">notoob</h1>

<p align="center">
  <strong>将你的 Notion 工作空间完整迁移到 Obsidian — 链接、数据库、附件，一个不落。</strong>
</p>

<p align="center">
  <a href="./README.md">English</a> | <b>中文</b>
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> &bull;
  <a href="#web-界面">Web 界面</a> &bull;
  <a href="#迁移内容">迁移内容</a> &bull;
  <a href="#架构设计">架构设计</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/license/weichaohuang1220/notoob?style=flat-square" alt="License"/>
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square&logo=node.js" alt="Node"/>
  <img src="https://img.shields.io/badge/tests-113%20passed-brightgreen?style=flat-square" alt="Tests"/>
  <img src="https://img.shields.io/badge/dependencies-6-blue?style=flat-square" alt="Deps"/>
</p>

---

## 为什么选择 notoob？

Notion 自带的导出功能生成的 Markdown 质量很差 — 链接失效、图片丢失、数据库变成难以阅读的 CSV，Callout 和折叠块等特殊格式也全部丢失。

**notoob** 解决了所有这些问题。它会将你的笔记重建为一个干净、完整链接的 Obsidian 仓库：

- `[[双向链接]]` 真正可用（不是损坏的相对路径）
- 图片和文件整理到 `attachments/` 目录，基于内容哈希分桶存储
- 数据库转换为独立页面，带 YAML frontmatter（Dataview 可查询）
- Callout、折叠块等特殊格式转换为 Obsidian 原生语法
- 自动检测嵌套 zip 导出（Notion 的多分卷格式）
- 自动发现本地 Obsidian 仓库 — 直接导入到已有仓库
- 详细的迁移报告，告诉你每一步发生了什么

## 快速开始

```bash
# 1. 克隆并安装
git clone https://github.com/weichaohuang1220/notoob.git
cd notoob && npm install

# 2. 从 Notion 导出
#    设置 → 导出所有工作空间内容 → Markdown & CSV → 下载 zip

# 3. 执行迁移
npx tsx src/index.ts migrate ./notion-export.zip -o ./my-vault

# 4. 在 Obsidian 中打开
#    打开文件夹作为仓库 → 选择 ./my-vault
```

## Web 界面

notoob 内置了可视化 Web 界面 — 拖拽上传 zip，选择目标 Obsidian 仓库，实时查看进度，浏览迁移结果。

```bash
npm run web
# 打开 http://localhost:3000
```

**功能特性：**
- 拖拽上传 zip（支持 Notion 嵌套导出，150MB+ 无压力）
- 自动发现本地 Obsidian 仓库 — 按名称搜索，直接导入
- 6 阶段实时进度追踪
- 交互式文件树，点击即可预览
- 降级项和未解析链接报告
- 模拟运行模式（不写入文件）

## 命令行参考

```
notoob migrate <input.zip> --output <dir> [选项]

选项：
  -o, --output <dir>     输出目录（必需）
  --force                覆盖已有文件
  --dry-run              仅运行流程，不写入文件
  --verbose              调试日志输出到 stderr
  -h, --help             帮助信息
```

**示例：**

```bash
# 基本迁移
npx tsx src/index.ts migrate ~/Downloads/export.zip -o ~/Vault

# 预览模式（不写入文件）
npx tsx src/index.ts migrate export.zip -o ./vault --dry-run

# 覆盖已有仓库
npx tsx src/index.ts migrate export.zip -o ./vault --force
```

## 迁移内容

| Notion 元素 | Obsidian 输出 | 状态 |
|-------------|---------------|------|
| 页面链接 | `[[页面名称]]`（自动消歧） | 完全支持 |
| 子页面 | 文件夹层级 + 双向链接 | 完全支持 |
| 图片 | `![[attachments/a1b2c3d4/image.png]]` | 完全支持 |
| 文件附件 | `[[attachments/a1b2c3d4/file.pdf]]` | 完全支持 |
| Callout | `> [!note]` / `> [!warning]` 等 | 完全支持 |
| 折叠块 | `> [!faq]- 标题`（可折叠） | 完全支持 |
| 代码块 | ` ```lang ``` ` | 完全支持 |
| 公式 | `$$LaTeX$$` | 完全支持 |
| 数据库 | 独立 md + frontmatter + 索引页 | 完全支持 |
| 书签 | `[标题](url)` | 完全支持 |
| 嵌入 | Callout + 原始链接 | 降级（已报告） |
| 同步块 | 展开内容 + 来源标记 | 降级（已报告） |
| 关联/汇总 | 文本值 + 类型标注 | 降级（已报告） |
| 颜色/高亮 | 转为纯文本 | 降级（已报告） |

> 所有降级项都会在迁移报告中记录 — 没有任何内容被静默丢弃。

## 输出结构

```
my-vault/
  Home.md                              # 页面 → Markdown 文件
  Projects.md
  Tasks/                               # 数据库 → 文件夹
    _index.md                          #   索引页（Dataview 可用）
    Fix bug.md                         #   每行一个文件
    Add feature.md
  attachments/                         # 所有媒体文件，哈希分桶
    a1b2c3d4/
      screenshot.png
  report.json                          # 机器可读报告
  report.md                            # 人类可读报告
```

## 数据库输出

每个数据库行会变成一个带类型化 YAML frontmatter 的 Markdown 文件：

```yaml
---
Due: "2024-03-15"
Name: Fix bug
Status: Done
Tags:
  - backend
  - urgent
_notion_types:
  Due: date
  Name: text
  Status: select
  Tags: multi_select
---
```

`_notion_types` 字段保留了 Notion 原始字段类型，使你的数据可以通过 [Dataview](https://github.com/blacksmithgu/obsidian-dataview) 进行查询。

## 架构设计

```
ZIP ──→ ZipReader ──→ Normalizer ──→ GraphLinker ──→ Transformer ──→ Writer ──→ Reporter
         │              │               │               │             │           │
      流式读取       提取 ID          构建链接        重写内容       写入磁盘     生成报告
      安全校验       分类文件          边表            转换格式                    
```

**核心设计决策：**

- **图作为唯一数据源** — 所有阶段读写 `MigrationGraph`，只有 Writer 接触磁盘
- **双轨 ID 匹配** — Notion ID（32位十六进制）为主，复合键（路径+标题）为备
- **内容哈希分桶附件** — 去重，避免扁平目录瓶颈
- **确定性输出** — 排序写入、排序 frontmatter 键、LF 换行 → 幂等
- **降级作为一等概念** — 每个节点携带 `degradations[]` 数组，没有静默丢失
- **嵌套 zip 自动解包** — 透明处理 Notion 的多分卷 `Part-N.zip` 导出格式

详见 [SPEC.md](./SPEC.md) 完整技术规格。

## 开发

```bash
npm test            # 运行 113 个测试
npm run test:watch  # 监听模式
npm run typecheck   # TypeScript 严格检查
npm run build       # 使用 tsup 打包
npm run web         # 启动 Web 界面
```

**技术栈：** TypeScript / Node >= 20 / ESM / fflate / commander / vitest

## Star 历史

<p align="center">
  <a href="https://star-history.com/#weichaohuang1220/notoob&Date">
    <img src="https://api.star-history.com/svg?repos=weichaohuang1220/notoob&type=Date" alt="Star History Chart" width="600"/>
  </a>
</p>

## 许可证

[MIT](./LICENSE)
