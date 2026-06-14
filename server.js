const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { UNIT_DB } = require('./data.js'); 

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
app.get('/multi', (req, res) => res.sendFile(__dirname + '/multi.html'));

let rooms = {}; 
// ★ 서버 뽑기 풀 6종으로 수정
const baseUnits = ["SWORD_1", "ARCHER_1", "MAGE_1", "SHIELD_1", "GUNNER_1", "NINJA_1"];
const ITEM_DB = { "SWORD": { type: "dmg", value: 1.2 }, "BOW": { type: "spd", value: 0.85 }, "STAFF": { type: "rng", value: 30 } };
const STAGE_DB = { 1: { maxWave: 20, hpMultiplier: 2.0 }, 2: { maxWave: 20, hpMultiplier: 6.0 }, 3: { maxWave: 20, hpMultiplier: 16.0 }, 4: { maxWave: 20, hpMultiplier: 35.0 } };

function getValidSpawnPos(room, side) { let cols = side === "left" ? [0, 1, 2, 3] : [5, 6, 7, 8]; let emptyTiles = []; for (let r = 0; r < 7; r++) { for (let c of cols) { if (!room.units.some(u => u.gridX === c && u.gridY === r)) { emptyTiles.push({ col: c, row: r }); } } } if (emptyTiles.length === 0) return null; return emptyTiles[Math.floor(Math.random() * emptyTiles.length)]; }

