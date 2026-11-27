import { loadConfig } from './config';
import { buildContainer } from './container';
import { createApp } from './interfaces/http/createApp';

const config = loadConfig();
const { turnService, venues } = buildContainer(config);
const app = createApp({ turnService, venues, corsOrigin: config.corsOrigin });

app.listen(config.port, () => {
  console.log(`Bolo Sahayak API on http://localhost:${config.port} (LLM: ${config.llmProvider})`);
});
