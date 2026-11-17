/**
 * =====================================================================
 * Project: LIUXESE (코린 강명 에디션) - Env & Pure Bot Version
 * Architecture: discord.js@13 (@discordjs/voice)
 * =====================================================================
 */

require('dotenv').config();
const { Client } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

// 관리자 정보 정의
const ADMIN_A_ID = "1429412320194592811";
const ADMIN_B_ID = "268406110690607104";

let adminListA = [ADMIN_A_ID];
let adminListB = [ADMIN_B_ID];

// .env 파일에서 토큰 배열 로드
const TOKENS_A = [
    process.env.TOKEN_A_1, process.env.TOKEN_A_2, process.env.TOKEN_A_3,
    process.env.TOKEN_A_4, process.env.TOKEN_A_5, process.env.TOKEN_A_6,
    process.env.TOKEN_A_7, process.env.TOKEN_A_8, process.env.TOKEN_A_9,
    process.env.TOKEN_A_10
].filter(Boolean);

const TOKENS_B = [
    process.env.TOKEN_B_1, process.env.TOKEN_B_2, process.env.TOKEN_B_3,
    process.env.TOKEN_B_4, process.env.TOKEN_B_5, process.env.TOKEN_B_6,
    process.env.TOKEN_B_7, process.env.TOKEN_B_8, process.env.TOKEN_B_9,
    process.env.TOKEN_B_10
].filter(Boolean);

const prefixFilePath = path.join(__dirname, 'prefix.json');
const ttFilePath = path.join(__dirname, 'tt.txt');

const loadPrefixes = () => {
    try {
        if (fs.existsSync(prefixFilePath)) {
            const data = fs.readFileSync(prefixFilePath, 'utf8');
            const parsed = JSON.parse(data);
            return {
                [ADMIN_A_ID]: parsed[ADMIN_A_ID] || ">",
                [ADMIN_B_ID]: parsed[ADMIN_B_ID] || ">"
            };
        }
    } catch (err) {}
    return { [ADMIN_A_ID]: ">", [ADMIN_B_ID]: ">" };
};

const savePrefixes = (prefixes) => {
    try {
        fs.writeFileSync(prefixFilePath, JSON.stringify(prefixes, null, 2), 'utf8');
    } catch (err) {}
};

const savedPrefixes = loadPrefixes();

const adminStates = {
    [ADMIN_A_ID]: { prefix: savedPrefixes[ADMIN_A_ID], autoReaction: null, dmTasks: {}, sfTargets: {}, relayTimers: null, dmInterval: 500, audioPlayers: {} },
    [ADMIN_B_ID]: { prefix: savedPrefixes[ADMIN_B_ID], autoReaction: null, dmTasks: {}, sfTargets: {}, relayTimers: null, dmInterval: 500, audioPlayers: {} }
};

const getRandomSixDigit = () => Math.floor(100000 + Math.random() * 900000);

const getRandomTtWord = () => {
    try {
        if (fs.existsSync(ttFilePath)) {
            const data = fs.readFileSync(ttFilePath, 'utf8');
            const lines = data.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length > 0) return lines[Math.floor(Math.random() * lines.length)];
        }
    } catch (err) {}
    return "코린찬양해라";
};

const generateLicenseKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
        result += Math.floor(1000 + Math.random() * 9000);
        if (i < 3) result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

console.log("========================================");
console.log(" [SYS] LIUXESE (코린 강명 에디션) 가동 중...");
console.log("========================================");

const clusters = {
    [ADMIN_A_ID]: { clients: [], payloadType: 'A' },
    [ADMIN_B_ID]: { clients: [], payloadType: 'B' }
};

