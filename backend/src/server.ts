import { configProblem, loadConfig } from './config';
import { buildContainer } from './container';
import { createApp } from './interfaces/http/createApp';

// Load backend/.env if present (Node >= 20.12); real environment variables win.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env file — fine, defaults to mock mode.
}

const config = loadConfig();
const problem = configProblem(config);
if (problem) {
  console.error(`${problem} Set it, or use LLM_PROVIDER=mock.`);
  process.exit(1);
}

const container = buildContainer(config);
const app = createApp({
  ...container,
  corsOrigin: config.corsOrigin,
  llmProvider: config.llmProvider,
  // Opening a help page starts loading the local model while the person reads and speaks.
  warmUp: container.warmUp ? () => void container.warmUp?.().catch(() => undefined) : undefined,
});

app.listen(config.port, () => {
  console.log(`Bolo Sahayak API on http://localhost:${config.port} (LLM: ${config.llmProvider}${config.llmProvider === 'mock' ? '' : `, model ${config.model}`})`);
});

if (container.warmUp) {
  const started = Date.now();
  console.log(`Loading ${config.model} into memory…`);
  container.warmUp().then(
    () => console.log(`${config.model} ready (${((Date.now() - started) / 1000).toFixed(1)}s)`),
    (err: Error) =>
      console.warn(`Could not reach the local model (${err.message}). Is Ollama running? Try: ollama serve — replies use the demo model until then.`),
  );
}
