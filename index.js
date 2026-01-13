const { Client, GatewayIntentBits, Partials } = require("discord.js");
const mongoose = require("mongoose");
const express = require("express");
const axios = require("axios");
const session = require("express-session");
const bodyParser = require("body-parser");
const cors = require("cors");
const url = require("url");
require("dotenv").config();

// Configuration
const PORT = process.env.PORT || 3000;
const CORE_SUPPORTER_ROLE_ID = process.env.CORE_SUPPORTER_ROLE_ID || "1456104633234886666"; 
const MAIN_GUILD_ID = process.env.MAIN_GUILD_ID;
const BACKEND_URL = process.env.BACKEND_URL || "https://levant-backend.onrender.com";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://lilzeng1.github.io/Levant";

// DISCORD CLIENT
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.GuildMember]
});

client.login(process.env.token);

// MONGODB
const userSchema = new mongoose.Schema({
    _id: String,
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);

const app = express();

app.use(cors({
    origin: FRONTEND_URL, 
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.ClientSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: true,
        sameSite: 'none',
        maxAge: 60000 * 60 * 24 
    }
}));

// 1. OAuth Redirect & Rol Verme
app.get('/api/auth/discord/redirect', async (req, res) => {
    const { code } = req.query;

    if (!code) return res.status(400).send("No code provided.");

    try {
        const formData = new url.URLSearchParams({
            client_id: process.env.ClientID || 1454693732799611042,
            client_secret: process.env.ClientSecret || process.env.CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code.toString(),
            redirect_uri: `https://levant-backend.onrender.com/api/auth/discord/redirect`,
        });

        const tokenResponse = await axios.post('https://discord.com/api/v10/oauth2/token',
            formData.toString(), 
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const { access_token } = tokenResponse.data;

        const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });

        const discordUser = userResponse.data;
        
        // Veritabanına kaydet
        let dbUser = await User.findById(discordUser.id);
        if (!dbUser) {
            dbUser = await User.create({
                _id: discordUser.id,
                joinedAt: new Date()
            });
            console.log(`New user created: ${discordUser.username}`);
        }

        // Rolü Ver
        try {
            const guild = client.guilds.cache.get(MAIN_GUILD_ID);
            if (guild) {
                const member = await guild.members.fetch(discordUser.id).catch(() => null);
                if (member) {
                    await member.roles.add(CORE_SUPPORTER_ROLE_ID);
                    console.log(`Role added to ${discordUser.username}`);
                }
            }
        } catch (err) {
            console.error("Role Error:", err);
        }
        
        res.redirect(`${FRONTEND_URL}/html/dashboard.html?uid=${discordUser.id}&name=${encodeURIComponent(discordUser.username)}&avatar=${discordUser.avatar}`);

    } catch (error) {
        console.error('Auth Error:', error.response ? error.response.data : error.message);
        res.status(500).send('Authentication Failed');
    }
});

// 2. Dashboard Verisi Çekme
app.get('/api/user-info/:id', async (req, res) => {
    const userId = req.params.id;
    if (!userId) return res.status(400).json({ error: "No User ID" });

    try {
        const dbUser = await User.findById(userId);
        res.json({
            level: dbUser ? dbUser.level : 1,
            xp: dbUser ? dbUser.xp : 0,
            joinedAt: dbUser ? dbUser.joinedAt : new Date()
        });
    } catch (error) {
        console.error("DB Error:", error);
        res.status(500).json({ error: "Database error" });
    }
});

// 3. Danger Zone (Veri Silme)
app.post('/api/danger/wipe', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(401).send("Unauthorized");

    try {
        await User.findByIdAndDelete(userId);

        const guild = client.guilds.cache.get(MAIN_GUILD_ID);
        if (guild) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
                await member.roles.remove(CORE_SUPPORTER_ROLE_ID);
            }
        }
        res.json({ success: true });
    } catch (error) {
        console.error("Wipe Error:", error);
        res.status(500).json({ error: "Failed to wipe data" });
    }
});

// Başlat
mongoose.connect(process.env.MONGODB_URL)
    .then(() => {
        console.log(`MongoDB Connected`);
        app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
    })
    .catch(err => console.error(`MongoDB Error`, err));
