// Imports
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();
const App = express();

// Allow all origins (Fixes CORS issues)
App.use(cors({ origin: '*' }));
App.use(express.json());

const BotToken = process.env.BOT_TOKEN;
const GuildId = process.env.GUILD_ID;
const MongoUri = process.env.MONGO_URI;

// Level Roles Config
const LevelRoles = {
    2: "1453526180950052896", 5: "1453526492406616084", 7: "1453526611688161453",
    9: "1453526743993553031", 10: "1453526840722325617", 15: "1453526946486030336",
    20: "1453527066342326342", 25: "1453527174219960422", 30: "1453527289089229021"
};

mongoose.connect(MongoUri)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error("❌ Mongo Error:", err));

const UserSchema = new mongoose.Schema({
    discordId: String,
    username: String,
    joinedAt: Date,
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 }
});
const User = mongoose.model('User', UserSchema);

// User Info (Login / Auth)
App.post('/userinfo', async (Req, Res) => {
    const { code, access_token } = Req.body;
    let finalToken = access_token;

    try {
        if (code) {
            const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
                method: 'POST',
                body: new URLSearchParams({
                    client_id: process.env.CLIENT_ID,
                    client_secret: process.env.CLIENT_SECRET,
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: process.env.REDIRECT_URI,
                }),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });

            const tokenData = await tokenResponse.json();
            if (tokenData.error) return Res.status(400).json({ Error: "Discord Auth Failed", Details: tokenData });
            finalToken = tokenData.access_token;
        }

        if (!finalToken) return Res.status(401).json({ Error: "No Valid Token Provided" });

        // Get Discord User Data
        const UserRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${finalToken}` }
        });
        
        if (UserRes.status !== 200) return Res.status(401).json({ Error: "Invalid Token on Discord API" });
        const UserData = await UserRes.json();

        // Get Guild Member Data
        const MemberRes = await fetch(`https://discord.com/api/guilds/${GuildId}/members/${UserData.id}`, {
            headers: { Authorization: `Bot ${BotToken}` }
        });
        
        let joinedDate = new Date();
        let nickname = null;

        if (MemberRes.ok) {
            const MemberData = await MemberRes.json();
            joinedDate = MemberData.joined_at;
            nickname = MemberData.nick;
        }

        // Database Sync
        let LocalUser = await User.findOne({ discordId: UserData.id });
        if (!LocalUser) {
            LocalUser = new User({
                discordId: UserData.id,
                username: UserData.username,
                joinedAt: joinedDate
            });
            await LocalUser.save();
        }

        // Role Sync
        if (LevelRoles[LocalUser.level]) {
            await fetch(`https://discord.com/api/guilds/${GuildId}/members/${UserData.id}/roles/${LevelRoles[LocalUser.level]}`, {
                method: 'PUT',
                headers: { Authorization: `Bot ${BotToken}` }
            });
        }

        Res.json({
            ...UserData,
            new_access_token: code ? finalToken : undefined,
            joinedAt: LocalUser.joinedAt,
            level: LocalUser.level,
            xp: LocalUser.xp,
            guildNickname: nickname
        });

    } catch (Err) {
        console.error(Err);
        Res.status(500).json({ Error: "Internal Server Error" });
    }
});

// Change Nickname
App.post('/change-nickname', async (Req, Res) => {
    const { access_token, discordId, newNickname } = Req.body;

    try {
        // Validate User first
        const UserRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${access_token}` }
        });
        if (!UserRes.ok) return Res.status(401).json({ Error: "Unauthorized" });

        // Update Nickname via Bot
        const UpdateRes = await fetch(`https://discord.com/api/guilds/${GuildId}/members/${discordId}`, {
            method: 'PATCH',
            headers: { 
                'Authorization': `Bot ${BotToken}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ nick: newNickname })
        });

        if (UpdateRes.ok) Res.json({ success: true });
        else Res.status(UpdateRes.status).json({ Error: "Failed to update nickname. Bot might lack permissions." });

    } catch (Err) {
        Res.status(500).json({ Error: "Server Error" });
    }
});

// Delete Data
App.delete('/delete-data', async (Req, Res) => {
    const { discordId, access_token } = Req.body;
    
    // Verify user before deleting
    const UserRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` }
    });
    if (!UserRes.ok) return Res.status(401).json({ Error: "Unauthorized" });

    try {
        await User.deleteOne({ discordId: discordId });
        Res.json({ success: true });
    } catch (Err) {
        Res.status(500).json({ Error: "DB Error" });
    }
});

const Port = process.env.PORT || 3000;
App.listen(Port, () => console.log(`Server Running on Port ${Port}`));
