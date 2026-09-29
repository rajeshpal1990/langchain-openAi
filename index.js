import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from "@langchain/core/messages";

import { tools ,executeCommandTool} from "./tools.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

/* =========================
   ENV
========================= */
const { OPENAI_API_KEY, MODEL_NAME, MAX_OUTPUT_TOKENS } = process.env;

/* =========================
   MODEL INIT
========================= */
const model = new ChatOpenAI({
  openAIApiKey: OPENAI_API_KEY,
  modelName: MODEL_NAME,
  maxTokens: Number(MAX_OUTPUT_TOKENS),
  temperature: 0.2,
  verbose: true,
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (_, res) => {
  res.json({
    status: "ok",
    model: MODEL_NAME,
    maxOutputTokens: Number(MAX_OUTPUT_TOKENS),
  });
});


app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    const SYSTEM_PROMPT = new SystemMessage(`
You are a finance assistant for a car loan system.

here is loan data 

{"otr":{"value":175000000,"confidence":0.95},"tenure":{"value":60,"confidence":0.95},"principal_loan":{"value":114100628,"confidence":0.95},"interest_rate":{"value":9.18,"confidence":0.95},"total_loan_amount":{"value":166482336,"confidence":0.95},"installment":{"value":2775000,"confidence":0.95},"dp_amount":{"value":60899372,"confidence":0.95},"tdp":{"value":74000000,"confidence":0.95},"insurance_amount":{"value":7265125,"confidence":0.95},"refund_amount":{"value":726000,"confidence":0.95},"refund_projection_ho":{"value":null,"confidence":0},"paid_to_dealer":{"value":101000000,"confidence":0.95},"all_in":{"value":null,"confidence":0},"ltv":{"value":null,"confidence":0}}

Rules:
- Answer strictly from provided context.
- Do not hallucinate missing values.
- Be concise and accurate.
- If question is out of scope, reply rudely.
`);

    // Limit + sanitize history
    const MAX_HISTORY = 6;

    const safeHistory = history
      .slice(-MAX_HISTORY)
      .filter(
        h =>
          h &&
          typeof h.content === "string" &&
          (h.role === "user" || h.role === "assistant")
      )
      .map(h =>
        h.role === "user"
          ? new HumanMessage(h.content)
          : new AIMessage(h.content)
      );

    const messages = [
      SYSTEM_PROMPT,
      ...safeHistory,
      new HumanMessage(message),
    ];

    const response = await model.invoke(messages);

    return res.json({ response: response.content });
  } catch (err) {
    console.error("Chat Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

/* =========================================================
   TOOLS CHAT
========================================================= */
app.post("/api/tools-chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    // Bind tools
    const modelWithTools = model.bindTools(tools);

    //console.log("modelWithTools",tools)

    const messages = [
      new SystemMessage(
        "You are a helpful assistant. Use tools only when required. After using tools, ALWAYS give a final answer to the user. if have to answer based on tools only"
      ),
      new HumanMessage(message),
    ];

    // Invoke model with tools
    let response = await modelWithTools.invoke(messages);

    // Create a map for easy tool lookup
    const toolsMap = Object.fromEntries(tools.map((t) => [t.name, t]));
    //console.log("toolsMap",toolsMap)

    // 🔄 Tool Execution Loop
    let iterations = 0;
    while (response.tool_calls?.length && iterations < 5) {
      iterations++;
      messages.push(response);

      for (const toolCall of response.tool_calls) {
        const tool = toolsMap[toolCall.name];
        
        let toolResult;
        try {
          if (!tool) throw new Error(`Tool "${toolCall.name}" not found.`);
          
          console.log(`🛠️ Executing: ${toolCall.name}(${JSON.stringify(toolCall.args)})`);
          toolResult = await tool.invoke(toolCall.args);
        } catch (toolErr) {
          console.error(`❌ Tool execution failed [${toolCall.name}]:`, toolErr.message);
          toolResult = `Error: Tool execution failed: ${toolErr.message}`;
        }

        messages.push(
          new ToolMessage({
            tool_call_id: toolCall.id,
            content: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult),
          })
        );
      }

      // Re-invoke model with tool results
      response = await modelWithTools.invoke(messages);
    }

    return res.json({ response: response.content });
  } catch (err) {
    console.error("🔥 Tools Chat API Error:", err);
    return res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
});


// New Web-Creator Route
app.post("/api/web-creator", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    // Bind only the executeCommandTool
    const modelWithTools = model.bindTools([executeCommandTool]);
    const messages = [
      new SystemMessage(`
You are a website builder assistant.
You can only use the tool 'executeCommand' to generate terminal commands for frontend website creation.
Give commands step by step and provide a final human-readable explanation after each.
`),
      new HumanMessage(message),
    ];

    let response = await modelWithTools.invoke(messages);

    const toolsMap = { executeCommand: executeCommandTool };
    let iterations = 0;

    while (response.tool_calls?.length && iterations < 5) {
      iterations++;
      messages.push(response);

      for (const toolCall of response.tool_calls) {
        const tool = toolsMap[toolCall.name];
        if (!tool) continue;

        const result = await tool.invoke(toolCall.args);
        messages.push(
          new ToolMessage({
            tool_call_id: toolCall.id,
            content: result,
          })
        );
      }

      response = await modelWithTools.invoke(messages);
    }

    let finalText = "";
    if (typeof response.content === "string") finalText = response.content;
    else if (Array.isArray(response.content))
      finalText = response.content.map(p => p?.text).filter(Boolean).join("\n");

    res.json({ response: finalText });
  } catch (err) {
    console.error("Web Creator Error:", err);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
});



/* =========================
   SERVER START
========================= */
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
