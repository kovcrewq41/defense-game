const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const data = require('./data.js'); 
const { UNIT_DB, ITEM_DB, STAGE_DB, RELIC_ENGINE } = data; 

if (!UNIT_DB || !ITEM_DB || !STAGE_DB || !RELIC_ENGINE) {
    console.error("데이터 로드 실패! data.js 파일과 module.exports를 확인하세요.");
} else {
    console.log("데이터 로드 성공!");
}

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
app.get('/multi', (req, res) => res.sendFile(__dirname + '/multi.html'));

let rooms = {}; 
const baseUnits = ["SWORD_1", "ARCHER_1", "MAGE_1", "SHIELD_1", "GUNNER_1", "NINJA_1"];

function getValidSpawnPos(room, side) { 
    let cols = side === "left" ? [1, 2, 3] : [5, 6, 7]; 
    let emptyTiles = []; 
    for (let r = 1; r <= 5; r++) { 
        for (let c of cols) { 
            if (!room.units.some(u => u.gridX === c && u.gridY === r)) { 
                emptyTiles.push({ col: c, row: r }); 
            } 
        } 
    } 
    if (emptyTiles.length === 0) return null; 
    return emptyTiles[Math.floor(Math.random() * emptyTiles.length)]; 
}

let globalTick = 0; 

