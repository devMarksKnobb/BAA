# notoob v1 -- 完整实施方案

> Notion 导出 zip → Obsidian Vault 迁移 CLI 工具

---

## 1. 项目场景

**目标用户**：拥有大量 Notion 笔记，希望完整迁移到 Obsidian 的个人/团队用户。

**核心痛点**：

- Notion 官方导出的 Markdown 质量差：链接断裂、嵌套页面丢失、图片引用失效
- 手动整理耗时且容易遗漏
- Notion 特有 block 类型（database、toggle、callout 等）缺少 Markdown 对应方案

**使用方式**：CLI 工具

```bash
npx notoob migrate ./notion-export.zip --output ./my-vault
```

---

## 2. 约束

| 维度 | 约束 |
|------|------|
| 输入源 | **仅** Notion 官方导出 zip（Markdown & CSV 格式），不接 API |
| 输出格式 | 标准 Markdown + Obsidian 语法（`[[wikilink]]`、YAML frontmatter） |
| 链接模式 | v1 只做 `[[wikilink]]`，不支持 relative path 模式 |
| 图片/附件 | 写入 `attachments/<8-char-hash>/原文件名`，内容哈希分桶 |
| 保真策略 | **尽力保真 + 显式降级报告**，不承诺"无损" |
| 体量目标 | v1 支持 2GB zip，流式解压 + 临时落盘 + 顺序写入，Graph 仅常驻元数据和内容引用 |
| 增量迁移 | v1 不做 |
| Obsidian 插件 | v1 不做 |
| 技术栈 | TypeScript / Node.js >= 20 / ESM |

---

## 3. 架构

### 3.1 流水线

```
ZIP ──→ ZipReader ──→ Normalizer ──→ GraphLinker ──→ Transformer ──→ Writer ──→ Reporter
          │              │               │               │             │           │
       流式解压      提取ID/分类      建链接边表      内容转换       写磁盘     生成报告
       zip-slip     建节点注册表     标记断链        重写链接                  json+md
        防护        双轨ID匹配     锚点解析        处理block
```

**核心原则**：

1. **Graph 是唯一真相** -- 每个 stage 读写 `MigrationGraph`，只有 Writer 产生 vault 磁盘副作用
2. **降级是一等公民** -- 每个 node 携带 `degradations[]`，任何信息丢失都被追踪
3. **确定性输出** -- 排序写入、排序 frontmatter key、LF 换行，保证幂等
4. **AST 做链接、正则做 HTML** -- mdast 提取/重写链接，HTML 片段（callout/toggle）用正则
5. **大内容不常驻内存** -- Markdown、CSV、附件正文优先以 `ContentRef` 指向内存块或临时文件，避免 Graph 同时持有原文和转换后正文

### 3.2 数据模型（MigrationGraph）

