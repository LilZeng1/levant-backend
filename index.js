// Imports
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import 'dotenv/config';

const app = express();

app.use(cors({
    origin: "*", 
    methods: ["GET", "POST", "OPTIONS"]
}));

app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const ROLE_ID = process.env.ROLE_ID;

const ROLE_PRIORITY = [
  { id: "1452854057906733257", name: "Founder" },
  { id: "1452854589668982899", name: "Moderator" },
  { id: "1452855452504162496", name: "Community Guide" },
  { id: "1452856001605927023", name: "Helper" },
  { id: "1452857818909769768", name: "Event Lead" },
  { id: "1453136624220246183", name: "Levant Booster" },
  { id: "1453527525350178957", name: "Ascendant (VIP)" },
  { id: "1452856702302158868", name: "Content Creator" },
  { id: "1452856780140052681", name: "Musician" },
  { id: "1456104633234886666", name: "Core Supporter" },
  { id: "1452858679606116423", name: "Member" }
];

app.post("/give-role", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID missing" });
  }

  try {
    // Checking the member's already obtained roles
    const memberRes = await fetch(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${userId}`,
      {
        headers: { Authorization: `Bot ${BOT_TOKEN}` }
      }
    );

    if (!memberRes.ok) {
      return res.status(404).json({ error: "User not found in server" });
    }

    const member = await memberRes.json();

    if (member.roles.includes(ROLE_ID)) {
    console.log(`Kullanıcı ${userId} zaten role sahip.`);
    return res.json({ success: true, alreadyHasRole: true, message: "User already has the role" });
  }

    const assignRes = await fetch(
    `https://discord.com/api/guilds/${GUILD_ID}/members/${userId}/roles/${ROLE_ID}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );

    if (assignRes.ok || assignRes.status === 204) {
      return res.json({ success: true, alreadyHasRole: false });
    } else {
      const errorText = await assignRes.text();
      return res.status(assignRes.status).json({ error: errorText });
    }

  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/userinfo", async (req, res) => {
  try {
    const { access_token } = req.body;
    if (!access_token) return res.status(400).json({ error: "No token provided" });

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    
    if (!userRes.ok) throw new Error("Invalid Token");
    const user = await userRes.json();

    const memberRes = await fetch(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${user.id}`,
      { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
    );

    let roleName = "Member";
    let joinedAt = null;

    if (memberRes.ok) {
        const member = await memberRes.json();
        joinedAt = member.joined_at;
        if (member.roles) {
            for (const role of ROLE_PRIORITY) {
                if (member.roles.includes(role.id)) {
                    roleName = role.name;
                    break;
                }
            }
        }
    } else {
        console.log("Kullanıcı sunucuda bulunamadı, varsayılan veri dönülüyor.");
    }

    res.json({
      username: user.username,
      id: user.id,
      avatar: user.avatar,
      joinedAt: joinedAt,
      role: roleName
    });

  } catch (err) {
    console.error("Userinfo Hatası:", err);
    res.json({
      username: "Guest",
      id: "000000",
      joinedAt: null,
      role: "Visitor"
    });
  }
});

// Get Server Status()
app.get("/server-stats", async (req, res) => {
    try {
        const response = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/widget.json`);
        const data = await response.json();
        
        if (!data.members) {
            return res.status(400).json({ error: "Enable Server Widget in Discord Settings!" });
        }

        const stats = {
            total: data.presence_count,
            online: data.members.filter(m => m.status === "online").length,
            idle: data.members.filter(m => m.status === "idle").length,
            dnd: data.members.filter(m => m.status === "dnd").length,
            offline: 0
        };
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: "Stats fetch failed" });
    }
});

// Getting the LeaderBoard()
app.get("/leaderboard", async (req, res) => {
    try {
        const mockData = [
            { rank: 1, name: "Zeng", msgs: 1542, voice: "42h", avatar: "https://i.pravatar.cc/150?u=1" },
            { rank: 2, name: "Kaptan", msgs: 1200, voice: "30h", avatar: "https://i.pravatar.cc/150?u=2" },
            { rank: 3, name: "Shadow", msgs: 850, voice: "15h", avatar: "https://i.pravatar.cc/150?u=3" }
        ];
        res.json(mockData);
    } catch (err) {
        res.status(500).json({ error: "Leaderboard fetch failed" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
