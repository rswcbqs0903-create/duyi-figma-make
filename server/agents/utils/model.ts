import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import { z, ZodType } from "zod";

/**
 * 多模型架构：
 * - DeepSeek: 主模型选项1（用于大部分节点）
 * - GLM: 主模型选项2（智谱 AI，支持 Function Calling）
 * - Qwen-VL: Vision 模型（仅用于图片分析）
 *
 * 通过环境变量 MAIN_MODEL_PROVIDER 切换主模型：deepseek | glm
 */

let deepseekInstance: ChatOpenAI | null = null;
let glmInstance: ChatOpenAI | null = null;
let qwenVisionInstance: ChatOpenAI | null = null;

/**
 * 获取 DeepSeek 主模型实例（用于大部分节点）
 */
export function getDeepSeekModel() {
  if (!deepseekInstance) {
    deepseekInstance = new ChatOpenAI({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      apiKey: process.env.DEEPSEEK_API_KEY,
      temperature: 0,
      maxTokens: 8192,
      configuration: {
        baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
      },
    });
  }
  return deepseekInstance;
}

/**
 * 获取 GLM 主模型实例（智谱 AI）
 * 支持 Function Calling，结构化输出能力强
 */
export function getGLMModel() {
  if (!glmInstance) {
    glmInstance = new ChatOpenAI({
      model: process.env.GLM_MODEL || "glm-4-flash",
      apiKey: process.env.GLM_API_KEY,
      temperature: 0,
      maxTokens: 8192,
      configuration: {
        baseURL:
          process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/",
      },
    });
  }
  return glmInstance;
}

/**
 * 获取 Qwen-VL Vision 模型实例（仅用于图片分析）
 * 支持图片输入和分析
 */
export function getQwenVisionModel() {
  if (!qwenVisionInstance) {
    qwenVisionInstance = new ChatOpenAI({
      model: process.env.QWEN_MODEL || "qwen-vl-max",
      apiKey: process.env.QWEN_API_KEY,
      temperature: 0.1,
      maxTokens: 32768,
      configuration: {
        baseURL:
          process.env.QWEN_BASE_URL ||
          "https://dashscope.aliyuncs.com/compatible-mode/v1",
      },
    });
  }
  return qwenVisionInstance;
}

/**
 * 获取当前配置的主模型
 * 根据环境变量 MAIN_MODEL_PROVIDER 切换：deepseek | glm
 */
export function getMainModel() {
  const provider = process.env.MAIN_MODEL_PROVIDER || "deepseek";

  switch (provider.toLowerCase()) {
    case "glm":
      console.log("[Model] Using GLM as main model");
      return getGLMModel();
    case "deepseek":
    default:
      console.log("[Model] Using DeepSeek as main model");
      return getDeepSeekModel();
  }
}

/**
 * 获取默认模型（向后兼容）
 * 使用当前配置的主模型
 */
export function getModel() {
  return getMainModel();
}

/**
 * 从模型文本中提取第一个完整 JSON 值。
 * 允许模型偶发地在 JSON 前后夹带说明文字，但不会接受残缺 JSON。
 */
function extractFirstJsonValue(text: string): string {
  const start = text.search(/[\[{]/);
  if (start === -1) {
    throw new Error("模型未返回 JSON 内容");
  }

  const opening = text[start];
  const expectedClosing = opening === "{" ? "}" : "]";
  const stack: string[] = [expectedClosing];
  let inString = false;
  let escaped = false;

  for (let i = start + 1; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") stack.push("}");
    if (char === "[") stack.push("]");

    if (char === "}" || char === "]") {
      const expected = stack.pop();
      if (char !== expected) {
        throw new Error("模型返回的 JSON 括号不匹配");
      }

      if (stack.length === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  throw new Error("模型返回的 JSON 不完整");
}

function getTextContent(message: { content: unknown }): string {
  if (typeof message.content === "string") {
    return message.content;
  }

  if (!Array.isArray(message.content)) {
    return "";
  }

  return message.content
    .map((part: unknown) => {
      if (typeof part === "string") return part;
      if (
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return part.text;
      }
      return "";
    })
    .join("");
}

/**
 * DeepSeek 的文本 JSON 模式不会自动获得 LangChain function-calling 中的 schema 信息，
 * 因此需要把 JSON Schema 显式放回上下文中，约束生成阶段而不只是事后校验。
 */
function createStructuredOutputInstruction<T extends ZodType<any>>(
  schema: T,
): SystemMessage {
  const jsonSchema = z.toJSONSchema(schema);

  return new SystemMessage(
    [
      "你必须严格按照下面的 JSON Schema 返回结果。",
      "只返回一个合法 JSON 值，不要返回 Markdown、代码块、解释文字或任何额外内容。",
      "所有 required 字段都必须提供；字段类型、数组元素类型和枚举值必须与 schema 完全一致。",
      "JSON Schema:",
      JSON.stringify(jsonSchema, null, 2),
    ].join("\n"),
  );
}

/**
 * DeepSeek 在 function calling 场景下偶发返回非标准 tool-call 参数。
 * 对 DeepSeek 统一改用“文本 JSON + 手动提取 + Zod 校验”，让所有节点共享同一层兼容逻辑。
 */
function createDeepSeekStructuredModel<T extends ZodType<any>>(schema: T) {
  const model = getDeepSeekModel();
  const structuredOutputInstruction = createStructuredOutputInstruction(schema);

  return {
    async invoke(messages: any[]) {
      // messages 可能来自 LangChain BaseMessage，也可能是 { role, content } 形式；
      // 这里不转换原消息，只追加标准 SystemMessage，保持两类输入都可继续透传。
      const response = await model.invoke([
        ...messages,
        structuredOutputInstruction,
      ]);
      const rawText = getTextContent(response);
      const jsonText = extractFirstJsonValue(rawText);
      const parsed = JSON.parse(jsonText);
      return schema.parse(parsed);
    },
  };
}

/**
 * 获取支持结构化输出的模型实例
 * - DeepSeek: 使用文本 JSON + 手动提取 + Zod 校验，规避 tool-call JSON 解析兼容问题
 * - GLM: 继续使用原生 Function Calling
 */
export function getStructuredModel<T extends ZodType<any>>(schema: T) {
  const provider = getMainModelProvider().toLowerCase();

  if (provider === "deepseek") {
    return createDeepSeekStructuredModel(schema);
  }

  const model = getMainModel();
  return model.withStructuredOutput(schema, {
    method: "functionCalling",
    includeRaw: false,
  });
}

/**
 * 获取当前主模型提供商名称
 */
export function getMainModelProvider(): string {
  return process.env.MAIN_MODEL_PROVIDER || "deepseek";
}
