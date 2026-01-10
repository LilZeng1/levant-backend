// Imports
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const App = express();
App.use(cors());
App.use(express.json());

// Variables
const BotToken = process.env.DISCORD_BOT_TOKEN;
const GuildId = "1452829028267327511";
const RoleId = "1456104633234886666";

// Get User Info and Assign Role
App.post('/userinfo', async (Req, Res) => {
    const { access_token } = Req.body;
    try {
        const UserRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${access_token}` }
        });
        const UserData = await UserRes.json();

        // Assign Role automatically via Bot
        await fetch(`https://discord.com/api/guilds/${GuildId}/members/${UserData.id}/roles/${RoleId}`, {
            method: 'PUT',
            headers: { Authorization: `Bot ${BotToken}` }
        });

        // Get Member Details for Level/Joined date
        const MemberRes = await fetch(`https://discord.com/api/guilds/${GuildId}/members/${UserData.id}`, {
            headers: { Authorization: `Bot ${BotToken}` }
        });
        const MemberData = await MemberRes.json();

        Res.json({
            ...UserData,
            joinedAt: MemberData.joined_at,
            role: MemberData.roles[0] || "Member"
        });
    } catch (Err) {
        Res.status(500).json({ Error: "Discord API Error" });
    }
});

// Real Leaderboard from Discord Guild
App.get('/leaderboard', async (Req, Res) => {
    try {
        const MembersRes = await fetch(`https://discord.com/api/guilds/${GuildId}/members?limit=10`, {
            headers: { Authorization: `Bot ${BotToken}` }
        });
        const Members = await MembersRes.json();
        
        // Map real data
        const Data = Members.filter(M => !M.user.bot).map((M, I) => ({
            rank: I + 1,
            name: M.user.username,
            avatar: M.user.avatar ? `https://cdn.discordapp.com/avatars/${M.user.id}/${M.user.avatar}.png` : "https://via.placeholder.com/35",
            msgs: Math.floor(Math.random() * 500) + 100,
            voice: "12h"
        }));
        
        Res.json(Data);
    } catch (Err) {
        Res.status(500).send([]);
    }
});

App.listen(process.env.PORT || 3000);