setInterval(() => {
    for (let roomCode in rooms) {
        let room = rooms[roomCode];
        if (room.players.length === 2 && !room.isGameOver) {
            
            if (room.countdown > 0) { room.countdown--; io.to(roomCode).emit('game_state', { countdown: room.countdown, monsters: room.monsters, units: room.units, projectiles: room.projectiles, nexusHp: room.nexusHp, players: room.players, currentWave: room.currentWave, maxWave: STAGE_DB[room.stage].maxWave, stage: room.stage }); continue; }
            room.frameCount++;
            
            // ★ 서버 시너지 초기화 6종으로 수정
            let synergies = { left: {SWORD:0, ARCHER:0, MAGE:0, SHIELD:0, GUNNER:0, NINJA:0}, right: {SWORD:0, ARCHER:0, MAGE:0, SHIELD:0, GUNNER:0, NINJA:0} };
            let uniqueUnits = { left: new Set(), right: new Set() }; room.units.forEach(u => uniqueUnits[u.side].add(u.type));
            uniqueUnits.left.forEach(type => { if(UNIT_DB[type] && UNIT_DB[type].trait) synergies.left[UNIT_DB[type].trait]++; else if(type) synergies.left[type.split('_')[0]]++; }); uniqueUnits.right.forEach(type => { if(UNIT_DB[type] && UNIT_DB[type].trait) synergies.right[UNIT_DB[type].trait]++; else if(type) synergies.right[type.split('_')[0]]++; });
            
            room.units.forEach(u => {
                if (!u.attackAnimTimer) u.attackAnimTimer = 0; if (u.attackAnimTimer > 0) u.attackAnimTimer--;
                if (!u.timer) u.timer = 0; if (u.timer > 0) u.timer--;
                if (u.timer <= 0) {
                    const stats = UNIT_DB[u.type]; if (!stats) return;
                    let owner = room.players.find(p => p.side === u.side); let trait = stats.trait || u.type.split('_')[0]; let syn = synergies[u.side][trait];
                    let buffedDamage = stats.damage; let buffedCooldown = stats.cooldown; let buffedRange = stats.range; let buffedEffect = stats.effect;

                    // ★ 닌자(NINJA) 시너지 적용되도록 수정
                    if (trait === "SWORD" && syn >= 3) buffedCooldown = Math.floor(stats.cooldown * 0.4); 
                    if (trait === "ARCHER" && syn >= 3) { buffedDamage = Math.floor(stats.damage * 1.5); buffedRange += 80; } 
                    if (trait === "MAGE" && syn >= 3) buffedEffect = "deep_slow"; 
                    if (trait === "SHIELD" && syn >= 3) buffedEffect = "deep_stun"; 
                    if (trait === "NINJA") { let critChance = syn >= 3 ? 0.5 : 0.2; let critMult = syn >= 3 ? 3 : 2; if (Math.random() < critChance) { buffedDamage *= critMult; buffedEffect = "crit"; } } 
                    if (trait === "GUNNER" && syn >= 3) { buffedDamage = Math.floor(stats.damage * 1.3); buffedCooldown = Math.floor(stats.cooldown * 0.7); }
                    
                    if (u.items) { u.items.forEach(itemId => { if (ITEM_DB[itemId].type === "dmg") buffedDamage = Math.floor(buffedDamage * ITEM_DB[itemId].value); if (ITEM_DB[itemId].type === "spd") buffedCooldown = Math.floor(buffedCooldown * ITEM_DB[itemId].value); if (ITEM_DB[itemId].type === "rng") buffedRange += ITEM_DB[itemId].value; }); }

                    if (owner && owner.profile) { let pro = owner.profile; let masteryLvl = pro.mastery[trait] || 0; let attackBoostLvl = pro.passives?.attackBoostLvl || 0; let r1 = pro.relics["R1"] || 0; let r2 = pro.relics["R2"] || 0; let r5 = pro.relics["R5"] || 0; let relicMult = 1 + (r1 * 0.1); if (r5 > 0) relicMult *= Math.pow(2, r5); buffedDamage = Math.floor(buffedDamage * (1 + attackBoostLvl * 0.05) * (1 + masteryLvl * 0.1) * relicMult); buffedCooldown = Math.floor(buffedCooldown * Math.pow(0.9, r2)); }
                    if (buffedCooldown < 10) buffedCooldown = 10; 

                    let target = null; let minDist = buffedRange; room.monsters.forEach(m => { let dist = Math.hypot(m.x - u.x, m.y - u.y); if (dist <= minDist) { minDist = dist; target = m; } });

                    if (target) {
                        let pStyle = "default"; let pColor = "#ffff00"; let pSize = 5; let pSpeed = 10;
                        if (stats.projectile) { pStyle = stats.projectile.style; pColor = stats.projectile.color; pSize = stats.projectile.size; pSpeed = stats.projectile.speed; }
                        
                        room.projectiles.push({ id: Math.random().toString(36).substr(2, 9), x: u.x, y: u.y, targetId: target.id, damage: buffedDamage, effect: buffedEffect, speed: pSpeed, side: u.side, style: pStyle, color: pColor, size: pSize });
                        u.timer = buffedCooldown; u.attackAnimTimer = 20; 
                    }
                }
            });

            for (let i = room.projectiles.length - 1; i >= 0; i--) {
                let p = room.projectiles[i]; let target = room.monsters.find(m => m.id === p.targetId);
                if (!target) { room.projectiles.splice(i, 1); continue; }
                let dx = target.x - p.x; let dy = target.y - p.y; let dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= p.speed) {
                    if (p.effect === "stun" || p.effect === "deep_stun") { target.speed = Math.max(target.speed * 0.8, 0.1); if (Math.random() < (p.effect === "deep_stun" ? 0.05 : 0.02)) target.stunTimer = 60; } else if (p.effect === "slow" || p.effect === "deep_slow") { target.speed = Math.max(target.speed * 0.85, 0.1); }
                    if (p.effect === "splash" || p.effect === "deep_splash") { let radius = (p.effect === "deep_splash") ? 100 : 50; room.monsters.forEach(m => { if (Math.hypot(m.x - target.x, m.y - target.y) < radius) m.hp -= p.damage; }); } else { target.hp -= p.damage; }
                    room.projectiles.splice(i, 1);

                    if (target.hp <= 0 && !target.isDead) {
                        target.isDead = true; room.stats.kills++; 
                        room.players.forEach(p => { let bonusGold = (p.profile && p.profile.relics["R3"]) ? p.profile.relics["R3"] * 5 : 0; p.gold += (target.isBoss ? 300 : 30) + bonusGold; if (target.isBoss) { if (p.inventory.length < 5) p.inventory.push(Object.keys(ITEM_DB)[Math.floor(Math.random() * 3)]); } else { if (Math.random() < 0.01 && p.inventory.length < 5) p.inventory.push(Object.keys(ITEM_DB)[Math.floor(Math.random() * 3)]); } });
                        room.stats.goldEarned += (target.isBoss ? 300 : 30) * 2; 
                    }
                } else { p.x += (dx / dist) * p.speed; p.y += (dy / dist) * p.speed; }
            }
            room.monsters = room.monsters.filter(m => !m.isDead);
            for (let i = room.monsters.length - 1; i >= 0; i--) { let m = room.monsters[i]; if (m.stunTimer > 0) m.stunTimer--; else { m.y += m.speed; if (m.y >= 920) { if (m.isBoss) { room.nexusHp = 0; } else { room.nexusHp -= 1; } room.monsters.splice(i, 1); } } }

            if (room.nexusHp <= 0 && !room.isGameOver) { room.nexusHp = 0; room.isGameOver = true; room.stats.wave = room.currentWave; io.to(roomCode).emit('game_over', room.stats); }

            if (!room.isGameOver && room.currentWave <= STAGE_DB[room.stage].maxWave) {
                let maxWave = STAGE_DB[room.stage].maxWave;
                if (room.waveState === 'SPAWNING') {
                    if (room.frameCount % 60 === 0) { let maxHp = (50 + (room.frameCount / 50)) * STAGE_DB[room.stage].hpMultiplier; room.monsters.push({ id: Math.random().toString(36).substr(2, 9), x: 100 + Math.random() * 520, y: -30, speed: 0.8, hp: maxHp, maxHp: maxHp, isBoss: false, stunTimer: 0 }); room.spawned++; }
                    if (room.spawned >= 10) {
                        let isFinal = (room.currentWave === maxWave); let isMidBoss = (room.currentWave % 5 === 0);
                        if (isMidBoss || isFinal) { let maxHp = (500 + room.frameCount) * STAGE_DB[room.stage].hpMultiplier; room.monsters.push({ id: Math.random().toString(36).substr(2, 9), x: 360, y: -30, speed: 0.3, hp: maxHp, maxHp: maxHp, isBoss: true, stunTimer: 0 }); io.to(roomCode).emit('boss_spawned'); }
                        room.waveState = 'WAITING_CLEAR';
                    }
                } else if (room.waveState === 'WAITING_CLEAR') {
                    if (room.monsters.length === 0) {
                        let waveBonus = room.currentWave * 30; room.players.forEach(p => p.gold += waveBonus);
                        if (room.currentWave >= maxWave) { room.isGameOver = true; room.stats.wave = room.currentWave; io.to(roomCode).emit('game_clear', { stage: room.stage, stats: room.stats }); } else { room.waveState = 'COUNTDOWN'; room.waveTimer = 180; }
                    }
                } else if (room.waveState === 'COUNTDOWN') { room.waveTimer--; if (room.waveTimer <= 0) { room.currentWave++; room.spawned = 0; room.waveState = 'SPAWNING'; } }
            } 
            io.to(roomCode).emit('game_state', { countdown: room.countdown, monsters: room.monsters, units: room.units, projectiles: room.projectiles, nexusHp: room.nexusHp, players: room.players, currentWave: room.currentWave, maxWave: STAGE_DB[room.stage].maxWave, stage: room.stage, waveState: room.waveState, waveTimer: room.waveTimer, frameCount: room.frameCount });
        }
    }
}, 1000 / 60);

