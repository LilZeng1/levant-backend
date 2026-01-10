// Imports
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

// App()
const App = express();
App.use(cors());
App.use(express.json());

/// Important Variables
const Port = process.env.PORT || 3000;
const BotToken = process.env.DISCORD_BOT_TOKEN;
const GuildId = "1452829028267327511";
const RoleId = "1456104633234886666";

/* Database Connection */
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Connected to MongoDB"))
    .catch(Err => console.error("Database connection error:", Err));

/* User Schema */
const UserSchema = new mongoose.Schema({
    discordId: String,
    username: String,
    avatar: String,
    messages: { type: Number, default: 0 },
    voiceMinutes: { type: Number, default: 0 },
    streak: { type: Number, default: 1 },
    lastLogin: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

/* Routes */
App.post('/userinfo', async (Req, Res) => {
    const { access_token } = Req.body;
    if (!access_token) return Res.status(400).json({ Error: "Missing access token" });

    try {
        const UserRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${access_token}` }
        });
        const DiscordUser = await UserRes.json();

        if (!DiscordUser.id) throw new Error("Invalid Discord response");

        /* Auto Assign Role */
        await fetch(`https://discord.com/api/guilds/${GuildId}/members/${DiscordUser.id}/roles/${RoleId}`, {
            method: 'PUT',
            headers: { Authorization: `Bot ${BotToken}` }
        });

        const MemberRes = await fetch(`https://discord.com/api/guilds/${GuildId}/members/${DiscordUser.id}`, {
            headers: { Authorization: `Bot ${BotToken}` }
        });
        const MemberData = await MemberRes.json();

        /* Sync with MongoDB */
        let LocalUser = await User.findOne({ discordId: DiscordUser.id });
        if (!LocalUser) {
            LocalUser = new User({
                discordId: DiscordUser.id,
                username: DiscordUser.username,
                avatar: DiscordUser.avatar
            });
            await LocalUser.save();
        }

        Res.json({
            id: DiscordUser.id,
            username: DiscordUser.username,
            avatar: DiscordUser.avatar ? `https://cdn.discordapp.com/avatars/${DiscordUser.id}/${DiscordUser.avatar}.png` : "https://via.placeholder.com/100",
            joinedAt: MemberData.joined_at,
            role: MemberData.roles[0] || "Member",
            stats: {
                messages: LocalUser.messages,
                streak: LocalUser.streak,
                voice: LocalUser.voiceMinutes
            }
        });
    } catch (Err) {
        console.error(Err);
        Res.status(500).json({ Error: "Backend Failure" });
    }
});

// ServerStatus()
App.get('/server-stats', async (Req, Res) => {
    try {
        const ResGuild = await fetch(`https://discord.com/api/guilds/${GuildId}/preview`, {
            headers: { Authorization: `Bot ${BotToken}` }
        });
        const Data = await ResGuild.json();
        
        Res.json({
            online: Data.approximate_presence_count || 0,
            total: Data.approximate_member_count || 0
        });
    } catch (Err) {
        Res.status(500).json({ error: "Failed to fetch stats" });
    }
});

// LeaderBoard()
App.get('/leaderboard', async (Req, Res) => {
    try {
        const TopUsers = await User.find().sort({ messages: -1 }).limit(10);
        Res.json(TopUsers.map((U, Index) => ({
            rank: Index + 1,
            name: U.username,
            avatar: U.avatar ? `https://cdn.discordapp.com/avatars/${U.discordId}/${U.avatar}.png` : "https://via.placeholder.com/100",
            msgs: U.messages,
            voice: `${U.voiceMinutes}m`
        })));
    } catch (Err) {
        Res.status(500).json({ Error: "Leaderboard Error" });
    }
});

App.listen(Port, () => console.log(`Server running on port ${Port}`));