```typescript
// ===== 顶层图 =====
interface MigrationGraph {
  meta: {
    sourceZip: string;
    exportDate: string | null;
    startedAt: string; // ISO8601
    tempDir: string;
    nodeCount: number;
  };
  nodes: Map<string, PageNode | DatabaseNode | DatabaseRowNode | AttachmentNode | UnresolvedRef>;
  edges: LinkEdge[];
  headingAnchors: Map<string, HeadingAnchor[]>; // pageId -> anchors
}

interface ContentRef {
  kind: "memory" | "temp-file";
  value: string;                 // memory 内容或 temp file 绝对路径
  byteSize: number;
}

// ===== 节点类型 =====
interface PageNode {
  kind: "page";
  notionId: string | null;       // 可能提取不到
  compositeKey: string;          // 父路径+清洗文件名，作为 fallback key
  originalPath: string;
  cleanName: string;
  targetPath: string;
  wikilinkTarget: string;        // Vault 内唯一链接目标，不带 .md
  parentId: string | null;
  sourceRef: ContentRef;
  transformedRef: ContentRef | null;
  frontmatter: Record<string, unknown>;
  degradations: Degradation[];
}

interface DatabaseNode {
  kind: "database";
  notionId: string | null;
  compositeKey: string;
  originalPath: string;
  cleanName: string;
  targetPath: string;
  parentId: string | null;
  columns: ColumnDef[];
  rowCount: number;
  rowIds: string[];
  indexTargetPath: string;
  degradations: Degradation[];
}

interface DatabaseRowNode {
  kind: "database-row";
  notionId: string | null;
  compositeKey: string;
  originalPath: string;          // CSV 行来源，格式如 db.csv#row-12
  cleanName: string;
  targetPath: string;
  wikilinkTarget: string;
  parentDatabaseId: string;
  properties: Record<string, unknown>;
  bodyRef: ContentRef | null;    // 行内正文或关联 md 页面内容
  frontmatter: Record<string, unknown>;
  degradations: Degradation[];
}

interface AttachmentNode {
  kind: "attachment";
  originalPath: string;
  stagedPath: string;            // temp file，Normalizer 阶段写入
  contentHash: string;           // SHA-256 全文
  bucketPath: string;            // attachments/<8-char>/<原文件名>
  canonicalName: string;         // 去重后的最终文件名
  size: number;
  referencedBy: string[];
}

interface UnresolvedRef {
  kind: "unresolved";
  originalHref: string;
  context: string;               // 出现在哪个页面的哪一行
  reason: "no-id-match" | "no-path-match" | "missing-file";
}

// ===== 边和辅助类型 =====
interface LinkEdge {
  fromId: string;
  toId: string | null;           // null = 断链
  originalHref: string;
  rewrittenHref: string | null;
  type: "page-link" | "attachment" | "external" | "anchor";
}

interface HeadingAnchor {
  pageId: string;
  slug: string;                  // github-style slug
  originalText: string;
}

interface ColumnDef {
  name: string;
  notionType: "text" | "number" | "date" | "select" | "multi_select"
    | "checkbox" | "url" | "email" | "phone" | "relation"
    | "rollup" | "formula" | "file" | "person" | "unknown";
  inferred: boolean;
}

interface Degradation {
  tag: string;                   // e.g. "DEGRADED:relation-property"
  message: string;
  location: string;
  severity: "info" | "warning" | "error";
}
```

### 3.3 ID 提取：双轨匹配

Notion 导出 zip 中文件名尾部的 32 位 hex ID 不总是存在或可靠，因此采用双轨策略：

```
解析优先级：
1. 文件名尾部 32 位 hex → notionId（覆盖 ~90%）
2. 无 ID 时 → compositeKey = "父目录路径/清洗后文件名"
3. 链接匹配：先查 notionId 注册表，miss 后查 compositeKey/path/title 候选表
4. 仍未匹配 → 创建 UnresolvedRef 节点，写入 degradation
```

---

## 4. 功能模块

### 4.1 目录结构

```
notoob/
  package.json
  tsconfig.json
  vitest.config.ts
  .gitignore
  README.md
  SPEC.md              # 本文件

  src/
    index.ts           # CLI 入口
    cli.ts             # commander 参数解析
    pipeline.ts        # 流水线编排

    types/
      graph.ts         # MigrationGraph 及所有节点/边类型
      config.ts        # CLI 选项 / 迁移配置
      degradation.ts   # Degradation 类型、severity、tag 常量

    stages/
      zip-reader.ts    # Stage 1: 流式解压，zip-slip 防护
      normalizer.ts    # Stage 2: 文件分类、ID 提取、注册表构建
      graph-linker.ts  # Stage 3: 链接解析、边构建、断链标记
      transformer.ts   # Stage 4: 编排所有 transform
      writer.ts        # Stage 5: 确定性文件写入
      reporter.ts      # Stage 6: json + md 报告生成

    transforms/
      link-rewriter.ts
      callout-converter.ts
      toggle-converter.ts
      embed-converter.ts       # 降级输出：callout + 链接
      synced-block-expander.ts
      attachment-path.ts
      frontmatter-builder.ts   # 含 _notion_types 元数据

    utils/
      notion-id.ts     # ID 正则提取、compositeKey 生成
      path-utils.ts    # slug、冲突检测、NFC 规范化、截断
      csv-parser.ts    # CSV 解析 + 类型推断
      markdown-links.ts # mdast 链接提取/重写
      hash.ts          # SHA-256 工具

  tests/
    fixtures/
      minimal-export.zip    # 3 页面, 1 DB, 1 图片
      complex-export.zip    # 嵌套 DB, embed, synced block, 断链
      edge-cases.zip        # 超长路径, Unicode, 空页面, 无 ID 文件

    unit/
      notion-id.test.ts
      csv-parser.test.ts
      link-rewriter.test.ts
      callout-converter.test.ts
      toggle-converter.test.ts
      frontmatter-builder.test.ts
      path-utils.test.ts
      hash.test.ts

    integration/
      pipeline.test.ts
      idempotency.test.ts
      link-regression.test.ts
      database-pages.test.ts

    e2e/
      cli.test.ts
```

