import { checkAuth, send, wrap, MODEL } from "./_claude.js";

export default wrap(async (req, res) => {
  checkAuth(req);
  send(res, 200, { ok: true, model: MODEL, hasKey: !!process.env.ANTHROPIC_API_KEY });
});
