const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const YouTube = require('youtube-sr').default; // Para buscar videos
const ytdl = require('@distube/ytdl-core');   // Para obtener el stream de audio

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const prefix = '!';

client.once('ready', () => {
    console.log(`✅ Bot ${client.user.tag} está listo!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'dmc-play') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('¡Necesitás estar en un canal de voz para reproducir música! 🎤');
        }

        const query = args.join(' ');
        if (!query) {
            return message.reply('¡Debes escribir el nombre de una canción o pegar un enlace! 🧐');
        }

        try {
            let video;

            const isUrl = query.includes('youtube.com') || query.includes('youtu.be');

            if (isUrl) {
                const videoInfo = await ytdl.getInfo(query);
                video = {
                    title: videoInfo.videoDetails.title,
                    url: videoInfo.videoDetails.video_url,
                };
            } else {
                video = await YouTube.searchOne(query);
            }
            
            if (!video) {
                return message.reply('❌ No encontré ninguna canción con ese nombre o la URL es inválida.');
            }

            // 2. Obtener el stream de audio con @distube/ytdl-core
            const stream = ytdl(video.url, {
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25, // Buffer de 32MB para evitar pausas
            });

            // 3. Conectarse al canal de voz y preparar el audio
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });

            const resource = createAudioResource(stream);
            const player = createAudioPlayer();

            // 4. Reproducir
            connection.subscribe(player);
            player.play(resource);

            await message.reply(`▶️ Ahora suena: **${video.title}**`);

            // 5. Manejar eventos del reproductor para desconectarse al final
            player.on(AudioPlayerStatus.Idle, () => {
                try {
                    connection.destroy();
                } catch (e) {
                    console.error("Error al destruir la conexión en Idle:", e.message);
                }
            });

            player.on('error', (error) => {
                console.error(`Error en el reproductor: ${error.message}`);
                 try {
                    connection.destroy();
                } catch (e) {
                    console.error("Error al destruir la conexión por error:", e.message);
                }
                message.channel.send('❌ Ocurrió un error y la reproducción se detuvo.');
            });

        } catch (error) {
            console.error('Error al ejecutar el comando play:', error);
            message.reply('❌ Hubo un problema al intentar reproducir la canción.');
        }
    }
});


client.login(process.env.DISCORD_TOKEN);