### 4.2 Stage 详细接口

#### Stage 1: ZipReader

```
输入: zip 文件路径 (string)
输出: AsyncIterable<ZipEntry>

职责:
- 流式解压（fflate）
- archive entry 防护: entry 名包含绝对路径或 `..` 穿越片段时跳过 + 报告
- zip-bomb 检测: 解压总大小 > zip 体积 100x 时警告（不阻断）
```

#### Stage 2: Normalizer

```
输入: AsyncIterable<ZipEntry>
输出: MigrationGraph（nodes 已填充，edges 为空，targetPaths 未设）

职责:
- 从文件名提取 notionId（正则: / ([a-f0-9]{32})(\.\w+)?$/）
- 无 ID 时生成 compositeKey
- 文件分类: .md → PageNode, .csv → DatabaseNode, 其余 → AttachmentNode
- 解析 CSV header，推断列类型
- Markdown/CSV 小文件可留内存，大文件写入 tempDir，Graph 仅保留 ContentRef
- 附件在此阶段流式写入 tempDir，并同步计算 SHA-256
- 从目录嵌套推断 parent-child
- 所有文件名经 NFC 规范化
```

#### Stage 3: GraphLinker

```
输入: MigrationGraph（from Normalizer）
输出: MigrationGraph（edges 已填充，断链已标记）

职责:
- 遍历每个 PageNode.sourceRef
- 用 mdast 解析所有 [text](href) 和 ![alt](src)
- URL decode href → 匹配 notionId 注册表 → miss 后查 compositeKey/path/title 候选表
- 创建 LinkEdge（page-link / attachment / external / anchor）
- 提取 heading anchors（github-style slug）
- 不可解析的链接 → UnresolvedRef + Degradation
```

#### Stage 4: Transformer

```
输入: MigrationGraph（fully linked）
输出: MigrationGraph（targetPaths / wikilinkTargets 已设，PageNode.transformedRef 已填充）

子转换器（顺序执行，每个: markdown → markdown）:
  1. LinkRewriter       → [text](notion-href) → [[PageName]] 或 [[PageName#anchor]]
  2. CalloutConverter   → <aside> → > [!note] / > [!warning]
  3. ToggleConverter    → <details><summary> → > [!faq]- 标题
  4. EmbedConverter     → 降级: > [!info] Notion Embed\n> 原始链接: [url](url)
  5. SyncedBlockExpander → 展开内容 + <!-- synced-block:source-id -->
  6. AttachmentPathRewriter → 图片/文件引用 → ![[attachments/a1b2c3d4/file.png]]

其他职责:
  - 为每个 node 计算 targetPath（clean name + 层级 + 冲突消解）
  - 为 PageNode / DatabaseRowNode 计算唯一 `wikilinkTarget`；重名时升级为 `[[folder/name]]`
  - 为 AttachmentNode 计算 bucketPath + canonicalName
  - 为 database 行生成 DatabaseRowNode + frontmatter（含 _notion_types 元数据块）
  - 为每个 DatabaseNode 生成 _index.md 内容
  - 路径冲突: 同名 → 追加短哈希后缀 name-a1b2.md
```

#### Stage 5: Writer

```
输入: MigrationGraph（fully transformed）
输出: 磁盘文件

职责:
- 目标目录非空 → 报错退出（exit code 1），除非 --force
- --force: 覆写已有文件，不删除不属于本次迁移的文件
- 所有最终输出路径 resolve 后必须仍位于输出目录内，否则中止并报错
- mkdir -p 目录树
- PageNode / DatabaseRowNode: frontmatter + transformedRef/bodyRef → targetPath
- AttachmentNode: stagedPath → 最终 bucketPath（同 contentHash 只写一次）
- DatabaseNode: _index.md → indexTargetPath
- 排序写入（确定性）
- LF 换行统一
```

