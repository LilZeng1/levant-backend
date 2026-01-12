// Imports
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();
const App = express();

App.use(cors({ origin: '*' }));
App.use(express.json());

// Important Variables
const BotToken = process.env.BOT_TOKEN;
const GuildId = process.env.GUILD_ID;
const MongoUri = process.env.MONGO_URI;
const SupporterRole = "1456104633234886666";

mongoose.connect(MongoUri)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error("❌ Mongo Error:", err));

const UserSchema = new mongoose.Schema({
    discordId: String,
    username: String,
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 }
});
const User = mongoose.model('User', UserSchema);

// userInfo()
App.post('/userinfo', async (Req, Res) => {
    const { code } = Req.body;
    if (!code) return Res.status(400).json({ Error: "No Code Provided" });

    try {
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
        if (tokenData.error) return Res.status(400).json({ Error: "Auth Failed", details: tokenData.error });

        const UserRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const UserData = await UserRes.json();

        try {
            const roleRes = await fetch(`https://discord.com/api/guilds/${GuildId}/members/${UserData.id}/roles/${SupporterRole}`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bot ${BotToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({})
            });

            if (!roleRes.ok) {
                const errorText = await roleRes.text();
                console.log(`⚠️ Rol verilemedi (Normal olabilir, örn: Owner): ${roleRes.status} - ${errorText}`);
            }
        } catch (roleErr) {
            console.error("Rol senkronizasyonunda ağ hatası:", roleErr);
        }

        let LocalUser = await User.findOne({ discordId: UserData.id });
        if (!LocalUser) {
            LocalUser = new User({ discordId: UserData.id, username: UserData.username });
            await LocalUser.save();
        }

        Res.json({
            ...UserData,
            access_token: tokenData.access_token,
            level: LocalUser.level,
            xp: LocalUser.xp
        });

    } catch (Err) {
        console.error(Err);
        Res.status(500).json({ Error: "Internal Server Error" });
    }
});

const Port = process.env.PORT || 3000;
App.listen(Port, () => console.log(`Server running on port ${Port}`));
