import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// In-memory persistent cache for cross-device sync
const cloudSyncDatabase: Record<string, { world: any; lastModified: number; clientVersion: string }> = {};

let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "25mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: Date.now(), syncCount: Object.keys(cloudSyncDatabase).length });
  });

  // Cloud Sync GET
  app.get("/api/sync/:worldId", (req, res) => {
    const { worldId } = req.params;
    const record = cloudSyncDatabase[worldId];
    if (!record) {
      return res.status(404).json({ error: "World not found in cloud sync store" });
    }
    return res.json({ success: true, world: record.world, lastModified: record.lastModified });
  });

  // Cloud Sync POST
  app.post("/api/sync/:worldId", (req, res) => {
    const { worldId } = req.params;
    const { world, clientVersion } = req.body;
    if (!world) {
      return res.status(400).json({ error: "No world data provided" });
    }
    cloudSyncDatabase[worldId] = {
      world,
      lastModified: Date.now(),
      clientVersion: clientVersion || "1.0",
    };
    return res.json({
      success: true,
      worldId,
      lastModified: cloudSyncDatabase[worldId].lastModified,
      message: "Synced to cloud database successfully",
    });
  });

  // Cloud Sync list all available sync IDs
  app.get("/api/sync", (_req, res) => {
    const list = Object.entries(cloudSyncDatabase).map(([id, data]) => ({
      id,
      name: data.world?.name || "Unnamed World",
      lastModified: data.lastModified,
      planetType: data.world?.archetype || "Terrestrial",
    }));
    return res.json({ success: true, worlds: list });
  });

  // Astrobiology & Planetary Lore Gemini Assistant
  app.post("/api/ai-research", async (req, res) => {
    try {
      const { prompt, planetData } = req.body;
      const ai = getAI();

      if (!ai) {
        return res.status(503).json({
          error: "GEMINI_API_KEY is not configured on the server. Utilizing deterministic scientific simulation engine.",
          isOfflineFallback: true,
        });
      }

      const systemInstruction = `You are the lead Astrobiologist and Planetary Geochemist for the Interstellar Planetary Survey.
Analyze the following hard sci-fi exoplanet parameters with rigorous scientific consistency, referencing thermodynamics, atmospheric scale heights, spectral irradiance, tectonic recycling, mineral economics, and potential exobiology or habitability constraints.
Keep the output engaging, scientifically grounded, and formatted in clean markdown.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${systemInstruction}\n\nPLANET PARAMETERS:\n${JSON.stringify(planetData, null, 2)}\n\nUSER INQUIRY / FOCUS:\n${prompt || "Generate a comprehensive Astrobiological & Mineralogical Survey Report with civilization potential."}`,
              },
            ],
          },
        ],
      });

      const text = response.text || "No report generated.";
      return res.json({ success: true, report: text });
    } catch (err: any) {
      console.error("AI research generation error:", err);
      return res.status(500).json({
        error: err.message || "Failed to generate AI survey report",
      });
    }
  });

  // Vite middleware in dev; static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Hard Sci-Fi Planetary Simulation server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
