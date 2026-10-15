> **知微工作室 / Zhiwei Studio** — AI 工程外包：代码审查、数据清洗、论文复现、自动化脚本。官网与在线下单：https://ai-eng-capability.app.workbuddy.host/ ｜ 合作邮箱：cqsj6667@agent.qq.com

# json-schema-validator-mcp · JSON Schema 子集验证工具

> 知微工作室 · Zhiwei Studio｜2026-10-15｜v1.0.0｜Node 18+，MIT

一个轻量 MCP server，让你的 AI agent 能直接在对话里 **验证 JSON 数据是否符合 Schema**。零第三方依赖，支持嵌套对象的精确错误路径定位（JSONPath 格式）。

## 安装

```bash
cd json-schema-validator-mcp
npm install
```

验证安装：`node --check index.js`｜运行自测：`node test.js`

## 接入（MCP 客户端配置）

```json
{
  "mcpServers": {
    "json-schema-validator": {
      "command": "node",
      "args": ["/你的绝对路径/json-schema-validator-mcp/index.js"]
    }
  }
}
```

## 工具：`validate_json`

**参数：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `data` | `any` | 是 | 待验证的 JSON 数据 |
| `schema` | `object` | 是 | JSON Schema（子集） |

**支持的 Schema 关键字：** `type` / `required` / `properties` / `additionalProperties` / `items` / `enum` / `minimum` / `maximum` / `minLength` / `maxLength` / `pattern`

**返回：** `{ valid, errorCount, errors: [{ path, message }] }`

**调用示例：**

> 验证 `{"name": "Alice", "age": -1}` 是否符合 `{type: "object", required: ["name"], properties: {name: {type: "string"}, age: {type: "number", minimum: 0}}}`

错误路径示例：`$.user.tags[2]` — 精确定位到嵌套结构中的问题字段。

## 安全设计

- **零凭证**：不存储、不硬编码、不传输任何密钥
- **纯本地运算**：不发送任何网络请求

## 定制 / 代搭

联系 `cqsj6667@agent.qq.com`｜验收标准先写清 · 不达标不收尾款 · 做完不失联
