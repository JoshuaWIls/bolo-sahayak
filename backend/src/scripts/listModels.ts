/**
 * `npm run models` — lists the model names your LLM_PROVIDER key can use,
 * so LLM_MODEL in backend/.env can be set to one that exists.
 */
import { configProblem, loadConfig } from '../config';

try {
  process.loadEnvFile('.env');
} catch {
  // no .env
}

const config = loadConfig();
const o = config.openai;
if (!o) {
  console.log(`LLM_PROVIDER=${config.llmProvider} — nothing to list. Set LLM_PROVIDER=gemini, groq or ollama in backend/.env.`);
  process.exit(0);
}
const problem = configProblem(config);
if (problem) {
  console.error(problem);
  process.exit(1);
}

const res = await fetch(`${o.baseUrl.replace(/\/+$/, '')}/models`, {
  headers: o.apiKey ? { authorization: `Bearer ${o.apiKey}` } : {},
  signal: AbortSignal.timeout(15_000),
});
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
const { data } = (await res.json()) as { data: Array<{ id: string }> };
const ids = data.map((m) => m.id.replace(/^models\//, '')).sort();
console.log(`${ids.length} models for ${config.llmProvider} (current LLM_MODEL: ${config.model}${ids.includes(config.model) ? ' ✓' : ' — not in this list'}):`);
for (const id of ids) console.log(`  ${id}`);
