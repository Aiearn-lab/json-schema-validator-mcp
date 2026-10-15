/**
 * json-schema-validator-mcp 自测脚本
 * 知微工作室 · Zhiwei Studio · 2026-10-15
 * 运行：node test.js
 */

/* ===== 复制核心函数 ===== */

function getJsonType(val) {
  if (val === null) return "null";
  if (Array.isArray(val)) return "array";
  return typeof val;
}

function validate(data, schema, path, errors) {
  if (!schema || typeof schema !== "object") return;
  if (Array.isArray(schema.enum)) {
    const match = schema.enum.some(v => JSON.stringify(v) === JSON.stringify(data));
    if (!match) errors.push({ path, message: `值 ${JSON.stringify(data)} 不在允许列表 ${JSON.stringify(schema.enum)} 中` });
  }
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = getJsonType(data);
    if (!types.includes(actual)) { errors.push({ path, message: `期望类型 ${types.join("|")}，实际为 ${actual}` }); return; }
  }
  if (typeof data === "number") {
    if (schema.minimum !== undefined && data < schema.minimum) errors.push({ path, message: `值 ${data} 小于最小值 ${schema.minimum}` });
    if (schema.maximum !== undefined && data > schema.maximum) errors.push({ path, message: `值 ${data} 大于最大值 ${schema.maximum}` });
  }
  if (typeof data === "string") {
    if (schema.minLength !== undefined && data.length < schema.minLength) errors.push({ path, message: `字符串长度 ${data.length} 小于最小长度 ${schema.minLength}` });
    if (schema.maxLength !== undefined && data.length > schema.maxLength) errors.push({ path, message: `字符串长度 ${data.length} 大于最大长度 ${schema.maxLength}` });
    if (schema.pattern !== undefined) { try { if (!new RegExp(schema.pattern).test(data)) errors.push({ path, message: `字符串不匹配模式 /${schema.pattern}/` }); } catch (e) { errors.push({ path, message: `正则模式语法错误` }); } }
  }
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    if (Array.isArray(schema.required)) { for (const key of schema.required) { if (!(key in data)) errors.push({ path, message: `缺少必需属性 "${key}"` }); } }
    if (schema.properties) { for (const [key, propSchema] of Object.entries(schema.properties)) { if (key in data) validate(data[key], propSchema, `${path}.${key}`, errors); } }
    if (schema.additionalProperties === false && schema.properties) { const allowed = new Set(Object.keys(schema.properties)); for (const key of Object.keys(data)) { if (!allowed.has(key)) errors.push({ path, message: `不允许额外属性 "${key}"` }); } }
  }
  if (Array.isArray(data) && schema.items) { data.forEach((item, i) => { validate(item, schema.items, `${path}[${i}]`, errors); }); }
}

function runValidate(data, schema) {
  const errors = [];
  validate(data, schema, "$", errors);
  return { valid: errors.length === 0, errorCount: errors.length, errors };
}

/* ===== 测试框架 ===== */

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) { console.log(`  ✓ ${msg}`); passed++; } else { console.error(`  ✗ ${msg}`); failed++; } }

/* ===== 测试用例 ===== */

// [1] type 验证
console.log("\n[1] type 验证");
{
  assert(runValidate("hello", { type: "string" }).valid, "字符串通过 string 类型");
  assert(!runValidate(123, { type: "string" }).valid, "数字不通过 string 类型");
  assert(runValidate(42, { type: "number" }).valid, "数字通过 number 类型");
  assert(runValidate(true, { type: "boolean" }).valid, "布尔通过 boolean 类型");
  assert(runValidate(null, { type: "null" }).valid, "null 通过 null 类型");
}

// [2] required 验证
console.log("\n[2] required 验证");
{
  const schema = { type: "object", required: ["name", "age"] };
  assert(runValidate({ name: "Alice", age: 30 }, schema).valid, "含所有必需属性 → 通过");
  const r = runValidate({ name: "Alice" }, schema);
  assert(!r.valid, "缺少 age → 不通过");
  assert(r.errors.some(e => e.message.includes('"age"')), "错误信息包含 'age'");
}