#### Stage 6: Reporter

```
输入: MigrationGraph（post-transform） + WriteResult | DryRunPlan
输出: report.json + report.md → 输出目录根部

report.json 结构:
{
  summary: { pages, databases, databaseRows, attachments, totalTime, outputSizeBytes },
  execution: { mode: "write" | "dry-run", filesWritten: number },
  degradations: [ { tag, count, severity, samples: [...] } ],
  unresolvedLinks: [ { href, context, reason } ],
  treeHash: { basis: "written-tree" | "planned-output", value: "sha256-..." }
}

report.md: 人类可读版本，同等信息；dry-run 明确标注 "未写文件，hash 基于计划输出"
```

---

## 5. Block 转换映射表

| Notion Block | Obsidian 输出 | 状态 |
|---|---|---|
| Page 内部链接 | `[[页面名]]`，重名时 `[[目录/页面名]]` | 必做 |
| 子页面 | 子文件夹 + `[[wikilink]]` | 必做 |
| Image（zip 内） | `![[attachments/a1b2c3d4/image.png]]` | 必做 |
| Image（外链） | 保留外链 `![alt](url)` | 必做，标记 `INFO:external-image` |
| File 附件 | `[[attachments/a1b2c3d4/file.pdf]]` | 必做 |
| Callout（aside） | `> [!note]` / `> [!warning]` 等 | 必做 |
| Toggle（details） | `> [!faq]- 标题` | 必做 |
| Code block | ` ```lang ``` ` | 必做 |
| Equation | `$$LaTeX$$` | 必做 |
| Database | 每行 → md + frontmatter + `_index.md` | 必做 |
| Bookmark | `[标题](url)` | 必做 |
| Embed | 降级: callout + 原始链接 | 降级，`DEGRADED:embed-to-link` |
| Synced block | 展开内容 + `<!-- synced-block:id -->` | 降级，`DEGRADED:synced-expanded` |
| Relation 属性 | 文本值 + `_notion_types` 注解 | 降级，`DEGRADED:relation-property` |
| Rollup 属性 | 文本值 + 注解 | 降级，`DEGRADED:rollup-flat` |
| Formula 属性 | 文本值 + 注解 | 降级，`DEGRADED:formula-flat` |
| Database views | 不保留 | 降级，`DEGRADED:db-views-lost` |
| 颜色/高亮 | 剥离为纯文本 | 降级，`DEGRADED:color-stripped` |
| 表格内嵌图片 | 丢失 | 降级，`DEGRADED:table-inline-media` |

---

## 6. 附件完整方案

```
目录策略:   attachments/<SHA-256 前 8 字符>/<原文件名>
哈希依据:   文件内容（非路径），确保相同内容同桶
预处理:     Normalizer 阶段流式写入 tempDir，同时计算 hash，不在 Graph 中存二进制
去重规则:   相同 contentHash → 复用首个 canonicalName，后续引用指向同一路径
文件名冲突: 同桶不同内容同名 → 追加 -1, -2 后缀
写入方式:   Writer 从 stagedPath 复制/移动到最终 bucketPath；同 hash 只写一次
引用格式:   ![[attachments/a1b2c3d4/image.png]]
```

---

## 7. 输出冲突策略

```
默认行为:  目标目录非空 → 报错退出 exit code 1
--force:   覆写已有文件，不删除目标目录中不属于本次迁移的文件
路径冲突:  多个 Notion 页面映射到同一 targetPath → 追加短哈希后缀 name-a1b2.md
```

---

## 8. 安全防护

```
archive 穿越: zip entry 名出现绝对路径或 `..` 片段时在 ZipReader 直接拒绝
输出越界:     Writer 对 targetPath/bucketPath 再做一次 resolve 校验，越界即报错退出
zip-bomb:     解压后总大小 > zip 体积 100x 时输出警告（不阻断）
Unicode:      所有文件名经 NFC 规范化（String.prototype.normalize('NFC')）
路径长度:     超过 200 字符的文件名截断到 200 + 短哈希后缀，避免文件系统限制
```

---

## 9. CLI 接口

