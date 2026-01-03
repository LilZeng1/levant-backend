import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import 'dotenv/config';

const app = express();
app.use(cors());
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
  { id: "1456104633234886666", name: "Core Supporter" },
  { id: "1453527525350178957", name: "Ascendant (VIP)" },
  { id: "1452856702302158868", name: "Content Creator" },
  { id: "1452856780140052681", name: "Musician" },
  { id: "1452858679606116423", name: "Member" }
];

// 1. ROTA: Rol Verme İşlemi() 
app.post("/give-role", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID missing" });
  }

  try {
    // Discord API'ye PUT isteği atarak rolü veriyoruz
    const response = await fetch(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${userId}/roles/${ROLE_ID}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    // 204 No Content (Başarılı) / 200 OK dönerse
    if (response.ok) {
      console.log(`Rol verildi: ${userId}`);
      return res.json({ success: true, message: "Role assigned" });
    } else {
      const errorText = await response.text();
      console.error("Discord API Error (Give Role):", errorText);
      return res.status(response.status).json({ error: errorText });
    }
  } catch (err) {
    console.error("Sunucu Hatası:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// 2. ROTA: Kullanıcı Bilgisi
app.post("/userinfo", async (req, res) => {
  try {
    const { access_token } = req.body;

    // 1️⃣ Discord user
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    
    if (!userRes.ok) {
        throw new Error("Failed to fetch user from Discord");
    }
    
    const user = await userRes.json();

    // 2️⃣ Guild member (joined_at + roles)
    const memberRes = await fetch(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${user.id}`,
      {
        headers: { Authorization: `Bot ${BOT_TOKEN}` }
      }
    );

    if (!memberRes.ok) {
      // Kullanıcı sunucuda yoksa varsayılan dön
      return res.json({
        username: user.username,
        avatar: user.avatar,
        joinedAt: null,
        role: "Core Supporter"
      });
    }

    const member = await memberRes.json();

    // 3️⃣ Rol ayıklama (öncelik sırasına göre)
    let roleName = "Core Supporter";

    if (member.roles) {
        for (const role of ROLE_PRIORITY) {
            if (member.roles.includes(role.id)) {
                roleName = role.name;
                break;
            }
        }
    }

    res.json({
      username: user.username,
      avatar: user.avatar,
      joinedAt: member.joined_at,
      role: roleName
    });

  } catch (err) {
    console.error(err);
    res.json({
      username: "Unknown",
      joinedAt: null,
      role: "Core Supporter"
    });
  }
});

app.listen(3000, () => console.log("Backend ready on port 3000"));
