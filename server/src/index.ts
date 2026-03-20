import express from 'express';
import cors from 'cors';
import { initDb, saveDb } from './db/connection.js';
import { settingsRouter, phasesRouter, designationsRouter } from './routes/settings.js';
import { machinesRouter } from './routes/machines.js';
import { nestsRouter } from './routes/nests.js';
import { alternativesRouter } from './routes/alternatives.js';
import { projectsRouter } from './routes/projects.js';
import { capacityRouter } from './routes/capacity.js';
import { allocationRouter } from './routes/allocation.js';
import { scenariosRouter } from './routes/scenarios.js';

const app = express();
app.use(cors());
app.use(express.json());

// Montowanie PRZED głównym routerem ustawień, żeby /phases i /designations nie trafiały do /:id
app.use('/api/settings/phases', phasesRouter);
app.use('/api/settings/designations', designationsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/machines', machinesRouter);
app.use('/api/nests', nestsRouter);
app.use('/api/alternatives', alternativesRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/capacity', capacityRouter);
app.use('/api/allocation', allocationRouter);
app.use('/api/scenarios', scenariosRouter);

const PORT = process.env.PORT || 3001;

async function main() {
  await initDb();
  saveDb();
  setInterval(saveDb, 3000);
  process.on('beforeExit', saveDb);
  app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
}
main().catch((e) => { console.error(e); process.exit(1); });
