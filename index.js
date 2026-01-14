// Imports
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
const MAIN_GUILD_ID = process.env.MAIN_GUILD_ID;
const BACKEND_URL = process.env.BACKEND_URL || "https://levant-backend.onrender.com";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://lilzeng1.github.io/Levant";

// Level & Role System (MERCURY -> CELESTIAL)
const LEVEL_ROLES = [
    { level: 1,  xp: 0,     id: "1453526180950052896", name: "Mercury" },
    { level: 5,  xp: 500,   id: "1453526492406616084", name: "Venus" },
    { level: 10, xp: 1500,  id: "1453526611688161453", name: "Earth" },
    { level: 20, xp: 3500,  id: "1453526743993553031", name: "Mars" },
    { level: 30, xp: 7500,  id: "1453526840722325617", name: "Jupiter" },
    { level: 40, xp: 15000, id: "1453526946486030336", name: "Saturn" },
    { level: 50, xp: 30000, id: "1453527066342326342", name: "Uranus" },
    { level: 75, xp: 60000, id: "1453527174219960422", name: "Neptune" },
    { level: 100,xp: 100000,id: "1453527289089229021", name: "Celestial" }
];

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.GuildMember]
});

client.login(process.env.token);

const userSchema = new mongoose.Schema({
    _id: String,
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    joinedAt: { type: Date },
    lastXpGain: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);

const app = express();
app.use(cors({ origin: ["https://lilzeng1.github.io", "http://127.0.0.1:5500"], methods: ['GET', 'POST'], credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.ClientSecret || "supersecret",
    resave: false, saveUninitialized: false,
    cookie: { secure: true, sameSite: 'none', maxAge: 60000 * 60 * 24 }
}));

// Message & Voice XP System
const xpCooldowns = new Set();

async function addXp(userId, amount) {
    let user = await User.findById(userId);
    if (!user) user = await User.create({ _id: userId, joinedAt: new Date() });

    user.xp += amount;
    
    // Level Controll
    const nextLevel = LEVEL_ROLES.slice().reverse().find(r => user.xp >= r.xp);
    if (nextLevel && nextLevel.level > user.level) {
        user.level = nextLevel.level;
        try {
            const guild = client.guilds.cache.get(MAIN_GUILD_ID);
            const member = await guild.members.fetch(userId);
            if(member) {
                const allRoleIds = LEVEL_ROLES.map(r => r.id);
                await member.roles.remove(allRoleIds);
                await member.roles.add(nextLevel.id);
                console.log(`${member.user.tag} leveled up to ${nextLevel.name}!`);
            }
        } catch (e) { console.error("Role update failed", e); }
    } else {
        const currentCalcLevel = LEVEL_ROLES.slice().reverse().find(r => user.xp >= r.xp);
        if(currentCalcLevel) user.level = currentCalcLevel.level;
    }
    
    await user.save();
}

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    if (xpCooldowns.has(message.author.id)) return;

    const xpAmount = Math.floor(Math.random() * 10) + 15;
    await addXp(message.author.id, xpAmount);

    xpCooldowns.add(message.author.id);
    setTimeout(() => xpCooldowns.delete(message.author.id), 60000);
});

app.get('/api/auth/discord/redirect', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided.");

    try {
        const formData = new url.URLSearchParams({
            client_id: process.env.ClientID,
            client_secret: process.env.ClientSecret,
            grant_type: 'authorization_code',
            code: code.toString(),
            redirect_uri: `${BACKEND_URL}/api/auth/discord/redirect`,
        });

        const tokenResponse = await axios.post('https://discord.com/api/v10/oauth2/token', formData.toString(), 
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        const { access_token } = tokenResponse.data;
        const userResponse = await axios.get('https://discord.com/api/v10/users/@me', { headers: { 'Authorization': `Bearer ${access_token}` } });
        const discordUser = userResponse.data;

        // Loyalty
        let realJoinDate = new Date();
        try {
            const guild = client.guilds.cache.get(MAIN_GUILD_ID);
            const member = await guild.members.fetch(discordUser.id);
            if(member) realJoinDate = member.joinedAt; 
        } catch (e) { console.log("Member not in guild for date fetch"); }

        let dbUser = await User.findById(discordUser.id);
        if (!dbUser) {
            dbUser = await User.create({ _id: discordUser.id, joinedAt: realJoinDate });
        } else {
            dbUser.joinedAt = realJoinDate;
            await dbUser.save();
        }

        res.redirect(`${FRONTEND_URL}/html/dashboard.html?uid=${discordUser.id}&name=${encodeURIComponent(discordUser.username)}&avatar=${discordUser.avatar}`);

    } catch (error) {
        console.error('Auth Error:', error);
        res.status(500).send('Authentication Failed');
    }
});

// Dashboard Data
app.get('/api/user-info/:id', async (req, res) => {
    const userId = req.params.id;
    try {
        const dbUser = await User.findById(userId);
        
        // Finding Level Roles by looking at XP
        const currentRole = LEVEL_ROLES.slice().reverse().find(r => (dbUser?.xp || 0) >= r.xp) || LEVEL_ROLES[0];

        // Next Level XP
        const nextRole = LEVEL_ROLES.find(r => r.level > (dbUser?.level || 1));
        const xpNeeded = nextRole ? nextRole.xp : "MAX";

        res.json({
            level: dbUser ? dbUser.level : 1,
            xp: dbUser ? dbUser.xp : 0,
            xpNeeded: xpNeeded,
            joinedAt: dbUser ? dbUser.joinedAt : new Date(),
            roleName: currentRole.name
        });
    } catch (error) { res.status(500).json({ error: "Database error" }); }
});

app.post('/api/user/update-nick', async (req, res) => { });
app.post('/api/danger/wipe', async (req, res) => { });

mongoose.connect(process.env.MONGODB_URL).then(() => {
    console.log(`MongoDB Connected`);
    app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
}).catch(err => console.error(`MongoDB Error`, err));
