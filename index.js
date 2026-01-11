import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();
const App = express();
App.use(cors());
App.use(express.json());

const BotToken = process.env.BOT_TOKEN;
const GuildId = process.env.GUILD_ID;
const RoleId = process.env.ROLE_ID;
const MongoUri = process.env.MONGO_URI;

// Database Connection
mongoose.connect(MongoUri).then(() => console.log('MongoDB Connected')).catch(Err => console.log(Err));

// User Schema
const UserSchema = new mongoose.Schema({
    discordId: String,
    username: String,
    joinedAt: Date,
    level: { type: Number, default: 0 },
    xp: { type: Number, default: 0 }
});
const User = mongoose.model('User', UserSchema);

// Auth And Role Assignment
App.post('/userinfo', async (Req, Res) => {
    const { access_token } = Req.body;
    try {
        const UserRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${access_token}` }
        });
        const UserData = await UserRes.json();

        if (!UserData.id) return Res.status(401).json({ Error: "Invalid Token" });

        // Assign Core Supporter Role
        await fetch(`https://discord.com/api/guilds/${GuildId}/members/${UserData.id}/roles/${RoleId}`, {
            method: 'PUT',
            headers: { Authorization: `Bot ${BotToken}` }
        });

        const MemberRes = await fetch(`https://discord.com/api/guilds/${GuildId}/members/${UserData.id}`, {
            headers: { Authorization: `Bot ${BotToken}` }
        });
        const MemberData = await MemberRes.json();

        // Database Sync
        let LocalUser = await User.findOne({ discordId: UserData.id });
        if (!LocalUser) {
            LocalUser = new User({
                discordId: UserData.id,
                username: UserData.username,
                joinedAt: MemberData.joined_at || new Date()
            });
            await LocalUser.save();
        }

        Res.json({
            ...UserData,
            joinedAt: LocalUser.joinedAt,
            level: LocalUser.level,
            xp: LocalUser.xp
        });
    } catch (Err) {
        Res.status(500).json({ Error: "Server Error" });
    }
});

const Port = process.env.PORT || 3000;
App.listen(Port, () => console.log(`Server Running On Port ${Port}`));