setInterval(() => {
    globalTick++;
    for (let roomCode in rooms) {
        let room = rooms[roomCode];
        
        if (room.isStarted && !room.isGameOver) {
            
            let stageDef = STAGE_DB[room.stage] || STAGE_DB[1];
            let maxWave = stageDef.maxWave;
            let hpMulti = stageDef.hpMultiplier; 

            let speedSteps = room.gameSpeed || 1;
            for (let step = 0; step < speedSteps; step++) {
                
                if (room.countdown > 0) { 
                    room.countdown--; 
                    continue; 
                }
                room.frameCount++;

                if (room.waveState === 'SPAWNING') {
                    if (room.frameCount % 60 === 0) { // ★ 30 -> 60 으로 원상복구! (싱글과 동일하게 1초 템포)
                        let baseMaxHp = 50 + (room.frameCount / 100);
                        let mSpeed = 0.8; let radius = 15; let mutantType = "NORMAL";
                        
                        if (room.stage > 1) {
                            const mutantChance = Math.min(0.2 + (room.stage - 2) * 0.15, 0.6);
                            if (Math.random() < mutantChance) {
                                if (Math.random() < 0.5) { mutantType = "FAST"; mSpeed = 1.4 + (room.stage * 0.1); baseMaxHp *= 0.5; radius = 10; }
                                else { mutantType = "TANK"; mSpeed = 0.4; baseMaxHp *= 2.5; radius = 20; }
                            }
                        }

                        // ★ DB에서 몬스터 시트 이름 가져오기
                        let sheetSrc = stageDef.mobSheetSrc || "monster_1.png";
                        let sheetRow = stageDef.mobSheetRow !== undefined ? stageDef.mobSheetRow : 0; 
                        
                        // ★ 5스테이지 하드모드 전용 몬스터 스킨 매핑
                        if (room.stage >= 5) {
                            if (mutantType === "FAST") sheetRow = 2;      // 2행: 박쥐 (빠름)
                            else if (mutantType === "TANK") sheetRow = 3; // 3행: 해골 (탱커)
                            else sheetRow = Math.random() < 0.5 ? 0 : 1;  // 0,1행: 슬라임/유령 (일반)
                        } else {
                            if (room.stage === 2) sheetRow = 1; else if (room.stage === 3) sheetRow = 3; else if (room.stage === 4) sheetRow = 5; 
                            if (mutantType === "FAST") sheetRow = 4; 
                            if (mutantType === "TANK") sheetRow = 2; 
                        }

                        const spawnMonster = (sideStr) => {
                            let mType = (Math.random() < 0.3) ? "FIRE" : "NORMAL";
                            let mPath = sideStr === "left" 
                                ? [ {c: 0, r: 0}, {c: 8, r: 0}, {c: 8, r: 6}, {c: 4, r: 6} ] 
                                : [ {c: 8, r: 0}, {c: 0, r: 0}, {c: 0, r: 6}, {c: 4, r: 6} ];

                            let startTileX = (720 / 2) - (9 * 80) / 2 + mPath[0].c * 80 + 40;
                            let startTileY = 550 - (7 * 80) / 2 + mPath[0].r * 80 + 40;
                            let rType = "NONE";
                            if (room.stage >= 5) { rType = Math.random() < 0.5 ? "PHYSICAL" : "MAGIC"; }

                            room.monsters.push({
                                id: Math.random().toString(36).substr(2, 9), path: mPath, pathIndex: 0, x: startTileX, y: startTileY - 80, targetY: startTileY, isEntering: true,
                                hp: baseMaxHp * hpMulti, maxHp: baseMaxHp * hpMulti, speed: mSpeed, radius: radius, type: mType, mutantType: mutantType, isBoss: false, stunTimer: 0, poisonTimer: 0, poisonDmg: 0, 
                                sheetSrc: sheetSrc, // ★ 클라이언트로 시트 이름 전송
                                sheetRow: sheetRow, animOffset: Math.floor(Math.random() * 4), resistType: rType
                            });
                        };

                        spawnMonster("left");
                        spawnMonster("right");
                        room.monstersSpawnedThisWave += 2;
                    }
                    
                    if (room.monstersSpawnedThisWave >= 40) {
                        let isFinal = (room.currentWave === maxWave);
                        let isMidBoss = (room.currentWave % 5 === 0);
                        if (isMidBoss || isFinal) {
                            let bossBaseHp = 500 + (room.frameCount / 2);
                            if (isFinal) bossBaseHp *= 2;
                            
                            const spawnBoss = (sideStr) => {
                                let mPath = sideStr === "left" 
                                    ? [ {c: 0, r: 0}, {c: 8, r: 0}, {c: 8, r: 6}, {c: 4, r: 6} ] 
                                    : [ {c: 8, r: 0}, {c: 0, r: 0}, {c: 0, r: 6}, {c: 4, r: 6} ];

                                let startTileX = (720 / 2) - (9 * 80) / 2 + mPath[0].c * 80 + 40;
                                let startTileY = 550 - (7 * 80) / 2 + mPath[0].r * 80 + 40;

                                room.monsters.push({
                                    id: Math.random().toString(36).substr(2, 9),
                                    path: mPath, pathIndex: 0,
                                    x: startTileX, y: startTileY - 80, targetY: startTileY, isEntering: true,
                                    hp: bossBaseHp * hpMulti, maxHp: bossBaseHp * hpMulti, speed: 0.3, radius: 30,
                                    type: "NORMAL", mutantType: "NORMAL", isBoss: true, isFinalBoss: isFinal, stunTimer: 0, poisonTimer: 0, poisonDmg: 0
                                });
                            };
                            
                            spawnBoss("left");
                            spawnBoss("right");
                            io.to(roomCode).emit('boss_spawned');
                        }
                        room.waveState = 'WAITING_CLEAR';
                    }
                } else if (room.waveState === 'WAITING_CLEAR') {
                    if (room.monsters.length === 0) {
                        let waveBonusGold = room.currentWave * 5;
                        room.players.forEach(p => p.gold += waveBonusGold); 
                        
                        if (room.currentWave >= maxWave) {
                            room.isGameOver = true;
                            io.to(roomCode).emit('game_clear', { stats: room.stats, stage: room.stage });
                        } else {
                            room.waveState = 'COUNTDOWN';
                            room.waveTimer = 180; 
                        }
                    }
                } else if (room.waveState === 'COUNTDOWN') {
                    room.waveTimer--;
                    if (room.waveTimer <= 0) {
                        room.currentWave++; room.monstersSpawnedThisWave = 0; room.waveState = 'SPAWNING';
                    }
                }

                let synergies = { left: {SWORD:0, ARCHER:0, MAGE:0, SHIELD:0, GUNNER:0, NINJA:0}, right: {SWORD:0, ARCHER:0, MAGE:0, SHIELD:0, GUNNER:0, NINJA:0} };
                room.units.forEach(u => { let stats = UNIT_DB[u.type]; if(stats && stats.trait) synergies[u.side][stats.trait]++; });
                
                let auras = room.units.filter(u => (UNIT_DB[u.type] && UNIT_DB[u.type].skill && UNIT_DB[u.type].skill.type.startsWith('aura_')));
                let hasGlobalSlow = auras.some(u => UNIT_DB[u.type].skill.type === 'aura_global_slow');

                room.units.forEach(u => {
                    if (u.attackAnimTimer > 0) u.attackAnimTimer--; if (u.timer > 0) u.timer--;
                    if (u.timer <= 0) {
                        const stats = UNIT_DB[u.type]; if (!stats) return;
                        let syn = synergies[u.side][stats.trait];
                        let buffedDamage = stats.damage; let buffedCooldown = stats.cooldown; let buffedRange = stats.range;
                        
                        if (u.hyperTimer > 0) { u.hyperTimer--; buffedCooldown = Math.floor(buffedCooldown * 0.33); }

                        auras.forEach(a => { 
                            let aSkill = UNIT_DB[a.type].skill;
                            if (a.side === u.side) {
                                let dist = Math.hypot(a.x - u.x, a.y - u.y); 
                                if (aSkill.type === 'aura_buff_dmg' && dist <= aSkill.radius) buffedDamage = Math.floor(buffedDamage * aSkill.value); 
                                if (aSkill.type === 'aura_buff_all' && dist <= aSkill.radius) { buffedDamage = Math.floor(buffedDamage * aSkill.value); buffedCooldown = Math.max(10, Math.floor(buffedCooldown / aSkill.value)); } 
                            }
                        });

                        if (u.items) {
                            u.items.forEach(itemId => {
                                let itemDef = ITEM_DB[itemId];
                                if (itemDef) {
                                    if (itemDef.type === "dmg") buffedDamage = Math.floor(buffedDamage * itemDef.value);
                                    if (itemDef.type === "spd") buffedCooldown = Math.floor(buffedCooldown * itemDef.value);
                                    if (itemDef.type === "rng") buffedRange += itemDef.value;
                                }
                            });
                        }

                        let pSideObj = room.players.find(p => p.side === u.side);
                        let pProfile = pSideObj ? pSideObj.profile : { passives: { attackBoostLvl: 0 }, mastery: {}, relics: {} };

                        let statMods = RELIC_ENGINE.getStatMods(pProfile.relics);
                        let relicDmgMult = statMods.dmgMult;
                        buffedCooldown = Math.floor(buffedCooldown * statMods.spdFactor);
                        if (buffedCooldown < 10) buffedCooldown = 10;
                        buffedRange += statMods.rangeBonus;

                        const passiveMultiplier = 1 + ((pProfile.passives?.attackBoostLvl || 0) * 0.05);
                        const classMasteryLvl = pProfile.mastery?.[stats.trait] || 0;
                        const masteryMultiplier = 1 + (classMasteryLvl * 0.1);
                        const finalDamage = Math.floor(buffedDamage * passiveMultiplier * masteryMultiplier * relicDmgMult);

                        let target = null;
                        let validMonsters = [];
                        let rangeSq = buffedRange * buffedRange;
                        
                        room.monsters.forEach(m => {
                            let dx = m.x - u.x; let dy = m.y - u.y;
                            let distSq = dx*dx + dy*dy;
                            if (distSq <= rangeSq) validMonsters.push({ m, distSq });
                        });
                        
                        if (validMonsters.length > 0) {
                            if (stats.trait === "ARCHER" || stats.trait === "GUNNER") {
                                validMonsters.sort((a, b) => b.m.hp - a.m.hp); 
                            } else if (stats.trait === "NINJA") {
                                validMonsters.sort((a, b) => b.m.pathIndex - a.m.pathIndex); 
                            } else {
                                validMonsters.sort((a, b) => a.distSq - b.distSq); 
                            }
                            target = validMonsters[0].m;
                        }
                        
                        if (target) {
                            let activeSkill = null;
                            let pStyle = stats.projectile ? stats.projectile.style : "default";
                            let pColor = stats.projectile ? stats.projectile.color : "#ffff00";
                            let pSplash = stats.splashRadius || 0;

                            if (stats.skill && stats.skill.type.startsWith('proc_')) {
                                if (Math.random() < stats.skill.chance) {
                                    activeSkill = stats.skill;
                                    if (activeSkill.type === 'proc_hyper_spd') u.hyperTimer = activeSkill.duration;
                                    if (activeSkill.type === 'proc_meteor') { pColor = "#ff5722"; pStyle = "meteor"; }
                                }
                            } else if (stats.skill && stats.skill.type.startsWith('passive_')) {
                                activeSkill = stats.skill;
                            }

                            if (activeSkill && activeSkill.type === 'proc_global_dmg') {
                                room.monsters.forEach(m => {
                                    let dmg = finalDamage * activeSkill.mult;
                                    m.hp -= dmg;
                                    if (u.side === "left") room.stats.p1Damage += dmg; else room.stats.p2Damage += dmg;
                                    if (m.hp <= 0 && !m.isDead) {
                                        m.isDead = true; room.stats.kills++;
                                        let bonusMult = RELIC_ENGINE.getGoldBonus(pProfile.relics);
                                        let earnedGold = (m.isBoss ? 50 : 3) * (1 + bonusMult);
                                        room.players.forEach(pl => pl.gold += earnedGold);
                                    }
                                });
                                u.timer = buffedCooldown; u.attackAnimTimer = 20; 
                                return; 
                            }

                            let targets = [target];
                            if (activeSkill && activeSkill.type === 'passive_multishot') {
                                targets = validMonsters.slice(0, activeSkill.targets).map(v => v.m);
                            }

                            targets.forEach(t => {
                                room.projectiles.push({ id: Math.random().toString(36).substr(2, 9), x: u.x, y: u.y, targetId: t.id, damage: finalDamage, speed: 10, side: u.side, style: pStyle, color: pColor, splashRadius: pSplash, skill: activeSkill, damageType: stats.damageType || "PHYSICAL" });
                            });
                            u.timer = buffedCooldown; u.attackAnimTimer = 20; 
                        }
                    }
                });

                for (let i = room.projectiles.length - 1; i >= 0; i--) {
                    let p = room.projectiles[i]; let target = room.monsters.find(m => m.id === p.targetId);
                    if (!target) { room.projectiles.splice(i, 1); continue; }
                    let dist = Math.hypot(target.x - p.x, target.y - p.y);
                    
                    if (dist <= 15) { 
                        let finalDamage = p.damage;
                        // ★ 서버에도 데미지 반감 로직 적용!
                        if (target.resistType === "PHYSICAL" && p.damageType === "PHYSICAL") finalDamage = Math.floor(finalDamage * 0.5);
                        if (target.resistType === "MAGIC" && p.damageType === "MAGIC") finalDamage = Math.floor(finalDamage * 0.5);
                        
                        let splashRad = p.splashRadius;
                        let s = p.skill;

                        if (s) {
                            if (s.type === 'proc_crit') finalDamage *= s.mult;
                            if (s.type === 'passive_boss_killer' && target.isBoss) finalDamage *= s.mult;
                            if (s.type === 'proc_execute') {
                                if (target.isBoss) finalDamage *= s.bossMult;
                                else finalDamage = target.hp + 9999;
                            }
                            if (s.type === 'proc_percent_dmg') finalDamage += target.hp * s.percent;
                            if (s.type === 'proc_knockback') { target.y -= s.pushDist; target.stunTimer = 60; }
                            if (s.type === 'passive_poison') { target.poisonTimer = 180; target.poisonDmg = finalDamage * 0.2; }
                            if (s.type === 'proc_stun') target.stunTimer = s.duration;
                            if (s.type === 'proc_splash') { finalDamage *= s.mult; splashRad = (splashRad || 40) * s.radiusMult; }
                            if (s.type === 'proc_meteor') { finalDamage *= s.mult; splashRad = s.radius; }
                            if (s.type === 'proc_pierce') { finalDamage *= s.mult; splashRad = 150; } 
                        }
                        
                        if (splashRad > 0) {
                            let splashSq = splashRad * splashRad;
                            room.monsters.forEach(otherM => {
                                if (otherM.id !== target.id && !otherM.isDead) {
                                    let dx = otherM.x - target.x; let dy = otherM.y - target.y;
                                    if (dx*dx + dy*dy <= splashSq) {
                                        let splashDmg = Math.floor(finalDamage * 0.8);
                                        otherM.hp -= splashDmg;
                                        if (p.side === "left") room.stats.p1Damage += splashDmg; else room.stats.p2Damage += splashDmg;
                                        
                                        if (otherM.hp <= 0 && !otherM.isDead) {
                                            otherM.isDead = true; room.stats.kills++;
                                            let pSideObj = room.players.find(pl => pl.side === p.side);
                                            let bonusMult = RELIC_ENGINE.getGoldBonus(pSideObj ? pSideObj.profile.relics : {});
                                            let earnedGold = (otherM.isBoss ? 50 : 3) * (1 + bonusMult);
                                            room.players.forEach(pl => pl.gold += earnedGold);
                                        }
                                    }
                                }
                            });
                        }

                        target.hp -= finalDamage; room.projectiles.splice(i, 1); 
                        if (p.side === "left") room.stats.p1Damage += finalDamage; else room.stats.p2Damage += finalDamage;
                        
                        if (target.hp <= 0 && !target.isDead) { 
                            target.isDead = true; room.stats.kills++; 
                            let pSideObj = room.players.find(pl => pl.side === p.side);
                            let pProfile = pSideObj ? pSideObj.profile : { relics: {} };
                            
                            let bonusMult = RELIC_ENGINE.getGoldBonus(pProfile.relics);
                            let earnedGold = (target.isBoss ? 50 : 3) * (1 + bonusMult);
                            
                            room.players.forEach(pl => {
                                pl.gold += earnedGold;
                                if (target.isBoss && pl.inventory.length < 5) {
                                    let itemKeys = Object.keys(ITEM_DB);
                                    pl.inventory.push(itemKeys[Math.floor(Math.random() * itemKeys.length)]);
                                }
                            }); 
                        } 
                    } else { 
                        p.x += (target.x - p.x) / dist * p.speed; 
                        p.y += (target.y - p.y) / dist * p.speed; 
                    }
                }

                room.monsters = room.monsters.filter(m => !m.isDead);
                room.monsters.forEach(m => { 
                    if (m.poisonTimer > 0) {
                        if (m.poisonTimer % 30 === 0) {
                            m.hp -= m.poisonDmg;
                            if (m.hp <= 0 && !m.isDead) {
                                m.isDead = true; room.stats.kills++;
                                let earnedGold = (m.isBoss ? 50 : 3);
                                room.players.forEach(pl => pl.gold += earnedGold);
                            }
                        }
                        m.poisonTimer--;
                    }

                    if (m.stunTimer > 0) {
                        m.stunTimer--;
                    } else {
                        let curSpeed = m.speed; if (hasGlobalSlow) curSpeed *= 0.7;
                        if (m.isEntering) {
                            m.y += curSpeed;
                            if (m.y >= m.targetY) { m.y = m.targetY; m.isEntering = false; }
                        } else {
                            let targetNode = m.path[m.pathIndex + 1];
                            if (targetNode) {
                                const startX = (720 / 2) - (9 * 80) / 2;
                                const startY = 550 - (7 * 80) / 2;
                                let tx = startX + targetNode.c * 80 + 40;
                                let ty = startY + targetNode.r * 80 + 40;
                                let dx = tx - m.x; let dy = ty - m.y;
                                let dist = Math.sqrt(dx*dx + dy*dy);
                                
                                if (dist < curSpeed) {
                                    m.x = tx; m.y = ty; m.pathIndex++;
                                } else {
                                    m.x += (dx/dist)*curSpeed; m.y += (dy/dist)*curSpeed;
                                }
                            } else {
                                if (m.isBoss) { room.nexusHp = 0; } else { room.nexusHp -= 1; }
                                m.isDead = true; 
                            }
                        }
                    }
                });
                room.monsters = room.monsters.filter(m => !m.isDead);

                if (room.nexusHp <= 0 && !room.isGameOver) { 
                    room.isGameOver = true; io.to(roomCode).emit('game_over', room.stats); 
                }
            } 

            // ★ 서버의 30FPS 송신 제한 해제 (무조건 60FPS로 전송하여 싱글과 완벽히 일치!)
            io.to(roomCode).emit('game_state', { 
                countdown: room.countdown, monsters: room.monsters, units: room.units, projectiles: room.projectiles, nexusHp: room.nexusHp, players: room.players, currentWave: room.currentWave, maxWave: maxWave, stage: room.stage, waveState: room.waveState, waveTimer: room.waveTimer, frameCount: room.frameCount,
                gameSpeed: room.gameSpeed, stats: room.stats 
            });
        }
    }
}, 1000 / 60);

