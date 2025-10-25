// examples/warp-ollama-integration-example.ts
// Demonstrates using Ollama models with Warp integration in A2A.
// Covers: running gpt-oss and mistral (7B/8B) models, monitoring GPU usage,
// and customizing behavior with temperature and system prompts.

/*
Prerequisites:
- Ollama installed and models pulled locally, e.g.:
    ollama pull gpt-oss
    ollama pull mistral
- Warp installed if you want the live terminal integration: https://www.warp.dev/
- A2A workspace set up according to the repository README.

This example follows the structure used by other examples in this repo.
*/

import { A2A } from "../src/index.js"; // adjust if examples compile by ts-node with path mapping
import { Warp } from "../src/integrations/warp.js"; // Warp terminal integration
import { OllamaProvider } from "../src/providers/ollama.js"; // Hypothetical provider path following repo patterns
import { z } from "zod";

// If the repository exposes helpers similarly to other providers, we follow that pattern.
// Fallback types to keep this example self-contained if tree-shaken during docs rendering.

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

async function main() {
  // Initialize Warp integration (optional but recommended for rich UX)
  const warp = await Warp.create({
    title: "A2A Ollama Demo",
    // Automatically open a Warp pane to stream logs and GPU usage
    openPane: true,
  });

  // Create an A2A agent/workflow with Ollama as the LLM provider
  const a2a = await A2A.create({
    integrations: [warp],
    llm: new OllamaProvider({
      // Default model (overridable per-call): gpt-oss
      model: "gpt-oss",
      // Temperature controls randomness; lower is more deterministic
      temperature: 0.2,
      // Optional base URL if Ollama runs on a remote host
      // baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      // You can also set a system prompt here for global behavior
      system: "You are a concise assistant that provides actionable, accurate answers.",
    }),
  });

  // Simple helper to stream GPU usage from nvidia-smi via Warp
  // Falls back gracefully if nvidia-smi is unavailable.
  const startGpuMonitor = async () => {
    try {
      await warp.runCommand(
        // Use watch -n 2 to sample every 2 seconds. Users can adjust interval.
        "watch -n 2 --color=always nvidia-smi || echo 'nvidia-smi not available'"
      );
    } catch (err) {
      await warp.log("GPU monitor: could not start nvidia-smi. Proceeding without live GPU stats.");
    }
  };

  await startGpuMonitor();

  // 1) Basic chat with default gpt-oss model
  const basicResponse = await a2a.chat({
    messages: [
      { role: "user", content: "Summarize the key benefits of running local models with Ollama." },
    ],
  });
  await warp.log("gpt-oss response:\n" + basicResponse.text);

  // 2) Switch to Mistral 7B/8B model for a coding task with higher temperature
  const codingResponse = await a2a.chat({
    model: "mistral", // Ollama tag; resolves to Mistral 7B/8B depending on your pull
    temperature: 0.7,
    system: "You are an expert TypeScript developer. Prefer concise, typed examples.",
    messages: [
      { role: "user", content: "Write a function that debounces an async action in TypeScript." },
    ],
  });
  await warp.log("mistral response:\n" + codingResponse.text);

  // 3) Structured output via Zod schema with gpt-oss
  const TaskSchema = z.object({
    title: z.string(),
    steps: z.array(z.string()).min(1),
    estimate_minutes: z.number().int().nonnegative(),
  });

  const structured = await a2a.generate({
    model: "gpt-oss",
    temperature: 0.3,
    system: "When returning JSON, ensure it strictly matches the given schema.",
    schema: TaskSchema,
    prompt: "Plan a 3-step approach to test an HTTP API with curl.",
  });

  await warp.log("Structured plan (JSON):\n" + JSON.stringify(structured, null, 2));

  // 4) Multi-turn chat maintaining context across calls
  const thread: ChatMessage[] = [
    { role: "system", content: "You are a helpful assistant for shell scripting." },
    { role: "user", content: "Show a bash snippet to list processes using the most GPU memory." },
  ];

  const turn1 = await a2a.chat({ model: "gpt-oss", temperature: 0.2, messages: thread });
  thread.push({ role: "assistant", content: turn1.text });

  thread.push({ role: "user", content: "Now adapt it for macOS if possible." });
  const turn2 = await a2a.chat({ model: "mistral", temperature: 0.4, messages: thread });
  thread.push({ role: "assistant", content: turn2.text });

  await warp.log("Multi-turn transcript:\n" + thread.map(m => `- ${m.role}: ${m.content}`).join("\n"));

  // 5) Low-level completion API for maximum control
  const raw = await a2a.completions.create({
    provider: "ollama",
    model: "gpt-oss",
    temperature: 0.1,
    max_tokens: 256,
    stop: ["\n\n"],
    system: "Only return bullet lists of actionable tips.",
    prompt: "Tips to optimize Ollama model throughput on a single GPU.",
    stream: async (delta) => {
      if (delta.token) await warp.stream(delta.token);
    },
  });
  await warp.log("\n\nCompletion done. Tokens: " + raw.usage?.completion_tokens);

  // 6) Run parallel model queries and compare latencies via Warp
  const queries = [
    { model: "gpt-oss", prompt: "One-liner joke about terminals." },
    { model: "mistral", prompt: "One-liner joke about terminals." },
  ];

  const start = Date.now();
  const results = await Promise.all(
    queries.map(async (q) => {
      const r = await a2a.chat({ model: q.model, messages: [{ role: "user", content: q.prompt }] });
      return { model: q.model, text: r.text };
    })
  );
  const elapsed = Date.now() - start;

  await warp.log(
    "Parallel comparison (ms): " + elapsed + "\n" +
      results.map(r => `- ${r.model}: ${r.text}`).join("\n")
  );

  await warp.log("Demo complete. You can close the Warp pane now.");
}

main().catch(async (err) => {
  // Best-effort error reporting to Warp and stderr
  try { await Warp.log(String(err?.stack || err)); } catch {}
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
