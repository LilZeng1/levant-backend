// Imports
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const mongoose = require("mongoose");
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cors = require("cors");
const url = require("url");
require("dotenv").config();

const PORT = process.env.PORT || 3000;
const MAIN_GUILD_ID = process.env.MAIN_GUILD_ID;
const BACKEND_URL = process.env.BACKEND_URL || "https://levant-backend.onrender.com";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://lilzeng1.github.io/Levant";

const LEVEL_ROLES = [
    { level: 1,  xp: 0,      id: "1453526180950052896" },
    { level: 5,  xp: 500,    id: "1453526492406616084" },
    { level: 10, xp: 1500,   id: "1453526611688161453" },
    { level: 20, xp: 3500,   id: "1453526743993553031" },
    { level: 30, xp: 7500,   id: "1453526840722325617" },
    { level: 40, xp: 15000,  id: "1453526946486030336" },
    { level: 50, xp: 30000,  id: "1453527066342326342" },
    { level: 75, xp: 60000,  id: "1453527174219960422" },
    { level: 100,xp: 100000, id: "1453527289089229021" }
];

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.GuildMember]
});

client.login(process.env.token);

const userSchema = new mongoose.Schema({
    _id: String,
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    joinedAt: { type: Date }, 
    lastMsg: { type: Date, default: Date.now } 
});

const User = mongoose.model("User", userSchema);

const app = express();
app.use(cors({ 
    origin: ["https://lilzeng1.github.io", "http://127.0.0.1:5500", "http://localhost:5500"], 
    methods: ['GET', 'POST'], 
    credentials: true 
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const xpCooldowns = new Set();

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    if (xpCooldowns.has(message.author.id)) return;

    const xpGain = Math.floor(Math.random() * 10) + 15;
    
    let user = await User.findById(message.author.id);
    if (!user) {
        const member = message.guild.members.cache.get(message.author.id);
        user = await User.create({ 
            _id: message.author.id, 
            joinedAt: member ? member.joinedAt : new Date() 
        });
    }

    user.xp += xpGain;
    
    const nextLevel = LEVEL_ROLES.slice().reverse().find(r => user.xp >= r.xp);
    if (nextLevel && nextLevel.level > user.level) {
        user.level = nextLevel.level;
        try {
            const member = await message.guild.members.fetch(message.author.id);
            if(member && nextLevel.id) {
                await member.roles.add(nextLevel.id);
            }
        } catch (e) { console.error(e); }
    }

    await user.save();
    xpCooldowns.add(message.author.id);
    setTimeout(() => xpCooldowns.delete(message.author.id), 60000);
});

app.get('/api/members/leaderboard', async (req, res) => {
    try {
        const topUsers = await User.find().sort({ xp: -1 }).limit(20);
        const guild = client.guilds.cache.get(MAIN_GUILD_ID);
        
        const leaderboard = await Promise.all(topUsers.map(async (dbUser) => {
            let username = "Unknown User";
            let avatar = "https://cdn.discordapp.com/embed/avatars/0.png";
            try {
                let discordUser;
                if (guild) {
                    try {
                        const member = await guild.members.fetch(dbUser._id);
                        username = member.displayName;
                        avatar = member.user.displayAvatarURL();
                    } catch {
                        discordUser = await client.users.fetch(dbUser._id);
                        username = discordUser.username;
                        avatar = discordUser.displayAvatarURL();
                    }
                } else {
                    discordUser = await client.users.fetch(dbUser._id);
                    username = discordUser.username;
                    avatar = discordUser.displayAvatarURL();
                }
            } catch (e) { console.error(e); }
            return {
                id: dbUser._id,
                username,
                avatar,
                level: dbUser.level,
                xp: dbUser.xp
            };
        }));
        
        res.json(leaderboard);
    } catch (e) { res.status(500).json({ error: "Leaderboard error" }); }
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

        const tokenRes = await axios.post('https://discord.com/api/v10/oauth2/token', formData, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        const { access_token } = tokenRes.data;
        const userRes = await axios.get('https://discord.com/api/v10/users/@me', { headers: { 'Authorization': `Bearer ${access_token}` } });
        const discordUser = userRes.data;

        let dbUser = await User.findById(discordUser.id);
        let realJoinDate = new Date();
        try {
            const guild = client.guilds.cache.get(MAIN_GUILD_ID);
            if (guild) {
                const member = await guild.members.fetch(discordUser.id);
                if(member) realJoinDate = member.joinedAt;
            }
        } catch (e) { console.log(e); }

        if (!dbUser) {
            dbUser = await User.create({ _id: discordUser.id, joinedAt: realJoinDate });
        } else if(!dbUser.joinedAt) {
            dbUser.joinedAt = realJoinDate;
            await dbUser.save();
        }

        res.redirect(`${FRONTEND_URL}/html/dashboard.html?uid=${discordUser.id}&name=${encodeURIComponent(discordUser.username)}&avatar=${discordUser.avatar}`);
    } catch (error) {
        res.status(500).send('Login Error');
    }
});

app.get('/api/user-info/:id', async (req, res) => {
    try {
        const dbUser = await User.findById(req.params.id);
        res.json({
            level: dbUser ? dbUser.level : 1,
            xp: dbUser ? dbUser.xp : 0,
            joinedAt: dbUser ? dbUser.joinedAt : new Date() 
        });
    } catch (e) { res.status(500).json({ error: "Server Error" }); }
});

app.post('/api/user/update-nick', async (req, res) => {
    const { userId, nickname } = req.body;
    try {
        const guild = client.guilds.cache.get(MAIN_GUILD_ID);
        if (!guild) return res.status(404).json({ error: "Guild not found" });
        
        const member = await guild.members.fetch(userId);
        if (member.id === guild.ownerId) return res.status(403).json({ error: "Cannot change Owner nickname" });
        if (!member.manageable) return res.status(403).json({ error: "Bot role too low in hierarchy" });

        await member.setNickname(nickname);
        return res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: "Discord API Error" }); 
    }
});

app.post('/api/danger/wipe', async (req, res) => {
   const { userId } = req.body;
   await User.findByIdAndDelete(userId);
   res.json({ success: true });
});

mongoose.connect(process.env.MONGODB_URL).then(() => {
    console.log("DB Connected");
    app.listen(PORT, () => console.log(`Server on ${PORT}`));
});