io.on('connection', (socket) => {
    socket.on('join_room', (data) => { let roomCode = data.roomCode; let profile = data.profile; let reqStage = data.stage || 1; if (!rooms[roomCode]) { rooms[roomCode] = { players: [], monsters: [], units: [], projectiles: [], frameCount: 0, countdown: 300, currentWave: 1, stage: reqStage, nexusHp: 10, isGameOver: false, waveState: 'SPAWNING', spawned: 0, waveTimer: 0, stats: { kills: 0, wave: 1, goldEarned: 0 } }; } let room = rooms[roomCode]; if (room.players.some(p => p.id === socket.id)) return; if (room.players.length >= 2) return socket.emit('error_msg', "방이 꽉 찼습니다!"); socket.join(roomCode); let side = room.players.length === 0 ? "left" : "right"; let startGold = 1000 + ((profile.passives?.startGoldLvl || 0) * 50); room.players.push({ id: socket.id, side: side, gold: startGold, profile: profile, inventory: [] }); socket.emit('assign_side', side); if (room.players.length === 2) io.to(roomCode).emit('game_start'); });
    socket.on('request_gacha', () => { let myRoomCode = null; let me = null; for (let code in rooms) { me = rooms[code].players.find(p => p.id === socket.id); if (me) { myRoomCode = code; break; } } if (myRoomCode && me && !rooms[myRoomCode].isGameOver) { if (me.gold >= 100) { let room = rooms[myRoomCode]; let pos = getValidSpawnPos(room, me.side); if (!pos) return socket.emit('gacha_result', { success: false, msg: "자리가 없습니다!" }); me.gold -= 100; let randomUnitId = baseUnits[Math.floor(Math.random() * baseUnits.length)]; let spawnX = pos.col * 80 + 40; let spawnY = 270 + pos.row * 80 + 40; let newUnit = { id: Math.random().toString(36).substr(2, 9), gridX: pos.col, gridY: pos.row, x: spawnX, y: spawnY, side: me.side, type: randomUnitId, items: [], attackAnimTimer: 0 }; room.units.push(newUnit); socket.emit('gacha_result', { success: true, unit: newUnit }); } else socket.emit('gacha_result', { success: false, msg: "골드가 부족합니다!" }); } });
    socket.on('move_unit', (data) => { let myRoomCode = null; let me = null; for (let code in rooms) { me = rooms[code].players.find(p => p.id === socket.id); if (me) { myRoomCode = code; break; } } if (myRoomCode && me) { let room = rooms[myRoomCode]; let unit = room.units.find(u => u.id === data.id); if (unit && unit.side === me.side) { let targetUnit = room.units.find(u => u !== unit && u.gridX === data.gridX && u.gridY === data.gridY); if (targetUnit && targetUnit.side === me.side) { targetUnit.gridX = unit.gridX; targetUnit.gridY = unit.gridY; targetUnit.x = targetUnit.gridX * 80 + 40; targetUnit.y = 270 + targetUnit.gridY * 80 + 40; } unit.gridX = data.gridX; unit.gridY = data.gridY; unit.x = unit.gridX * 80 + 40; unit.y = 270 + unit.gridY * 80 + 40; } } });
    socket.on('upgrade_unit', (data) => { let myRoomCode = null; let me = null; for (let code in rooms) { me = rooms[code].players.find(p => p.id === socket.id); if (me) { myRoomCode = code; break; } } if (myRoomCode && me) { let unit = rooms[myRoomCode].units.find(u => u.id === data.id); if (unit && unit.side === me.side) { let currentStats = UNIT_DB[unit.type]; let isValidNext = (Array.isArray(currentStats.next) && currentStats.next.includes(data.next)) || (currentStats.next === data.next); if (isValidNext && me.gold >= currentStats.upgradeCost) { me.gold -= currentStats.upgradeCost; unit.type = data.next; unit.timer = UNIT_DB[data.next].cooldown; } } } });
    socket.on('sell_unit', (data) => { let myRoomCode = null; let me = null; for (let code in rooms) { me = rooms[code].players.find(p => p.id === socket.id); if (me) { myRoomCode = code; break; } } if (myRoomCode && me) { let room = rooms[myRoomCode]; let idx = room.units.findIndex(u => u.id === data.id); if (idx !== -1 && room.units[idx].side === me.side) { me.gold += UNIT_DB[room.units[idx].type].sellPrice; room.units.splice(idx, 1); } } });
    socket.on('equip_item', (data) => { let myRoomCode = null; let me = null; for (let code in rooms) { me = rooms[code].players.find(p => p.id === socket.id); if (me) { myRoomCode = code; break; } } if (myRoomCode && me) { let unit = rooms[myRoomCode].units.find(u => u.id === data.unitId && u.side === me.side); if (unit && me.inventory[data.itemIndex]) { if (!unit.items) unit.items = []; if (unit.items.length < 3) { unit.items.push(me.inventory[data.itemIndex]); me.inventory.splice(data.itemIndex, 1); } } } });
    socket.on('disconnect', () => { for (let roomCode in rooms) { let room = rooms[roomCode]; let index = room.players.findIndex(p => p.id === socket.id); if (index !== -1) { room.players.splice(index, 1); if (room.players.length === 0) delete rooms[roomCode]; break; } } });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`멀티플레이 서버 구동 완료! 포트: ${PORT}`));