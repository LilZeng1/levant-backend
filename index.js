// Imports
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();
const App = express();
App.use(cors());
App.use(express.json());

// Important Variables
const BotToken = process.env.BOT_TOKEN;
const GuildId = process.env.GUILD_ID;
const RoleId = process.env.ROLE_ID;

mongoose.connect(process.env.MONGO_URI).then(() => console.log('MongoDB Connected'));

// userSchema {}
const UserSchema = new mongoose.Schema({
    discordId: String,
    username: String,
    joinedAt: Date,
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 }
});
const User = mongoose.model('User', UserSchema);

// LevelRoles {}
const LevelRoles = {
    2: "1453526180950052896", 5: "1453526492406616084", 7: "1453526611688161453",
    9: "1453526743993553031", 10: "1453526840722325617", 15: "1453526946486030336",
    20: "1453527066342326342", 25: "1453527174219960422", 30: "1453527289089229021"
};

App.post('/userinfo', async (Req, Res) => {
    const { access_token } = Req.body;
    try {
        const UserRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${access_token}` }
        });
        const UserData = await UserRes.json();
        if (!UserData.id) return Res.status(401).json({ Error: "Invalid Token" });

        // Get Member Data
        const MemberRes = await fetch(`https://discord.com/api/guilds/${GuildId}/members/${UserData.id}`, {
            headers: { Authorization: `Bot ${BotToken}` }
        });
        const MemberData = await MemberRes.json();

        let localUser = await User.findOne({ discordId: UserData.id });
        if (!localUser) {
            localUser = new User({
                discordId: UserData.id,
                username: UserData.username,
                joinedAt: MemberData.joined_at || new Date()
            });
            await localUser.save();
        }

        // Auto Role Assignment Based on Level
        if (LevelRoles[localUser.level]) {
            await fetch(`https://discord.com/api/guilds/${GuildId}/members/${UserData.id}/roles/${LevelRoles[localUser.level]}`, {
                method: 'PUT',
                headers: { Authorization: `Bot ${BotToken}` }
            });
        }

        Res.json({ ...UserData, joinedAt: localUser.joinedAt, level: localUser.level });
    } catch (Err) {
        Res.status(500).json({ Error: "Server Error" });
    }
});

App.listen(process.env.PORT || 3000);