// [3] 嵌套对象错误路径
console.log("\n[3] 嵌套对象错误路径");
{
  const schema = {
    type: "object",
    properties: {
      user: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number", minimum: 0 },
        },
      },
    },
  };
  const r = runValidate({ user: { name: "Alice", age: -1 } }, schema);
  assert(!r.valid, "嵌套 age=-1 不通过");
  assert(r.errors[0].path === "$.user.age", `错误路径为 $.user.age（实际 ${r.errors[0].path}）`);
}

// [4] enum 验证
console.log("\n[4] enum 验证");
{
  const schema = { enum: ["red", "green", "blue"] };
  assert(runValidate("red", schema).valid, "red 在 enum 中");
  assert(!runValidate("yellow", schema).valid, "yellow 不在 enum 中");
}

// [5] minimum / maximum
console.log("\n[5] minimum / maximum");
{
  const schema = { type: "number", minimum: 0, maximum: 100 };
  assert(runValidate(50, schema).valid, "50 在 [0,100] 内");
  assert(!runValidate(-1, schema).valid, "-1 小于 minimum");
  assert(!runValidate(101, schema).valid, "101 大于 maximum");
  assert(runValidate(0, schema).valid, "0 等于 minimum，通过");
  assert(runValidate(100, schema).valid, "100 等于 maximum，通过");
}

// [6] items（数组元素验证 + 路径含索引）
console.log("\n[6] items 数组验证");
{
  const schema = { type: "array", items: { type: "number", minimum: 0 } };
  assert(runValidate([1, 2, 3], schema).valid, "[1,2,3] 全部合法");
  const r = runValidate([1, -2, 3], schema);
  assert(!r.valid, "[1,-2,3] 第二个元素不合法");
  assert(r.errors[0].path === "$[1]", `错误路径为 $[1]（实际 ${r.errors[0].path}）`);
}

// [7] 深层嵌套路径
console.log("\n[7] 深层嵌套路径 $.users[0].tags[2]");
{
  const schema = {
    type: "object",
    properties: {
      users: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tags: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  };
  const r = runValidate({ users: [{ tags: ["a", "b", 123] }] }, schema);
  assert(!r.valid, "tags[2]=123 不是字符串");
  assert(r.errors[0].path === "$.users[0].tags[2]", `路径为 $.users[0].tags[2]（实际 ${r.errors[0].path}）`);
}

// [8] 中文数据
console.log("\n[8] 中文数据验证");
{
  const schema = {
    type: "object",
    required: ["姓名"],
    properties: {
      姓名: { type: "string", minLength: 2 },
      年龄: { type: "number", minimum: 0, maximum: 150 },
    },
  };
  assert(runValidate({ 姓名: "张三", 年龄: 30 }, schema).valid, "中文属性名验证通过");
  const r = runValidate({ 姓名: "张" }, schema);
  assert(!r.valid, "中文姓名长度不足");
  assert(r.errors.some(e => e.path === "$.姓名"), "错误路径包含中文属性名");
}

// [9] additionalProperties
console.log("\n[9] additionalProperties: false");
{
  const schema = {
    type: "object",
    properties: { name: { type: "string" } },
    additionalProperties: false,
  };
  assert(runValidate({ name: "Alice" }, schema).valid, "无额外属性 → 通过");
  const r = runValidate({ name: "Alice", extra: 1 }, schema);
  assert(!r.valid, "含额外属性 → 不通过");
  assert(r.errors[0].message.includes("extra"), "错误信息包含额外属性名");
}

// [10] minLength / maxLength / pattern
console.log("\n[10] 字符串约束");
{
  const schema = { type: "string", minLength: 3, maxLength: 10, pattern: "^[a-z]+$" };
  assert(runValidate("hello", schema).valid, "hello 满足所有约束");
  assert(!runValidate("ab", schema).valid, "ab 长度不足");
  assert(!runValidate("Hello", schema).valid, "Hello 不匹配 ^[a-z]+$");
}

// [11] 空 schema 允许一切
console.log("\n[11] 空 schema");
{
  assert(runValidate("anything", {}).valid, "空 schema 允许字符串");
  assert(runValidate(42, {}).valid, "空 schema 允许数字");
  assert(runValidate(null, {}).valid, "空 schema 允许 null");
}

// 汇总
console.log(`\n========== 结果 ==========`);
console.log(`通过: ${passed}  失败: ${failed}`);
if (failed > 0) { console.error("有测试失败！"); process.exit(1); }
else { console.log("全部通过 ✓"); }
