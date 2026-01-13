const { Client, GatewayIntentBits, Partials } = require("discord.js");
const mongoose = require("mongoose");
const express = require("express");
const axios = require("axios");
const session = require("express-session");
const bodyParser = require("body-parser");
const cors = require("cors");
const url = require("url");
require("dotenv").config();

// CONFIGURATION
const PORT = process.env.PORT || 3000;
const CORE_SUPPORTER_ROLE_ID = "1456104633234886666"; 
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const MAIN_GUILD_ID = process.env.MAIN_GUILD_ID;
const BACKEND_URL = process.env.BACKEND_URL || "https://levant-backend.onrender.com";
const FRONTEND_URL = "https://lilzeng1.github.io/Levant";

// Client()
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.GuildMember]
});

client.login(process.env.token);

// MONGODB MODEL
const userSchema = new mongoose.Schema({
    _id: String,
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);

// Express()
const app = express();

app.use(cors({
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: 'IrJFEt7tBBH3Y7IWeyyQfSk2dRsypPQL',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: true, 
        sameSite: 'none',
        maxAge: 60000 * 60 * 24 
    }
}));

// OAuth Redirect & Auto Role Logic
app.get('/api/auth/discord/redirect', async (req, res) => {
    const { code } = req.query;

    if (!code) return res.status(400).send("No code provided.");

    try {
        // Exchange code for token
        const formData = new url.URLSearchParams({
            client_id: process.env.ClientID,
            client_secret: process.env.ClientSecret,
            grant_type: 'authorization_code',
            code: code.toString(),
            redirect_uri: `${BACKEND_URL}/api/auth/discord/redirect`,
        });

        const tokenResponse = await axios.post('https://discord.com/api/v10/oauth2/token',
            formData.toString(), 
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const { access_token } = tokenResponse.data;

        // Get User Data from Discord
        const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });

        const discordUser = userResponse.data;
        
        // Find or Create User in DB
        let dbUser = await User.findById(discordUser.id);
        if (!dbUser) {
            dbUser = await User.create({
                _id: discordUser.id,
                joinedAt: new Date()
            });
            console.log(`New user created: ${discordUser.username}`);
        }

        // Givin' tha' "Core Supporter" Role
        try {
            const guild = client.guilds.cache.get(MAIN_GUILD_ID);
            if (guild) {
                const member = await guild.members.fetch(discordUser.id).catch(() => null);
                if (member) {
                    await member.roles.add(CORE_SUPPORTER_ROLE_ID);
                    console.log(`Role added to ${discordUser.username}`);
                } else {
                    console.log("User is not in the server, cannot give role.");
                }
            }
        } catch (err) {
            console.error("Failed to assign role:", err);
        }

        // Redirect back to GitHub Pages with ID
        res.redirect(`${FRONTEND_URL}/html/dashboard.html?uid=${discordUser.id}&name=${encodeURIComponent(discordUser.username)}&avatar=${discordUser.avatar}`);

    } catch (error) {
        console.error('Auth Error:', error);
        res.status(500).send('Authentication Failed');
    }
});

// Get Dashboard Data
app.get('/api/user-info/:id', async (req, res) => {
    const userId = req.params.id;
    if (!userId) return res.status(400).json({ error: "No User ID" });

    try {
        const dbUser = await User.findById(userId);
        
        // Return only DB data, frontend has the name/avatar from redirect for now
        res.json({
            level: dbUser ? dbUser.level : 1,
            xp: dbUser ? dbUser.xp : 0,
            joinedAt: dbUser ? dbUser.joinedAt : new Date()
        });
    } catch (error) {
        console.error("DB Fetch Error:", error);
        res.status(500).json({ error: "Database error" });
    }
});

// sWipe Data (Danger Zone)
app.post('/api/danger/wipe', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(401).send("Unauthorized");

    try {
        await User.findByIdAndDelete(userId);

        // Remove the Role
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

// Connect DB and Start
mongoose.connect(process.env.MONGODB_URL)
    .then(() => {
        console.log(`MongoDB Connected`);
        app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
    })
    .catch(err => console.error(`MongoDB Error`, err));
