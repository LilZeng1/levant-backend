import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const {
  BOT_TOKEN,
  GUILD_ID,
  ROLE_ID
} = process.env;

app.post("/give-role", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const discordRes = await fetch(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${userId}/roles/${ROLE_ID}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bot ${BOT_TOKEN}`,
          "Content-Length": "0"
        }
      }
    );

    if (!discordRes.ok) {
      const text = await discordRes.text();
      return res.status(500).json({ error: text });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (_, res) => {
  res.send("Backend alive");
});

app.listen(3000, () => {
  console.log("Backend running");
});
