import { createApp } from "./app.js";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";

const app = createApp();

app.listen(config.PORT, () => {
  logger.info(`Zendesk AI backend listening on port ${config.PORT}`);
});

