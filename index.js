/**
 * =====================================================================
 * Project: LIUXESE (코린 강명 에디션) - Turbo Immortal Version
 * =====================================================================
 */

require('dotenv').config();
const { Client } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const express = require('express');

process.on('unhandledRejection', () => {});
process.on('uncaughtException', () => {});

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('LIUXESE (코린 강명 에디션) Bot is alive!');
});

app.listen(PORT, () => {
    console.log(`[SYS] Web server is running and listening on port ${PORT}`);
});

const ADMIN_A_ID = "1429412320194592811";
const ADMIN_B_ID = "268406110690607104";

let adminListA = [ADMIN_A_ID];
let adminListB = [ADMIN_B_ID];

const TOKENS_A = [
    process.env.TOKEN_A_1, process.env.TOKEN_A_2, process.env.TOKEN_A_3,
    process.env.TOKEN_A_4, process.env.TOKEN_A_5, process.env.TOKEN_A_6,
    process.env.TOKEN_A_7, process.env.TOKEN_A_8, process.env.TOKEN_A_9,
    process.env.TOKEN_A_10, process.env.TOKEN_A_11, process.env.TOKEN_A_12,
    process.env.TOKEN_A_13, process.env.TOKEN_A_14, process.env.TOKEN_A_15,
    process.env.TOKEN_A_16, process.env.TOKEN_A_17
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

const createInitialState = (prefix) => ({
    prefix,
    autoReaction: null,
    dmTasks: {},
    sfTargets: {},
    relayTimers: [],
    relayGeneration: 0,
    isRelaying: false,
    relayInterval: 100,
    relayRandomRange: null,
    dmInterval: 150,
    audioPlayers: {}
});

const adminStates = {
    [ADMIN_A_ID]: createInitialState(savedPrefixes[ADMIN_A_ID]),
    [ADMIN_B_ID]: createInitialState(savedPrefixes[ADMIN_B_ID])
};

const getRandomSixDigit = () => Math.floor(100000 + Math.random() * 900000);

const getRandomFourCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let out = '';
    for (let i = 0; i < 4; i++) {
        out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
};

const randomUniformMs = (minMs, maxMs) => minMs + Math.random() * (maxMs - minMs);

const getNextRelayDelayMs = (state) => {
    if (state.relayRandomRange) {
        return randomUniformMs(state.relayRandomRange.minMs, state.relayRandomRange.maxMs);
    }
    return Math.max(10, state.relayInterval);
};

let cachedTtWords = null;
let lastTtLoad = 0;

const getRandomTtWord = () => {
    const now = Date.now();
    if (!cachedTtWords || now - lastTtLoad > 5000) {
        try {
            if (fs.existsSync(ttFilePath)) {
                const data = fs.readFileSync(ttFilePath, 'utf8');
                const lines = data.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
                if (lines.length > 0) {
                    cachedTtWords = lines;
                    lastTtLoad = now;
                }
            }
        } catch (err) {}
    }
    if (cachedTtWords && cachedTtWords.length > 0) {
        return cachedTtWords[Math.floor(Math.random() * cachedTtWords.length)];
    }
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

const getTextChannelFast = (cli, channelId) => {
    if (!cli || !cli.isReady()) return Promise.resolve(null);
    const cached = cli.channels.cache.get(channelId);
    if (cached && typeof cached.send === 'function') return Promise.resolve(cached);
    return cli.channels.fetch(channelId).then(ch => (ch && typeof ch.send === 'function' ? ch : null)).catch(() => null);
};

const clearAllRelayTimers = (state) => {
    state.isRelaying = false;
    state.relayGeneration += 1;
    if (Array.isArray(state.relayTimers)) {
        for (const t of state.relayTimers) clearTimeout(t);
        state.relayTimers = [];
    } else if (state.relayTimers) {
        clearTimeout(state.relayTimers);
        state.relayTimers = [];
    }
};

console.log("========================================");
console.log(" [SYS] LIUXESE (코린 강명 에디션) TURBO 가동 중...");
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
                const currentPrefix = state.prefix;

                if (state.autoReaction) {
                    message.react(state.autoReaction).catch(() => {});
                }

                if (!message.content) return;

                const hasPrefix = message.content.startsWith(currentPrefix);
                const bodyText = hasPrefix ? message.content.slice(currentPrefix.length).trim() : message.content.trim();
                if (!bodyText) return;

                const args = bodyText.split(/ +/);
                const rawCommand = args.shift();
                const command = rawCommand.toLowerCase();
                const param = args.join(" ");

                if (command === "gaeum") {
                    clearAllRelayTimers(state);
                    for (const key in state.dmTasks) {
                        if (state.dmTasks[key]) {
                            clearInterval(state.dmTasks[key]);
                            delete state.dmTasks[key];
                        }
                    }
                    for (const key in state.sfTargets) {
                        delete state.sfTargets[key];
                    }

                    const stopMsg = "```\n[-] 모든 도배, 장애타 및 테러를 즉시 중지합니다.\n```";
                    await Promise.allSettled(
                        myClients.map(async (cli) => {
                            const ch = await getTextChannelFast(cli, message.channel.id);
                            if (ch) await ch.send(stopMsg).catch(() => {});
                        })
                    );
                    return;
                }

                if (state.sfTargets[message.channel.id] === userId && !hasPrefix) {
                    const randomCode = getRandomSixDigit();
                    const contentToMimic = `${message.content}\n-# 코린이 근성 이긴 횟수 < (${randomCode})`;
                    await Promise.allSettled(
                        myClients.map(async (cli) => {
                            const ch = await getTextChannelFast(cli, message.channel.id);
                            if (ch) await ch.send(contentToMimic).catch(() => {});
                        })
                    );
                    return;
                }

                const allowWithoutPrefix = ["iya", "iyas", "v", "b", "unji", "gaeum", "cxhs"];
                if (!hasPrefix && !allowWithoutPrefix.includes(command)) return;

                const sendGuideAll = async (text) => {
                    const content = `\`\`\`\n${text}\n\`\`\``;
                    await Promise.allSettled(
                        myClients.map(async (cli) => {
                            const ch = await getTextChannelFast(cli, message.channel.id);
                            if (ch) await ch.send(content).catch(() => {});
                        })
                    );
                };

                if (command === "b") {
                    const randomKey = generateLicenseKey();
                    const p = state.prefix;
                    const helpText = [
                        "︻デ═一 L I U X E S E (코린 강명 에디션)",
                        "----------------------------------------",
                        `1. ${p}nomu | 원본 근성 도배 시작`,
                        `2. ${p}tt [내용] | 지정한 내용 도배`,
                        `3. ${p}ty | 장애타 도배 시작 (tt.txt 랜덤)`,
                        `4. ${p}unji [속도/생략시 2~3초랜덤] | 릴레이 간격 설정`,
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

                    await sendGuideAll(helpText);
                    return;
                }

                const startImmortalRelay = async (guideText, channelId, getContentFunc) => {
                    clearAllRelayTimers(state);
                    const currentGen = state.relayGeneration;
                    state.isRelaying = true;

                    await sendGuideAll(guideText);
                    if (!state.isRelaying || currentGen !== state.relayGeneration) return;

                    myClients.forEach((cli, bIdx) => {
                        const runBotLoop = () => {
                            if (!state.isRelaying || currentGen !== state.relayGeneration) return;

                            getTextChannelFast(cli, channelId)
                                .then(ch => {
                                    if (ch && state.isRelaying && currentGen === state.relayGeneration) {
                                        return ch.send(getContentFunc()).catch(() => {});
                                    }
                                })
                                .catch(() => {})
                                .finally(() => {
                                    if (state.isRelaying && currentGen === state.relayGeneration) {
                                        const nextDelay = getNextRelayDelayMs(state);
                                        const timer = setTimeout(runBotLoop, nextDelay);
                                        state.relayTimers.push(timer);
                                    }
                                });
                        };

                        const startDelay = bIdx * 10;
                        const initTimer = setTimeout(runBotLoop, startDelay);
                        state.relayTimers.push(initTimer);
                    });
                };

                if (command === "ya") {
                    const newPrefix = args[0];
                    if (!newPrefix) {
                        await sendGuideAll(`[-] 현재 설정된 접두사는 \`${state.prefix}\` 입니다. 변경할 접두사를 입력해주세요 (예: ${state.prefix}ya !)`);
                        return;
                    }
                    state.prefix = newPrefix;

                    const currentAllPrefixes = loadPrefixes();
                    currentAllPrefixes[adminId] = newPrefix;
                    savePrefixes(currentAllPrefixes);

                    await sendGuideAll(`[+] 접두사가 성공적으로 변경되어 영구 저장되었습니다. 앞으로 \`${newPrefix}\`를 사용하세요.`);
                    return;
                }

                if (command === "iya") {
                    const emoji = args[0];
                    if (!emoji) {
                        await sendGuideAll(`[-] 설정할 이모지를 입력해주세요. (예: ${state.prefix}iya 👍)`);
                        return;
                    }
                    state.autoReaction = emoji;
                    await sendGuideAll(`[+] 오토 리액션이 설정되었습니다: ${emoji}`);
                    return;
                }

                if (command === "iyas") {
                    state.autoReaction = null;
                    await sendGuideAll("[-] 오토 리액션이 중지(해제)되었습니다.");
                    return;
                }

                if (command === "hyun") {
                    const targetUser = message.mentions?.users?.first() || args[0];
                    const targetId = typeof targetUser === 'string' ? targetUser.replace(/<@!?>/g, '') : targetUser?.id;

                    if (!targetId) {
                        await sendGuideAll("[-] 추가할 유저의 멘션이나 ID를 정확히 입력해주세요.");
                        return;
                    }
                    if (currentAdminList.includes(targetId)) {
                        await sendGuideAll("[-] 이미 해당 클러스터의 관리자 권한을 가진 유저입니다.");
                        return;
                    }
                    currentAdminList.push(targetId);
                    await sendGuideAll(`[+] 새로운 관리자가 추가되었습니다. (ID: ${targetId})`);
                    return;
                }

                if (command === "no") {
                    const targetUser = message.mentions?.users?.first() || args[0];
                    const targetId = typeof targetUser === 'string' ? targetUser.replace(/<@!?>/g, '') : targetUser?.id;

                    if (!targetId) {
                        await sendGuideAll("[-] 권한을 박탈할 관리자의 멘션이나 ID를 정확히 입력해주세요.");
                        return;
                    }
                    if (currentAdminList.length <= 1) {
                        await sendGuideAll("[-] 마지막 남은 관리자는 제거할 수 없습니다.");
                        return;
                    }
                    const indexNum = currentAdminList.indexOf(targetId);
                    if (indexNum === -1) {
                        await sendGuideAll("[-] 목록에 존재하지 않는 관리자입니다.");
                        return;
                    }
                    currentAdminList.splice(indexNum, 1);
                    await sendGuideAll(`[-] 해당 유저의 관리자 권한이 박탈되었습니다. (ID: ${targetId})`);
                    return;
                }

                if (command === "mu") {
                    if (currentAdminList.length === 0) {
                        await sendGuideAll("[-] 현재 등록된 관리자가 없습니다.");
                        return;
                    }
                    const listText = currentAdminList.map((id, idx) => `${idx + 1}. <@${id}> (${id})`).join("\n");
                    await sendGuideAll(`[ 등록된 관리자 목록 ]\n${listText}`);
                    return;
                }

                if (command === "sss") {
                    for (const key in state.dmTasks) {
                        if (state.dmTasks[key]) {
                            clearInterval(state.dmTasks[key]);
                            delete state.dmTasks[key];
                        }
                    }
                    await sendGuideAll("[-] DM 테러를 중지합니다.");
                    return;
                }

                if (command === "sf") {
                    const targetUser = message.mentions?.users?.first();
                    if (!targetUser) {
                        if (state.sfTargets[message.channel.id]) {
                            delete state.sfTargets[message.channel.id];
                            await sendGuideAll("[-] 말 따라하기(sf) 기능이 해제되었습니다.");
                        } else {
                            await sendGuideAll(`[-] 따라하게 할 유저를 멘션해주세요. (예: ${state.prefix}sf @유저)`);
                        }
                        return;
                    }
                    state.sfTargets[message.channel.id] = targetUser.id;
                    await sendGuideAll(`[+] ${targetUser.tag}님의 말을 따라하기 시작합니다.`);
                    return;
                }

                if (command === "nomu") {
                    const baseGeunseong = (payloadType === 'A')
                        ? "A\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n# 코린찬양해라애미뒤진새기들아 \n@everyone\nhttps://cdn.discordapp.com/attachments/1572902260193624136/1572909824201724016/2.gif?ex=6b0015ed&is=6afec46d&hm=776e4cebcb779e184725b91027b9f35b688e0153d22ec5706804cb45a1a9db8c&"
                        : "A\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n# 강명찬양해라 좆밥들아ㅋㅋ\nhttps://cdn.discordapp.com/attachments/1571872351283453983/1572190547706384404/7.gif?ex=6afd780c&is=6afc268c&hm=d2a7c7c265d67ab1df54975d3d8ed153f7c3a3b431a6cbeb7cfa31fd36956a84&";

                    await startImmortalRelay(
                        `[+] [Admin ${adminId.slice(-4)}] ${myClients.length}개 봇 근성 도배 시작.`,
                        message.channel.id,
                        () => `${baseGeunseong}\n-# 코린이 근성 이긴 횟수 < (${getRandomSixDigit()})`
                    );
                    return;
                }

                if (command === "tt") {
                    if (state.isRelaying) {
                        await message.channel.send("이미 도배 중임").catch(() => {});
                        return;
                    }

                    const startIdx = (hasPrefix ? currentPrefix.length : 0) +
                        message.content.slice(hasPrefix ? currentPrefix.length : 0).trimStart().indexOf(rawCommand) +
                        rawCommand.length;
                    const rawContent = message.content.slice(startIdx).trim();

                    if (!rawContent) {
                        await message.channel.send(`사용법: ${currentPrefix}tt 메시지`).catch(() => {});
                        return;
                    }

                    clearAllRelayTimers(state);
                    const currentGen = state.relayGeneration;
                    state.isRelaying = true;
                    const channelId = message.channel.id;

                    await message.channel.send("도배 시작").catch(() => {});
                    if (!state.isRelaying || currentGen !== state.relayGeneration) return;

                    myClients.forEach((cli) => {
                        const scheduleNext = (delayMs) => {
                            if (!state.isRelaying || currentGen !== state.relayGeneration) return;
                            const timer = setTimeout(async () => {
                                if (!state.isRelaying || currentGen !== state.relayGeneration) return;
                                try {
                                    const ch = await getTextChannelFast(cli, channelId);
                                    if (ch && state.isRelaying && currentGen === state.relayGeneration) {
                                        const suffix = getRandomFourCode();
                                        await ch.send(`${rawContent} ${suffix}`);
                                    }
                                    scheduleNext(randomUniformMs(2000, 3000));
                                } catch (err) {
                                    const status = err?.status ?? err?.httpStatus ?? err?.code;
                                    if (status === 429) {
                                        scheduleNext(5000);
                                    } else {
                                        scheduleNext(randomUniformMs(2000, 3000));
                                    }
                                }
                            }, delayMs);
                            state.relayTimers.push(timer);
                        };

                        scheduleNext(randomUniformMs(2000, 3000));
                    });
                    return;
                }

                if (command === "ty") {
                    await startImmortalRelay(
                        `[+] [Admin ${adminId.slice(-4)}] tt.txt 랜덤 장애타 도배 시작.`,
                        message.channel.id,
                        () => `${getRandomTtWord()}\n-# 코린이 근성 이긴 횟수 < (${getRandomSixDigit()})`
                    );
                    return;
                }

                if (command === "unji") {
                    if (!args[0]) {
                        state.relayRandomRange = { minMs: 2000, maxMs: 3000 };
                        await sendGuideAll("[-] 초고속 모드 종료! 이제 2~3초 사이 랜덤 간격(소수점 랜덤)으로 메시지를 보냅니다.");
                        return;
                    }

                    const rawNum = parseFloat(args[0]);
                    if (isNaN(rawNum) || rawNum <= 0) {
                        state.relayInterval = 100;
                        state.relayRandomRange = null;
                        await sendGuideAll("[+] 최고 속도 모드(0.1초 / 100ms)로 설정되었습니다.");
                        return;
                    }

                    const intervalMs = rawNum < 10
                        ? Math.max(10, rawNum * 1000)
                        : Math.min(60000, Math.max(10, rawNum));

                    state.relayRandomRange = null;
                    state.relayInterval = intervalMs;
                    await sendGuideAll(`[+] 속도 모드가 ${(intervalMs / 1000).toFixed(3)}초(${intervalMs}ms)로 설정되었습니다.`);
                    return;
                }

                if (command === "v") {
                    const guildId = message.guild?.id;
                    if (!guildId) return;

                    let targetChannelId = args[0]?.replace(/[<#>]/g, '');

                    if (!targetChannelId) {
                        targetChannelId = message.member?.voice?.channelId || null;

                        if (!targetChannelId) {
                            const member = await message.guild.members.fetch(message.author.id).catch(() => null);
                            targetChannelId = member?.voice?.channelId || null;
                        }
                    }

                    // 퇴장
                    if (!targetChannelId) {
                        for (const cli of myClients) {
                            try {
                                if (!cli.user) continue;

                                const group = cli.user.id;
                                const connection = getVoiceConnection(guildId, group);

                                if (connection) {
                                    connection.destroy();
                                }

                                if (state.audioPlayers[cli.user.id]) {
                                    state.audioPlayers[cli.user.id].stop();
                                    delete state.audioPlayers[cli.user.id];
                                }
                            } catch (err) {
                                console.error("[VOICE EXIT]", err.message);
                            }
                        }

                        await sendGuideAll("[-] 음성 채널 퇴장을 요청했습니다.");
                        return;
                    }

                    const results = await Promise.allSettled(
                        myClients.map(async (cli) => {
                            if (!cli.isReady() || !cli.user) {
                                throw new Error("봇이 준비되지 않았습니다");
                            }

                            const guild = cli.guilds.cache.get(guildId)
                                || await cli.guilds.fetch(guildId);

                            const voiceChannel = guild.channels.cache.get(targetChannelId)
                                || await guild.channels.fetch(targetChannelId);

                            if (!voiceChannel || !voiceChannel.isVoiceBased()) {
                                throw new Error("음성 채널을 찾을 수 없습니다");
                            }

                            const group = cli.user.id;

                            const oldConnection = getVoiceConnection(guildId, group);
                            if (oldConnection) oldConnection.destroy();

                            const connection = joinVoiceChannel({
                                channelId: voiceChannel.id,
                                guildId: guild.id,
                                adapterCreator: guild.voiceAdapterCreator,
                                selfDeaf: false,
                                selfMute: false,
                                group
                            });

                            return connection;
                        })
                    );

                    const success = results.filter(r => r.status === "fulfilled").length;

                    results.forEach((result, index) => {
                        if (result.status === "rejected") {
                            console.error(
                                `[VOICE ERROR] Bot #${index + 1}:`,
                                result.reason?.message
                            );
                        }
                    });

                    await sendGuideAll(
                        `[+] 음성 연결 요청 완료: ${success}/${myClients.length}`
                    );

                    return;
                }

                if (command === "cxh") {
                    const guildId = message.guild?.id;
                    if (!guildId) return;
                    const fileNum = args[0];
                    if (!['1', '2', '3', '4'].includes(fileNum)) {
                        await sendGuideAll(`[-] 재생할 파일 번호를 입력해주세요. (예: ${state.prefix}cxh 1)`);
                        return;
                    }

                    const fileName = `${fileNum}.mp3`;
                    const filePath = path.join(__dirname, fileName);
                    if (!fs.existsSync(filePath)) {
                        await sendGuideAll(`[-] ${fileName} 파일이 폴더에 존재하지 않습니다.`);
                        return;
                    }

                    await sendGuideAll(`[+] 봇 ${myClients.length}마리 전체 ${fileName} 무한 루프 재생 시작!`);
                    for (const cli of myClients) {
                        try {
                            if (!cli.user) continue;
                            const conn = getVoiceConnection(guildId, cli.user.id);
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
                    }
                    return;
                }

                if (command === "cxhs") {
                    for (const cli of myClients) {
                        try {
                            if (state.audioPlayers[cli.user.id]) {
                                state.audioPlayers[cli.user.id].stop();
                                delete state.audioPlayers[cli.user.id];
                            }
                        } catch (e) {}
                    }
                    await sendGuideAll("[-] 오디오 재생을 중지합니다.");
                    return;
                }

                if (command === "jm") {
                    if (!param) return;
                    for (const cli of myClients) {
                        try {
                            if (cli.user) cli.user.setPresence({ activities: [{ name: param, type: 'PLAYING' }] });
                        } catch (err) {}
                    }
                    await sendGuideAll("[+] 상태메시지가 변경되었습니다.");
                    return;
                }

                if (command === "ddak") {
                    const target = message.mentions?.users?.first();
                    if (!target) return;
                    try {
                        await message.delete().catch(() => {});
                        const sent = await message.channel.send(`<@${target.id}>`);
                        setTimeout(() => { sent.delete().catch(() => {}); }, 150);
                    } catch (err) {}
                    return;
                }

                if (command === "ssib") {
                    const statusType = args[0]?.toLowerCase();
                    if (['online', 'idle', 'dnd', 'invisible'].includes(statusType)) {
                        for (const cli of myClients) {
                            try {
                                if (cli.user) cli.user.setPresence({ status: statusType });
                            } catch (err) {}
                        }
                        await sendGuideAll(`[+] 접속 상태가 ${statusType}(으)로 변경되었습니다.`);
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
                        await sendGuideAll("[-] 테러할 유저의 멘션이나 올바른 ID를 입력해주세요.");
                        return;
                    }

                    await sendGuideAll(`[+] ${targetUser.tag || targetUser.id}님에게 DM 테러를 시작합니다.`);
                    const spamContent = (payloadType === 'A')
                        ? "A\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n# 코린찬양해라애미뒤진새기들아 \n@everyone\nhttps://cdn.discordapp.com/attachments/1572902260193624136/1572909824201724016/2.gif?ex=6b0015ed&is=6afec46d&hm=776e4cebcb779e184725b91027b9f35b688e0153d22ec5706804cb45a1a9db8c&"
                        : "A\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n\nA\n\n\n\n# 강명찬양해라 좆밥들아ㅋㅋ\nhttps://cdn.discordapp.com/attachments/1571872351283453983/1572190547706384404/7.gif?ex=6afd780c&is=6afc268c&hm=d2a7c7c265d67ab1df54975d3d8ed153f7c3a3b431a6cbeb7cfa31fd36956a84&";

                    for (const cli of myClients) {
                        if (state.dmTasks[cli.user.id]) clearInterval(state.dmTasks[cli.user.id]);
                        const dmSpeed = state.dmInterval;
                        state.dmTasks[cli.user.id] = setInterval(async () => {
                            try {
                                const target = await cli.users.fetch(targetUser.id).catch(() => null);
                                if (target) {
                                    await target.send(`${spamContent}\n-# 코린이 근성 이긴 횟수 < (${getRandomSixDigit()})`);
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
                    const hsVal = parseInt(args[0], 10);
                    if (isNaN(hsVal) || hsVal < 1 || hsVal > 100) {
                        await sendGuideAll("[-] 속도는 1~100 사이 숫자로 입력해주세요.");
                        return;
                    }
                    state.dmInterval = Math.max(5, 1100 - (hsVal * 10));
                    await sendGuideAll(`[+] DM 테러 속도가 조절되었습니다 (${state.dmInterval}ms).`);
                    return;
                }

                if (command === "k") {
                    try {
                        const fetched = await message.channel.messages.fetch({ limit: 50 });
                        const deletePromises = [];
                        for (const cli of myClients) {
                            const myMsgs = fetched.filter(m => m.author.id === cli.user.id);
                            for (const msg of myMsgs.values()) {
                                deletePromises.push(msg.delete().catch(() => {}));
                            }
                        }
                        await Promise.allSettled(deletePromises);
                        await sendGuideAll("[+] 메시지 청소를 완료했습니다.");
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