#!/usr/bin/env node
/**
 * json-schema-validator-mcp — JSON Schema 子集验证工具
 * 知微工作室 · Zhiwei Studio · 2026-10-15 · v1.0.0
 *
 * 提供 1 个工具：
 *   validate_json  输入 data + schema（JSON Schema 子集），返回是否合法；
 *                  不合法时给出 JSONPath 错误路径（如 $.user.tags[0]）与原因
 *
 * 支持的 Schema 关键字：
 *   type / required / properties / additionalProperties /
 *   items / enum / minimum / maximum / minLength / maxLength / pattern
 *
 * 设计原则：
 *   - 零第三方依赖（验证逻辑全部原生实现，仅依赖 MCP SDK）
 *   - 错误路径使用 JSONPath 格式（$.foo.bar[0].baz）
 *   - 不存储、不硬编码任何凭证
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

/* ===== JSON Schema 子集验证器（纯原生实现） ===== */

/**
 * 递归验证 data 是否符合 schema
 * @param {*} data       待验证数据
 * @param {object} schema JSON Schema（子集）
 * @param {string} path   当前 JSONPath
 * @param {Array} errors  错误收集器
 */
function validate(data, schema, path, errors) {
  if (!schema || typeof schema !== "object") return;

  // ---- enum ----
  if (Array.isArray(schema.enum)) {
    const match = schema.enum.some(v => JSON.stringify(v) === JSON.stringify(data));
    if (!match) {
      errors.push({ path, message: `值 ${JSON.stringify(data)} 不在允许列表 ${JSON.stringify(schema.enum)} 中` });
    }
  }

  // ---- type ----
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = getJsonType(data);
    if (!types.includes(actual)) {
      errors.push({ path, message: `期望类型 ${types.join("|")}，实际为 ${actual}` });
      return; // 类型不匹配，后续检查无意义
    }
  }

  // ---- 数值约束 ----
  if (typeof data === "number") {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push({ path, message: `值 ${data} 小于最小值 ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push({ path, message: `值 ${data} 大于最大值 ${schema.maximum}` });
    }
  }

  // ---- 字符串约束 ----
  if (typeof data === "string") {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push({ path, message: `字符串长度 ${data.length} 小于最小长度 ${schema.minLength}` });
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push({ path, message: `字符串长度 ${data.length} 大于最大长度 ${schema.maxLength}` });
    }
    if (schema.pattern !== undefined) {
      try {
        const re = new RegExp(schema.pattern);
        if (!re.test(data)) {
          errors.push({ path, message: `字符串不匹配模式 /${schema.pattern}/` });
        }
      } catch (e) {
        errors.push({ path, message: `正则模式 /${schema.pattern}/ 语法错误: ${e.message}` });
      }
    }
  }

  // ---- 对象验证 ----
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    // required
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in data)) {
          errors.push({ path, message: `缺少必需属性 "${key}"` });
        }
      }
    }
    // properties
    if (schema.properties && typeof schema.properties === "object") {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in data) {
          validate(data[key], propSchema, `${path}.${key}`, errors);
        }
      }
    }
    // additionalProperties
    if (schema.additionalProperties === false && schema.properties) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(data)) {
        if (!allowed.has(key)) {
          errors.push({ path, message: `不允许额外属性 "${key}"` });
        }
      }
    }
  }

  // ---- 数组验证 ----
  if (Array.isArray(data) && schema.items) {
    data.forEach((item, i) => {
      validate(item, schema.items, `${path}[${i}]`, errors);
    });
  }
}

/**
 * 获取 JS 值对应的 JSON 类型名
 */
function getJsonType(val) {
  if (val === null) return "null";
  if (Array.isArray(val)) return "array";
  return typeof val; // "string" | "number" | "boolean" | "object" | "undefined"
}

/* ===== MCP Server ===== */

const server = new Server(
  { name: "json-schema-validator-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "validate_json",
      description: "验证 JSON 数据是否符合给定的 JSON Schema（子集）。支持 type / required / properties / items / enum / minimum / maximum / minLength / maxLength / pattern / additionalProperties。返回验证结果和错误详情（含 JSONPath 路径）。",
      inputSchema: {
        type: "object",
        properties: {
          data: {
            description: "待验证的 JSON 数据（任意类型）",
          },
          schema: {
            type: "object",
            description: "JSON Schema（子集），例如 {\"type\":\"object\",\"required\":[\"name\"],\"properties\":{\"name\":{\"type\":\"string\"}}}",
          },
        },
        required: ["data", "schema"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a } = req.params;
  try {
    if (name === "validate_json") {
      const errors = [];
      validate(a.data, a.schema, "$", errors);
      const result = {
        valid: errors.length === 0,
        errorCount: errors.length,
        errors,
      };
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    return { content: [{ type: "text", text: "未知工具: " + name }], isError: true };
  } catch (e) {
    return {
      content: [{ type: "text", text: "错误: " + (e && e.message ? e.message : String(e)) }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