const setupCluster = (tokens, adminId, payloadType) => {
    const currentAdminList = (payloadType === 'A') ? adminListA : adminListB;

    tokens.forEach((token, index) => {
        if (!token) return;

        const client = new Client({ intents: 3276799 });
        clusters[adminId].clients.push(client);

        client.on('ready', () => {
            console.log(`[SYS] [Admin ${adminId.slice(-4)}] Bot #${index + 1} 인증 완료: ${client.user.tag}`);
        });

        client.on('messageCreate', async (message) => {
            try {
                if (!message || !message.author || message.author.bot) return;

                const userId = message.author.id;
                if (!currentAdminList.includes(userId)) return;

                const state = adminStates[adminId];
                const myClients = clusters[adminId].clients;
                const myIndex = myClients.indexOf(client);
                const currentPrefix = state.prefix;

                // [최우선 긴급 정지 gaeum] 도배 큐 밀림 방지를 위해 맨 위에서 즉시 차단
                if (message.content && message.content.startsWith(currentPrefix)) {
                    const rawCmd = message.content.slice(currentPrefix.length).trim().split(/ +/)[0];
                    if (rawCmd.toLowerCase() === "gaeum") {
                        const guildId = message.guild?.id;
                        if (guildId && state.relayTimers) {
                            clearTimeout(state.relayTimers);
                            state.relayTimers = null;
                        }
                        for (const key in state.dmTasks) {
                            if (state.dmTasks[key]) {
                                clearInterval(state.dmTasks[key]);
                                delete state.dmTasks[key];
                            }
                        }
                        for (const key in state.sfTargets) {
                            delete state.sfTargets[key];
                        }

                        if (myIndex === 0) {
                            const stopMsg = "```\n[-] 모든 도배, 장애타 및 테러를 즉시 중지합니다.\n```";
                            try {
                                if (message.editable) await message.edit(stopMsg);
                                else await message.channel.send(stopMsg);
                            } catch (e) {
                                try { await message.channel.send(stopMsg); } catch (err) {}
                            }
                        }
                        return;
                    }
                }

                // [sf 기능] 타겟 유저 말 따라하기
                if (state.sfTargets[message.channel.id] === userId && message.content && !message.content.startsWith(currentPrefix)) {
                    const randomCode = getRandomSixDigit();
                    const contentToMimic = `${message.content}\n-# 코린이 강명 에디션 횟수 > (${randomCode})`;
                    try {
                        const ch = await client.channels.fetch(message.channel.id);
                        if (ch && ch.isText()) await ch.send(contentToMimic);
                    } catch (e) {}
                    return;
                }

                if (!message.content || !message.content.startsWith(currentPrefix)) return;

                const args = message.content.slice(currentPrefix.length).trim().split(/ +/);
                const rawCommand = args.shift();
                const command = rawCommand.toLowerCase();
                const param = args.join(" ");

                if (state.autoReaction) {
                    setTimeout(() => { message.react(state.autoReaction).catch(() => {}); }, 10);
                }

                // [도움말 b] 총 22개 명령어 출력
                if (command === "b") {
                    if (myIndex !== 0) return;
                    const randomKey = generateLicenseKey();
                    const p = state.prefix;
                    const helpText = [
                        "︻デ═一 L I U X E S E (코린 강명 에디션)",
                        "----------------------------------------",
                        `1. ${p}nomu | 원본 근성 도배 시작`,
                        `2. ${p}tt [내용] | 지정한 내용 도배`,
                        `3. ${p}ty | 장애타 도배 시작 (tt.txt 랜덤)`,
                        `4. ${p}unji | 초고속 모드`,
                        `5. ${p}gaeum | 도배 및 테러 즉시 중지`,
                        `6. ${p}ya [새접두사] | 접두사 변경`,
                        `7. ${p}jm | 상태메시지 변경`,
                        `8. ${p}ddak @멘션 | 고스트핑`,
                        `9. ${p}ssib | 접속 상태 변경`,
                        `10. ${p}ss @멘션/ID | 봇 DM 테러`,
                        `11. ${p}sss | DM 테러 중지`,
                        `12. ${p}sf @멘션 | 유저 말 따라하기`,
                        `13. ${p}k | 메시지 청소`,
                        `14. ${p}hs 1~100 | DM 테러 속도 조절`,
                        `15. ${p}hyun [@멘션/ID] | 관리자 추가`,
                        `16. ${p}no [@멘션/ID] | 관리자 권한 박탈`,
                        `17. ${p}mu | 관리자 목록 확인`,
                        `18. ${p}v [채널ID] | 음성채널 입장/퇴장`,
                        `19. ${p}cxh [1~4] | 귀갱 오디오 무한 루프`,
                        `20. ${p}cxhs | 귀갱 정지`,
                        `21. ${p}iya [이모지] | 오토 리액션 설정`,
                        `22. ${p}iyas | 오토 리액션 중지`,
                        "----------------------------------------",
                        "made in heaven (코린)",
                        `라이센스 코드 : ${randomKey}`
                    ].join("\n");
                    
                    const boxedHelp = `\`\`\`\n${helpText}\n\`\`\``;
                    try {
                        if (message.editable) await message.edit(boxedHelp);
                        else await message.channel.send(boxedHelp);
                    } catch (e) {}
                    return;
                }

                const startRelayWithGuide = async (guideText, guildId, channelId, getContentFunc) => {
                    if (state.relayTimers) {
                        clearTimeout(state.relayTimers);
                        state.relayTimers = null;
                    }

                    const boxedGuide = `\`\`\`\n${guideText}\n\`\`\``;

                    myClients.forEach(async (cli) => {
                        try {
                            const ch = await cli.channels.fetch(channelId);
                            if (ch && ch.isText()) await ch.send(boxedGuide);
                        } catch (err) {}
                    });

                    let botIndex = 0;
                    const runNext = () => {
                        if (!state.relayTimers) return;

                        const currentClient = myClients[botIndex];
                        if (currentClient) {
                            currentClient.channels.fetch(channelId).then(ch => {
                                if (ch) {
                                    const textToSend = getContentFunc();
                                    ch.send(textToSend).catch(() => {});
                                }
                            }).catch(() => {});
                        }

                        botIndex = (botIndex + 1) % myClients.length;
                        state.relayTimers = setTimeout(runNext, 100);
                    };

                    state.relayTimers = setTimeout(runNext, 20);
                };

                if (myIndex !== 0) return;

                const sendGuide = async (text) => {
                    const content = `\`\`\`\n${text}\n\`\`\``;
                    try { await message.channel.send(content); } catch (err) {}
                };

                // 접두사 변경 명령어 (ya)
                if (command === "ya") {
                    const newPrefix = args[0];
                    if (!newPrefix) {
                        await sendGuide(`[-] 현재 설정된 접두사는 \`${state.prefix}\` 입니다. 변경할 접두사를 입력해주세요 (예: ${state.prefix}ya !)`);
                        return;
                    }
                    state.prefix = newPrefix;
                    
                    const currentAllPrefixes = loadPrefixes();
                    currentAllPrefixes[adminId] = newPrefix;
                    savePrefixes(currentAllPrefixes);

                    await sendGuide(`[+] 접두사가 성공적으로 변경되어 영구 저장되었습니다. 앞으로 \`${newPrefix}\`를 사용하세요.`);
                    return;
                }

                if (command === "iya") {
                    const emoji = args[0];
                    if (!emoji) {
                        await sendGuide(`[-] 설정할 이모지를 입력해주세요. (예: ${state.prefix}iya 👍)`);
                        return;
                    }
                    state.autoReaction = emoji;
                    await sendGuide(`[+] 어드민 오토 리액션이 설정되었습니다: ${emoji}`);
                    return;
                }

                if (command === "iyas") {
                    state.autoReaction = null;
                    await sendGuide("[-] 어드민 오토 리액션이 중지(해제)되었습니다.");
                    return;
                }

                if (command === "hyun") {
                    const targetUser = message.mentions?.users?.first() || args[0];
                    const targetId = typeof targetUser === 'string' ? targetUser.replace(/<@!?>/g, '') : targetUser?.id;

                    if (!targetId) {
                        await message.channel.send("[-] 추가할 유저의 멘션이나 ID를 정확히 입력해주세요.");
                        return;
                    }

                    if (currentAdminList.includes(targetId)) {
                        await message.channel.send("[-] 이미 해당 클러스터의 관리자 권한을 가진 유저입니다.");
                        return;
                    }

                    currentAdminList.push(targetId);
                    await message.channel.send(`[+] 새로운 관리자가 추가되었습니다. (ID: ${targetId})`);
                    return;
                }

                if (command === "no") {
                    const targetUser = message.mentions?.users?.first() || args[0];
                    const targetId = typeof targetUser === 'string' ? targetUser.replace(/<@!?>/g, '') : targetUser?.id;

                    if (!targetId) {
                        await message.channel.send("[-] 권한을 박탈할 관리자의 멘션이나 ID를 정확히 입력해주세요.");
                        return;
                    }

                    if (currentAdminList.length <= 1) {
                        await message.channel.send("[-] 마지막 남은 관리자는 제거할 수 없습니다.");
                        return;
                    }

                    const indexNum = currentAdminList.indexOf(targetId);
                    if (indexNum === -1) {
                        await message.channel.send("[-] 목록에 존재하지 않는 관리자입니다.");
                        return;
                    }

                    currentAdminList.splice(indexNum, 1);
                    await message.channel.send(`[-] 해당 유저의 관리자 권한이 박탈되었습니다. (ID: ${targetId})`);
                    return;
                }

                if (command === "mu") {
                    if (currentAdminList.length === 0) {
                        await message.channel.send("[-] 현재 등록된 관리자가 없습니다.");
                        return;
                    }
                    const listText = currentAdminList.map((id, idx) => `${idx + 1}. <@${id}> (${id})`).join("\n");
                    await message.channel.send(`[ 등록된 관리자 목록 ]\n${listText}`);
                    return;
                }

                if (command === "sss") {
                    for (const key in state.dmTasks) {
                        if (state.dmTasks[key]) {
                            clearInterval(state.dmTasks[key]);
                            delete state.dmTasks[key];
                        }
                    }
                    await sendGuide("[-] DM 테러를 중지합니다.");
                    return;
                }

                if (command === "sf") {
                    const targetUser = message.mentions?.users?.first();
                    if (!targetUser) {
                        if (state.sfTargets[message.channel.id]) {
                            delete state.sfTargets[message.channel.id];
                            await sendGuide("[-] 말 따라하기(sf) 기능이 해제되었습니다.");
                        } else {
                            await sendGuide(`[-] 따라하게 할 유저를 멘션해주세요. (예: ${state.prefix}sf @유저)`);
                        }
                        return;
                    }
                    state.sfTargets[message.channel.id] = targetUser.id;
                    await sendGuide(`[+] ${targetUser.tag}님의 말을 따라하기 시작합니다.`);
                    return;
                }

                if (command === "nomu") {
                    let baseGeunseong = "";
                    if (payloadType === 'A') {
                        baseGeunseong = "A\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n# 코린찬양해라애미뒤진새기들아 \n@everyone\nhttps://cdn.discordapp.com/attachments/1556620343651729419/1572211827062997053/1903434ecf68a313.gif?ex=6afd8bdd&is=6afc3a5d&hm=2eff99586f7c5f85d7ca0390e47a6971e3beb8729f237a73ef5edd7d1d57e20c&";
                    } else {
                        baseGeunseong = "A\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n# 강명찬양해라 좆밥들아ㅋㅋ\nhttps://cdn.discordapp.com/attachments/1571872351283453983/1572190547706384404/7.gif?ex=6afd780c&is=6afc268c&hm=d2a7c7c265d67ab1df54975d3d8ed153f7c3a3b431a6cbeb7cfa31fd36956a84&";
                    }

                    await startRelayWithGuide(
                        `[+] [Admin ${adminId.slice(-4)}] 10개 봇 근성 도배를 시작합니다.`,
                        message.guild.id,
                        message.channel.id,
                        () => {
                            const randomCode = getRandomSixDigit();
                            return `${baseGeunseong}\n-# 코린이 강명 에디션 횟수 > (${randomCode})`;
                        }
                    );
                    return;
                }

                if (command === "tt") {
                    if (!param) {
                        await sendGuide(`[-] 도배할 내용을 입력해주세요. (예: ${state.prefix}tt 내용)`);
                        return;
                    }

                    await startRelayWithGuide(
                        `[+] [Admin ${adminId.slice(-4)}] 지정된 내용으로 도배를 시작합니다.`,
                        message.guild.id,
                        message.channel.id,
                        () => {
                            const randomCode = getRandomSixDigit();
                            return `${param}\n-# 코린이 강명 에디션 횟수 > (${randomCode})`;
                        }
                    );
                    return;
                }

                if (command === "ty") {
                    await startRelayWithGuide(
                        `[+] [Admin ${adminId.slice(-4)}] tt.txt 단어 랜덤 장애타 도배를 시작합니다!`,
                        message.guild.id,
                        message.channel.id,
                        () => {
                            const randomWord = getRandomTtWord();
                            const randomCode = getRandomSixDigit();
                            return `${randomWord}\n-# 코린이 강명 에디션 횟수 > (${randomCode})`;
                        }
                    );
                    return;
                }

                if (command === "unji") {
                    await sendGuide("[+] 초고속 0.1초 릴레이 모드로 작동 중입니다.");
                    return;
                }

                if (command === "v") {
                    const channelId = args[0];
                    const guildId = message.guild?.id;
                    if (!guildId) return;

                    if (!channelId) {
                        await sendGuide("[+] 음성 채널 연결을 해제합니다.");
                        for (const cli of myClients) {
                            try {
                                if (state.audioPlayers[cli.user.id]) {
                                    state.audioPlayers[cli.user.id].stop();
                                    delete state.audioPlayers[cli.user.id];
                                }
                                const g = cli.guilds.cache.get(guildId);
                                if (g) {
                                    const connection = getVoiceConnection(g.id);
                                    if (connection) connection.destroy();
                                }
                            } catch (e) {}
                        }
                        return;
                    }

                    await sendGuide(`[+] 지정된 음성 채널에 봇들 입장을 시작합니다.`);
                    for (const cli of myClients) {
                        try {
                            const g = cli.guilds.cache.get(guildId);
                            if (g) {
                                joinVoiceChannel({
                                    channelId: channelId,
                                    guildId: g.id,
                                    adapterCreator: g.voiceAdapterCreator,
                                    selfDeaf: false,
                                    selfMute: false
                                });
                            }
                        } catch (e) {}
                        await new Promise(r => setTimeout(r, 100));
                    }
                    return;
                }

                if (command === "cxh") {
                    const guildId = message.guild?.id;
                    if (!guildId) return;
                    const fileNum = args[0];
                    if (!['1', '2', '3', '4'].includes(fileNum)) {
                        await sendGuide(`[-] 재생할 파일 번호를 입력해주세요. (예: ${state.prefix}cxh 1)`);
                        return;
                    }

                    const fileName = `${fileNum}.mp3`;
                    const filePath = path.join(__dirname, fileName);
                    if (!fs.existsSync(filePath)) {
                        await sendGuide(`[-] ${fileName} 파일이 폴더에 존재하지 않습니다.`);
                        return;
                    }

                    await sendGuide(`[+] ${fileName} 무한 루프 재생을 시작합니다!`);
                    for (const cli of myClients) {
                        try {
                            const conn = getVoiceConnection(guildId);
                            if (!conn) continue;
                            if (state.audioPlayers[cli.user.id]) state.audioPlayers[cli.user.id].stop();

                            const player = createAudioPlayer();
                            state.audioPlayers[cli.user.id] = player;
                            conn.subscribe(player);

                            const playLoop = () => {
                                if (fs.existsSync(filePath)) {
                                    try {
                                        const resource = createAudioResource(filePath);
                                        player.play(resource);
                                    } catch (err) {}
                                }
                            };

                            player.on(AudioPlayerStatus.Idle, () => { playLoop(); });
                            playLoop();
                        } catch (e) {}
                        await new Promise(r => setTimeout(r, 50));
                    }
                    return;
                }

                if (command === "cxhs") {
                    await sendGuide("[-] 오디오 재생을 중지합니다.");
                    for (const cli of myClients) {
                        try {
                            if (state.audioPlayers[cli.user.id]) {
                                state.audioPlayers[cli.user.id].stop();
                                delete state.audioPlayers[cli.user.id];
                            }
                        } catch (e) {}
                    }
                    return;
                }

                if (command === "jm") {
                    if (!param) return;
                    try {
                        for (const cli of myClients) {
                            if (cli.user) cli.user.setPresence({ activities: [{ name: param, type: 'PLAYING' }] });
                        }
                        await sendGuide("[+] 상태메시지가 변경되었습니다.");
                    } catch (err) {}
                    return;
                }

                if (command === "ddak") {
                    const target = message.mentions?.users?.first();
                    if (!target) return;
                    try {
                        await message.delete().catch(() => {});
                        const sent = await message.channel.send(`<@${target.id}>`);
                        setTimeout(async () => { await sent.delete().catch(() => {}); }, 200);
                    } catch (err) {}
                    return;
                }

                if (command === "ssib") {
                    const statusType = args[0]?.toLowerCase();
                    if (['online', 'idle', 'dnd', 'invisible'].includes(statusType)) {
                        try {
                            for (const cli of myClients) {
                                if (cli.user) cli.user.setPresence({ status: statusType });
                            }
                            await sendGuide(`[+] 접속 상태가 ${statusType}(으)로 변경되었습니다.`);
                        } catch (err) {}
                    }
                    return;
                }

                if (command === "ss") {
                    let targetUser = message.mentions?.users?.first();
                    if (!targetUser && args[0]) {
                        const rawId = args[0].replace(/<@!?>/g, '');
                        if (/^\d{17,19}$/.test(rawId)) {
                            targetUser = await client.users.fetch(rawId).catch(() => null);
                        }
                    }

                    if (!targetUser) {
                        await sendGuide("[-] 테러할 유저의 멘션이나 올바른 ID를 입력해주세요.");
                        return;
                    }

                    await sendGuide(`[+] ${targetUser.tag || targetUser.id}님에게 DM 테러를 시작합니다.`);
                    let spamContent = (payloadType === 'A') 
                        ? "A\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n# 코린찬양해라애미뒤진새기들아 \n@everyone\nhttps://cdn.discordapp.com/attachments/1556620343651729419/1572211827062997053/1903434ecf68a313.gif?ex=6afd8bdd&is=6afc3a5d&hm=2eff99586f7c5f85d7ca0390e47a6971e3beb8729f237a73ef5edd7d1d57e20c&"
                        : "A\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n# 강명찬양해라 좆밥들아ㅋㅋ\nhttps://cdn.discordapp.com/attachments/1571872351283453983/1572190547706384404/7.gif?ex=6afd780c&is=6afc268c&hm=d2a7c7c265d67ab1df54975d3d8ed153f7c3a3b431a6cbeb7cfa31fd36956a84&";

                    for (const cli of myClients) {
                        if (state.dmTasks[cli.user.id]) clearInterval(state.dmTasks[cli.user.id]);
                        const dmSpeed = state.dmInterval;
                        state.dmTasks[cli.user.id] = setInterval(async () => {
                            try { 
                                const target = await cli.users.fetch(targetUser.id).catch(() => null);
                                if (target) {
                                    const randomCode = getRandomSixDigit();
                                    await target.send(`${spamContent}\n-# 코린이 강명 에디션 횟수 > (${randomCode})`);
                                }
                            } catch {
                                if (state.dmTasks[cli.user.id]) {
                                    clearInterval(state.dmTasks[cli.user.id]);
                                    delete state.dmTasks[cli.user.id];
                                }
                            }
                        }, dmSpeed);
                    }
                    return;
                }

                if (command === "hs") {
                    const hsVal = parseInt(args[0]);
                    if (isNaN(hsVal) || hsVal < 1 || hsVal > 100) {
                        await sendGuide("[-] 속도는 1~100 사이 숫자로 입력해주세요.");
                        return;
                    }
                    const newDmInterval = Math.max(5, 1100 - (hsVal * 10));
                    state.dmInterval = newDmInterval;
                    await sendGuide(`[+] DM 테러 속도가 조절되었습니다.`);
                    return;
                }

                if (command === "k") {
                    try {
                        const fetched = await message.channel.messages.fetch({ limit: 50 });
                        for (const cli of myClients) {
                            const myMsgs = fetched.filter(m => m.author.id === cli.user.id);
                            for (const msg of myMsgs.values()) {
                                await msg.delete().catch(() => {});
                            }
                        }
                        await sendGuide("[+] 메시지 청소를 완료했습니다.");
                    } catch (err) {}
                    return;
                }

            } catch (err) {
                console.error(`[ERR] 오류 발생 (Admin ${adminId.slice(-4)} / Bot #${index + 1}):`, err.message);
            }
        });

        client.login(token).catch(err => {
            console.error(`[-] [Admin ${adminId.slice(-4)}] Bot #${index + 1} 로그인 실패:`, err.message);
        });
    });
};

setupCluster(TOKENS_A, ADMIN_A_ID, 'A');
setupCluster(TOKENS_B, ADMIN_B_ID, 'B');