```bash
notoob migrate <input.zip> --output <dir> [options]

Options:
  --output, -o <dir>    输出目录（必填）
  --force               目标非空时覆写
  --dry-run             跑完流水线但不写 vault 文件，输出 planned report
  --verbose             输出 debug 级别日志到 stderr
  --help                帮助信息

Exit codes:
  0  成功
  1  错误（输入不存在、目标非空未 --force、致命解析错误）
```

---

## 10. Database 输出策略

### 每条记录 → 独立 Markdown 页面

```yaml
---
title: "Meeting Notes"
date: "2024-03-15"
tags: ["work", "weekly"]
status: "In Progress"
related: "[[Other Page]]"
budget_rollup: "15000"
_notion_types:
  date: "date"
  tags: "multi_select"
  status: "select"
  related: "relation"
  budget_rollup: "rollup"
---

（记录内容，如有）
```

### 索引页 `_index.md`

```markdown
# Database Name

| Title | Date | Status |
|-------|------|--------|
| [[Meeting Notes]] | 2024-03-15 | In Progress |
| [[Sprint Review]] | 2024-03-22 | Done |

<!-- dataview
```dataview
TABLE date, status, tags
FROM "path/to/this/database"
SORT date DESC
``` -->
```

---

## 11. 测试策略

### 11.1 单元测试

- [ ] `notion-id.ts`: 带空格/Unicode/嵌套路径/无 ID 文件名的 ID 提取
- [ ] `csv-parser.ts`: 引号内逗号、多行单元格、空值、Unicode、BOM
- [ ] `path-utils.ts`: slug 冲突 (Page, Page-1, Page-2)、桶路径、截断、NFC
- [ ] `path-utils.ts`: 重名页面的唯一 wikilinkTarget（`[[Page]]` vs `[[Folder/Page]]`）
- [ ] `hash.ts`: 空文件、大文件、二进制文件的 SHA-256
- [ ] `attachment staging`: hash 计算、canonicalName、同 hash 去重、temp file 清理
- [ ] 每个 transform: 至少 3 组 before/after markdown 对

### 11.2 链接回归测试

- [ ] 简单页面链接: `[text](Other%20Page%20abc123def456.md)` → `[[Other Page]]`
- [ ] 跨目录链接
- [ ] 父目录链接
- [ ] 带锚点: `[text](Page%20abc123.md#heading)` → `[[Page#heading]]`
- [ ] 附件链接: `![img](media/image%20abc123.png)` → `![[attachments/a1b2c3d4/image.png]]`
- [ ] 断链（目标不在 zip 中）: 保留原链接 + degradation
- [ ] 外部 URL: 不改动
- [ ] URL 编码字符: `%20`, `%28`, `%29`
- [ ] 自引用链接
- [ ] 无 notionId 的链接 → compositeKey 匹配
- [ ] 重名页面链接 → 自动升级为 `[[目录/页面名]]`

### 11.3 幂等性测试

- [ ] 同输入两次运行，输出 SHA-256 一致
- [ ] 文件输出顺序确定（排序）
- [ ] frontmatter key 顺序确定（字母序）
- [ ] LF 换行统一
- [ ] dry-run 的 planned treeHash 与真实写出后的 written treeHash 一致

### 11.4 容错测试

- [ ] 损坏的 zip entry: 跳过 + 报告，继续
- [ ] 空 markdown 文件: 创建文件 + info 日志
- [ ] 无行 CSV: 创建空索引，无子页面
- [ ] CSV 列数不一致: 尽力解析 + warning
- [ ] 纯 UUID 文件名（无人类名称）: 使用 "Untitled-<短ID>"
- [ ] UUID 去除后重名: 冲突后缀 (name, name-1, name-2)
- [ ] 缺失附件引用: 断链报告
- [ ] zip 无顶层目录: 兼容 flat 和 nested
- [ ] 超长文件名 (>200 字符): 确定性截断
- [ ] zip-slip 攻击路径: 跳过 + 报告
- [ ] archive entry 含 `../` 或绝对路径: ZipReader 直接拒绝
- [ ] Unicode NFC/NFD 冲突: 统一 NFC
- [ ] 大 markdown/附件触发 tempDir 落盘，不因双份正文驻留导致内存暴涨

### 11.5 E2E / CLI 测试