io.on('connection', (socket) => {
    socket.on('join_room', (data) => {
        let roomCode = data.roomCode; socket.roomCode = roomCode;
        if (!rooms[roomCode]) {
            rooms[roomCode] = { 
                players: [], monsters: [], units: [], projectiles: [], frameCount: 0, countdown: 300, currentWave: 1, 
                stage: data.stage, nexusHp: 10, isGameOver: false, 
                stats: { kills: 0, p1Damage: 0, p2Damage: 0 }, 
                waveState: 'SPAWNING', waveTimer: 0, monstersSpawnedThisWave: 0,
                gameSpeed: 1, isStarted: false 
            };
        }
        let room = rooms[roomCode]; socket.join(roomCode);
        
        let side = room.players.some(p => p.side === "left") ? "right" : "left";
        let userProfile = data.profile || { passives: { startGoldLvl: 0, attackBoostLvl: 0 }, mastery: {}, relics: {}, unlockedHiddens: [] };
        
        let startingGold = 300 + ((userProfile.passives?.startGoldLvl || 0) * 20);

        room.players.push({ id: socket.id, side: side, gold: startingGold, inventory: [], profile: userProfile });
        socket.emit('assign_side', side);
        
        let spawnTiers = RELIC_ENGINE.getSpawnTiers(userProfile.relics);
        spawnTiers.forEach(tier => {
            const pos = getValidSpawnPos(room, side);
            if (pos) {
                const arr = ["SWORD_", "ARCHER_", "MAGE_", "SHIELD_", "GUNNER_", "NINJA_"].map(t => t + tier);
                room.units.push({
                    id: Math.random().toString(36).substr(2, 9), type: arr[Math.floor(Math.random() * arr.length)], side: side,
                    gridX: pos.col, gridY: pos.row, x: pos.col * 80 + 40, y: 270 + pos.row * 80 + 40, timer: 0, attackAnimTimer: 0, items: []
                });
            }
        });
        
        if (room.players.length >= 2) {
            room.isStarted = true;
            io.to(roomCode).emit('game_start');
        }
    });

    socket.on('disconnect', () => {
        let roomCode = socket.roomCode;
        if (roomCode && rooms[roomCode]) {
            rooms[roomCode].players = rooms[roomCode].players.filter(p => p.id !== socket.id);
            if (rooms[roomCode].players.length === 0) {
                delete rooms[roomCode]; 
            }
        }
    });

    socket.on('toggle_speed', () => {
        let room = rooms[socket.roomCode];
        if (room) { room.gameSpeed = (room.gameSpeed === 1) ? 2 : 1; }
    });

    socket.on('request_gacha', () => {
        let room = rooms[socket.roomCode]; if (!room) return;
        let player = room.players.find(p => p.id === socket.id); if (!player) return;

        if (player.gold >= 100) {
            let pos = getValidSpawnPos(room, player.side);
            if (!pos) { socket.emit('show_msg', { msg: "진영에 빈 칸이 없습니다!", color: "#ff5252" }); return; }
            
            player.gold -= 100;
            const rareUnits = ["SWORD_2", "ARCHER_2", "MAGE_2", "SHIELD_2", "GUNNER_2", "NINJA_2"];
            const classIndex = Math.floor(Math.random() * 6); 
            const spawnUnitId = (Math.random() < 0.10) ? rareUnits[classIndex] : baseUnits[classIndex];
            
            let newUnit = {
                id: Math.random().toString(36).substr(2, 9), type: spawnUnitId, side: player.side,
                gridX: pos.col, gridY: pos.row, x: pos.col * 80 + 40, y: 270 + pos.row * 80 + 40, timer: 0, attackAnimTimer: 0, items: []
            };
            room.units.push(newUnit);
            socket.emit('show_msg', { msg: "소환 완료!", color: "#69f0ae" });
        } else {
            socket.emit('show_msg', { msg: "골드가 부족합니다!", color: "#ff5252" });
        }
    });

    socket.on('use_active', (type) => {
        let room = rooms[socket.roomCode]; if (!room) return;
        let player = room.players.find(p => p.id === socket.id); if (!player) return;

        if (type === 'BOMB') {
            if (player.gold >= 300) {
                player.gold -= 300;
                room.monsters.forEach(m => {
                    let dmg = 500;
                    m.hp -= dmg;
                    if (player.side === "left") room.stats.p1Damage += dmg; else room.stats.p2Damage += dmg;
                    
                    if (m.hp <= 0 && !m.isDead) {
                        m.isDead = true; room.stats.kills++;
                        let bonusMult = RELIC_ENGINE.getGoldBonus(player.profile.relics);
                        let earnedGold = (m.isBoss ? 50 : 3) * (1 + bonusMult);
                        room.players.forEach(pl => pl.gold += earnedGold);
                    }
                });
            } else { socket.emit('show_msg', { msg: "골드가 부족합니다!", color: "#ff5252" }); }
        } else if (type === 'HEAL') {
            if (player.gold >= 500) {
                if (room.nexusHp < 10) {
                    player.gold -= 500;
                    room.nexusHp = Math.min(room.nexusHp + 3, 10);
                } else { socket.emit('show_msg', { msg: "넥서스 체력이 이미 가득 찼습니다!", color: "#ff5252" }); }
            } else { socket.emit('show_msg', { msg: "골드가 부족합니다!", color: "#ff5252" }); }
        }
    });

    socket.on('equip_item', (data) => {
        let room = rooms[socket.roomCode]; if (!room) return;
        let player = room.players.find(p => p.id === socket.id); if (!player) return;
        
        let unit = room.units.find(u => u.id === data.unitId && u.side === player.side);
        if (unit && player.inventory[data.itemIndex]) {
            if (unit.items.length < 3) {
                unit.items.push(player.inventory[data.itemIndex]);
                player.inventory.splice(data.itemIndex, 1);
            }
        }
    });

    socket.on('sell_unit', (data) => {
        let room = rooms[socket.roomCode]; if (!room) return;
        let player = room.players.find(p => p.id === socket.id);
        let unitIndex = room.units.findIndex(u => u.id === data.id && u.side === player.side);
        if (unitIndex !== -1 && player) {
            let basePrice = UNIT_DB[room.units[unitIndex].type].sellPrice || 50;
            let sellBonusMult = RELIC_ENGINE.getSellBonus(player.profile?.relics || {});
            let finalSellPrice = Math.floor(basePrice * (1 + sellBonusMult)); 
            player.gold += finalSellPrice; room.units.splice(unitIndex, 1);
        }
    });

    socket.on('upgrade_unit', (data) => {
        let room = rooms[socket.roomCode]; if (!room) return;
        let player = room.players.find(p => p.id === socket.id);
        let unit = room.units.find(u => u.id === data.id && u.side === player.side);
        if (unit && player) {
            let uDef = UNIT_DB[unit.type];
            let cost = uDef.upgradeCost;
            
            let nextDef = UNIT_DB[data.next];
            if (nextDef.isHidden && (!player.profile.unlockedHiddens || !player.profile.unlockedHiddens.includes(data.next))) {
                socket.emit('show_msg', { msg: "연구소에서 히든 영웅을 해금하세요!", color: "#ff5252" });
                return;
            }

            if (player.gold >= cost) { 
                player.gold -= cost; 
                let chance = uDef.upgradeChance || 1.0;
                
                if (Math.random() <= chance) {
                    unit.type = data.next;
                    socket.emit('show_msg', { msg: "강화 성공!!", color: "#69f0ae" });
                } else {
                    unit.type = uDef.failDrop || unit.type;
                    socket.emit('show_msg', { msg: "강화 실패... (유닛 유지)", color: "#ff5252" });
                }
            } else {
                socket.emit('show_msg', { msg: "골드가 부족합니다!", color: "#ff5252" });
            }
        }
    });

    socket.on('move_unit', (data) => {
        let room = rooms[socket.roomCode]; if (!room) return;
        let unit = room.units.find(u => u.id === data.id);
        if (unit) {
            let targetUnit = room.units.find(u => u.gridX === data.gridX && u.gridY === data.gridY);
            if (targetUnit) { 
                targetUnit.gridX = unit.gridX; targetUnit.gridY = unit.gridY;
                targetUnit.x = targetUnit.gridX * 80 + 40; targetUnit.y = 270 + targetUnit.gridY * 80 + 40;
            }
            unit.gridX = data.gridX; unit.gridY = data.gridY;
            unit.x = unit.gridX * 80 + 40; unit.y = 270 + unit.gridY * 80 + 40;
        }
    });
});

http.listen(3000, '0.0.0.0', () => { console.log('멀티플레이 서버가 3000번 포트에서 열렸습니다!'); });