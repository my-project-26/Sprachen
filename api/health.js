import { checkAuth, send, wrap, resolveProvider, ollamaModels, CLAUDE_MODEL, GEMINI_MODEL } from "./_llm.js";

export default wrap(async (req, res) => {
  checkAuth(req);
  const models = await ollamaModels().catch(() => null);
  send(res, 200, {
    ok: true,
    auto: resolveProvider("auto"),
    providers: {
      claude: { available: !!process.env.ANTHROPIC_API_KEY, model: CLAUDE_MODEL() },
      gemini: { available: !!process.env.GEMINI_API_KEY, model: GEMINI_MODEL() },
      ollama: { available: !!(models && models.length), running: models !== null, models: models || [] },
    },
  });
});
