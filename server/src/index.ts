import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { api } from "./routes.js";
import { startBackgroundWorkers } from "./services/jobWorker.js";

async function main() {
  await fs.mkdir(config.uploadDir, { recursive: true });
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: config.origin, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: "draft-8", legacyHeaders: false }));
  app.use("/api", rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false }));
  app.use("/api", api);

  if (process.env.NODE_ENV === "production") {
    const clientDirectory = path.resolve(process.cwd(), "dist");
    app.use(config.publicBasePath, express.static(clientDirectory));
    app.use(config.publicBasePath, (req, res, next) => {
      if (req.method !== "GET") return next();
      res.sendFile(path.join(clientDirectory, "index.html"));
    });
  }

  app.use((_req, res) => res.status(404).json({ message: "接口不存在" }));
  app.listen(config.port, () => {
    console.log(`API server listening on http://localhost:${config.port}`);
  });
  startBackgroundWorkers();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
