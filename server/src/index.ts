import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { initDb, saveDb } from './db/connection.js';
import { settingsRouter, phasesRouter, designationsRouter, machineTypesRouter } from './routes/settings.js';
import { machinesRouter } from './routes/machines.js';
import { machineGroupsRouter } from './routes/machineGroups.js';
import { nestsRouter } from './routes/nests.js';
import { alternativesRouter } from './routes/alternatives.js';
import { projectsRouter } from './routes/projects.js';
import { capacityRouter } from './routes/capacity.js';
import { allocationRouter } from './routes/allocation.js';
import { scenariosRouter } from './routes/scenarios.js';
import { adminRouter, startAdminBackupScheduler } from './routes/admin.js';

const app = express();
/** Bez tego przeglądarka nie udostępnia JS niestandardowych nagłówków odpowiedzi (fetch Headers) przy żądaniach cross-origin (np. VITE_API_BASE → localhost:3001). */
app.use(
  cors({
    exposedHeaders: ['Content-Disposition', 'X-Capacity-Data-Import-Schema'],
  }),
);
app.use(express.json());

// Montowanie PRZED głównym routerem ustawień, żeby /phases i /designations nie trafiały do /:id
app.use('/api/settings/phases', phasesRouter);
app.use('/api/settings/designations', designationsRouter);
app.use('/api/settings/machine-types', machineTypesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/machines', machinesRouter);
app.use('/api/machine-groups', machineGroupsRouter);
app.use('/api/nests', nestsRouter);
app.use('/api/alternatives', alternativesRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/capacity', capacityRouter);
app.use('/api/allocation', allocationRouter);
app.use('/api/scenarios', scenariosRouter);
app.use('/api/admin', adminRouter);

function resolveClientDist(): string | null {
  const fromEnv = process.env.CLIENT_DIST?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return path.resolve(fromEnv);
  const sibling = path.resolve(process.cwd(), '..', 'client', 'dist');
  if (fs.existsSync(sibling)) return sibling;
  return null;
}

function mountClientStatic(): void {
  const clientDist = resolveClientDist();
  if (!clientDist) return;
  console.log(`[capacity] Serving static UI from ${clientDist}`);
  app.use(express.static(clientDist, { index: false, maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}

mountClientStatic();

const PORT = process.env.PORT || 3001;

async function main() {
  await initDb();
  saveDb();
  setInterval(saveDb, 3000);
  startAdminBackupScheduler();
  process.on('beforeExit', saveDb);
  const server = app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\n[capacity] Port ${PORT} jest zajęty — TEN proces się nie uruchomił. Nadal działa STARY backend na tym porcie ` +
          `(m.in. stary szablon Excel bez arkusza „Operacje”).\n` +
          `           Zamknij drugie okno terminala z serwerem LUB na Windows:\n` +
          `             netstat -ano | findstr :${PORT}\n` +
          `             taskkill /PID <ostatnia_kolumna_PID> /F\n` +
          `           Potem ponów npm run dev lub npm start w folderze server.\n`,
      );
      process.exit(1);
    }
    console.error(err);
    process.exit(1);
  });
}
main().catch((e) => { console.error(e); process.exit(1); });