- [ ] `notoob migrate input.zip -o ./vault` 产出预期目录树
- [ ] `--dry-run` 产出报告但不写文件
- [ ] `--dry-run` 的 report.json 标记 `execution.mode = "dry-run"`
- [ ] `--verbose` 输出 debug 到 stderr
- [ ] 输入文件不存在: exit code 1 + 错误信息
- [ ] 目标目录非空: exit code 1（无 --force）
- [ ] `--force` 覆写已有文件

---

## 12. 技术栈

| 关注点 | 选择 | 理由 |
|--------|------|------|
| 运行时 | Node >= 20 | 原生 crypto、ReadableStream、ESM 稳定 |
| 语言 | TypeScript 5.x strict | 图模型需要类型安全 |
| 模块 | ESM (`"type": "module"`) | 现代 Node 标准 |
| CLI | `commander` ^12 | 轻量、稳定、类型完善 |
| Zip | `fflate` | 纯 JS、流式、零原生依赖 |
| CSV | 手写 (~80 行) | Notion CSV 简单，避免额外依赖 |
| Markdown | `mdast-util-from-markdown` + `mdast-util-to-markdown` | AST 链接提取比正则可靠 |
| YAML | `yaml` (npm) | frontmatter 序列化 |
| 哈希 | Node `crypto.createHash` | 零依赖 |
| 测试 | `vitest` | 快、ESM 原生、快照支持 |
| 构建 | `tsup` | CLI 分发，CJS+ESM 双输出 |
| CI | GitHub Actions | Node 20, 22 矩阵 |

**生产依赖目标: < 10 个直接依赖**

---

## 13. 开发里程碑

| 阶段 | 天数 | 交付物 |
|------|------|--------|
| **Phase 1: 基础** | Day 1-3 | 项目初始化、类型定义、notion-id（双轨）、path-utils、csv-parser、hash，配套单元测试 |
| **Phase 2: 管线骨架** | Day 4-8 | ZipReader（含 zip-slip 防护）→ Normalizer → GraphLinker，能从 zip 建出完整链接图 |
| **Phase 3: 转换器** | Day 9-16 | 6 个 transform + frontmatter-builder + _index.md 生成，配套单元测试 |
| **Phase 4: 输出** | Day 17-21 | Writer（流式附件写入）+ Reporter（json+md）+ 幂等性测试 |
| **Phase 5: CLI + 容错** | Day 22-27 | commander 集成、--dry-run、--force、冲突策略、边界 case 容错、E2E 测试 |
| **Phase 6: 收尾** | Day 28-30 | README、CI 配置、真实 Notion 导出样本验证、最终调优 |

---

## 14. 显式降级清单

| Notion 特性 | v1 行为 | 报告标签 |
|---|---|---|
| Relation 属性 | 导出为原始文本/ID，报告不可解析 | `DEGRADED:relation-property` |
| Rollup 属性 | 保留计算后文本值 | `DEGRADED:rollup-flat` |
| Formula 属性 | 保留计算后文本值 | `DEGRADED:formula-flat` |
| Database views/filters/sorts | 不保留 | `DEGRADED:db-views-lost` |
| 颜色文字/高亮 | 剥离为纯文本 | `DEGRADED:color-stripped` |
| 表格内嵌图片 | 丢失（Notion CSV 限制） | `DEGRADED:table-inline-media` |
| 外部图片嵌入 | 保留链接，不下载 | `INFO:external-image` |
| Embed/iframe | 降级为 callout + 链接 | `DEGRADED:embed-to-link` |
| Synced block | 展开内容，不保持同步 | `DEGRADED:synced-expanded` |
| 子页面在表格内 | 扁平化为文本 | `DEGRADED:nested-page-in-cell` |

---

## 15. v1 明确不做

- Notion API 接入
- 增量/差量迁移
- Obsidian 插件封装
- 反向迁移（Obsidian → Notion）
- Notion 评论/讨论
- 页面历史/版本
- 权限/共享元数据
- `--link-style relative` 模式

---

## 16. v2 展望（仅记录，不承诺）

- Notion API 补全（补齐 zip 缺失信息）
- 增量迁移
- `--link-style relative` 模式
- 更强的 database 语义映射
- Obsidian 社区插件封装
- 并发写入 + 大体量优化
