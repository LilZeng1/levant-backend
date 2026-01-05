import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import 'dotenv/config';

const app = express();

// CORS Ayarı: Her yerden gelen isteği kabul et (GitHub Pages için gerekli)
app.use(cors({
    origin: "*", 
    methods: ["GET", "POST", "OPTIONS"]
}));

app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
// ROLE_ID sadece "give-role" için kullanılıyor, userinfo'da tüm roller taranıyor.
const ASSIGN_ROLE_ID = process.env.ROLE_ID; 

// Bu ID'lerin sunucundaki GERÇEK ID'ler olduğundan emin ol.
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

// 1. ROTA: Rol Verme
app.post("/give-role", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "User ID missing" });

  try {
    const response = await fetch(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${userId}/roles/${ASSIGN_ROLE_ID}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (response.ok || response.status === 204) {
      console.log(`Rol verildi: ${userId}`);
      return res.json({ success: true });
    } else {
      const errorText = await response.text();
      console.error("Discord Error:", errorText);
      return res.status(response.status).json({ error: errorText });
    }
  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// 2. ROTA: Kullanıcı Bilgisi
app.post("/userinfo", async (req, res) => {
  try {
    const { access_token } = req.body;
    if (!access_token) return res.status(400).json({ error: "No token provided" });

    // 1. Discord User Bilgisi
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    
    if (!userRes.ok) throw new Error("Invalid Token");
    const user = await userRes.json();

    // 2. Sunucu Üyelik Bilgisi
    const memberRes = await fetch(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${user.id}`,
      { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
    );

    let roleName = "Member"; // Varsayılan rol
    let joinedAt = null;

    if (memberRes.ok) {
        const member = await memberRes.json();
        joinedAt = member.joined_at;

        // Rol Öncelik Kontrolü
        if (member.roles) {
            for (const role of ROLE_PRIORITY) {
                if (member.roles.includes(role.id)) {
                    roleName = role.name;
                    break;
                }
            }
        }
    } else {
        // Kullanıcı sunucuda değilse ama giriş yaptıysa
        console.log("Kullanıcı sunucuda bulunamadı, varsayılan veri dönülüyor.");
    }

    res.json({
      username: user.username,
      id: user.id, // ID'yi de ekledim frontend'de kopyalamak için
      avatar: user.avatar,
      joinedAt: joinedAt,
      role: roleName
    });

  } catch (err) {
    console.error("Userinfo Hatası:", err);
    // Hata olsa bile frontend patlamasın diye fallback veri dönüyoruz
    res.json({
      username: "Guest",
      id: "000000",
      joinedAt: null,
      role: "Visitor"
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
