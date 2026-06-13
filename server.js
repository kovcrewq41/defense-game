const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const { UNIT_DB } = require('./data.js'); 

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
app.get('/multi', (req, res) => res.sendFile(__dirname + '/multi.html'));

let rooms = {}; 
const baseUnits = ["SWORD_1", "ARCHER_1", "MAGE_1", "SHIELD_1", "ASSASSIN_1", "CANNON_1", "PRIEST_1"];

const ITEM_DB = {
    "SWORD": { type: "dmg", value: 1.3 },
    "BOW": { type: "spd", value: 0.7 },
    "STAFF": { type: "rng", value: 40 }
};

setInterval(() => {
    for (let roomCode in rooms) {
        let room = rooms[roomCode];
        if (room.players.length === 2 && !room.isGameOver) {
            room.frameCount++;
            
            let synergies = { left: {SWORD:0, ARCHER:0, MAGE:0, SHIELD:0, ASSASSIN:0, CANNON:0, PRIEST:0}, right: {SWORD:0, ARCHER:0, MAGE:0, SHIELD:0, ASSASSIN:0, CANNON:0, PRIEST:0} };
            let uniqueUnits = { left: new Set(), right: new Set() };
            room.units.forEach(u => uniqueUnits[u.side].add(u.type));
            uniqueUnits.left.forEach(type => { if(UNIT_DB[type]) synergies.left[UNIT_DB[type].trait]++; });
            uniqueUnits.right.forEach(type => { if(UNIT_DB[type]) synergies.right[UNIT_DB[type].trait]++; });

            room.units.forEach(u => {
                if (!u.timer) u.timer = 0;
                if (u.timer > 0) u.timer--;
                
                if (u.timer <= 0) {
                    const stats = UNIT_DB[u.type]; 
                    if (!stats) return;

                    let owner = room.players.find(p => p.side === u.side);
                    let syn = synergies[u.side][stats.trait];
                    
                    let buffedDamage = stats.damage;
                    let buffedCooldown = stats.cooldown;
                    let buffedRange = stats.range;
                    let buffedEffect = stats.effect;

                    if (stats.trait === "SWORD" && syn >= 3) buffedCooldown = Math.floor(stats.cooldown * 0.4);
                    if (stats.trait === "ARCHER" && syn >= 3) { buffedDamage = Math.floor(stats.damage * 1.5); buffedRange += 80; }
                    if (stats.trait === "MAGE" && syn >= 3) buffedEffect = "deep_slow";
                    if (stats.trait === "SHIELD" && syn >= 3) buffedEffect = "deep_stun";
                    if (stats.trait === "CANNON" && syn >= 3) { buffedEffect = "deep_splash"; buffedDamage = Math.floor(stats.damage * 1.5); }
                    if (stats.trait === "ASSASSIN") { let critChance = syn >= 3 ? 0.5 : 0.2; let critMult = syn >= 3 ? 3 : 2; if (Math.random() < critChance) { buffedDamage *= critMult; buffedEffect = "crit"; } }

                    if (u.items) {
                        u.items.forEach(itemId => {
                            if (ITEM_DB[itemId].type === "dmg") buffedDamage = Math.floor(buffedDamage * ITEM_DB[itemId].value);
                            if (ITEM_DB[itemId].type === "spd") buffedCooldown = Math.floor(buffedCooldown * ITEM_DB[itemId].value);
                            if (ITEM_DB[itemId].type === "rng") buffedRange += ITEM_DB[itemId].value;
                        });
                    }

                    if (owner && owner.profile) {
                        let pro = owner.profile;
                        let masteryLvl = pro.mastery[stats.trait] || 0;
                        let attackBoostLvl = pro.passives?.attackBoostLvl || 0;
                        let r1 = pro.relics["R1"] || 0; let r2 = pro.relics["R2"] || 0; let r5 = pro.relics["R5"] || 0;
                        let relicMult = 1 + (r1 * 0.1); if (r5 > 0) relicMult *= Math.pow(2, r5);
                        buffedDamage = Math.floor(buffedDamage * (1 + attackBoostLvl * 0.05) * (1 + masteryLvl * 0.1) * relicMult);
                        buffedCooldown = Math.floor(buffedCooldown * Math.pow(0.9, r2));
                    }

                    if (u.type.startsWith("PRIEST")) {
                        room.projectiles.push({ id: Math.random().toString(36).substr(2, 9), x: u.x, y: u.y, targetId: "NEXUS", damage: buffedDamage, speed: 15, side: u.side, isHeal: true });
                        u.timer = buffedCooldown; return;
                    }

                    let target = null; let minDist = buffedRange;
                    room.monsters.forEach(m => {
                        let dist = Math.hypot(m.x - u.x, m.y - u.y);
                        if (dist <= minDist) { minDist = dist; target = m; }
                    });

                    if (target) {
                        room.projectiles.push({ id: Math.random().toString(36).substr(2, 9), x: u.x, y: u.y, targetId: target.id, damage: buffedDamage, effect: buffedEffect, speed: 10, side: u.side, isHeal: false });
                        u.timer = buffedCooldown;
                    }
                }
            });

            for (let i = room.projectiles.length - 1; i >= 0; i--) {
                let p = room.projectiles[i];
                if (p.isHeal) {
                    p.y += p.speed;
                    if (p.y >= 920) { room.nexusHp += p.damage; if (room.nexusHp > 100) room.nexusHp = 100; room.projectiles.splice(i, 1); }
                    continue;
                }

                let target = room.monsters.find(m => m.id === p.targetId);
                if (!target) { room.projectiles.splice(i, 1); continue; }

                let dx = target.x - p.x; let dy = target.y - p.y;
                let dist = Math.sqrt(dx * dx + dy * dy);

                if (dist <= p.speed) {
                    if (p.effect === "slow") target.speed = Math.max(0.3, target.speed - 0.1);
                    else if (p.effect === "deep_slow") target.speed = Math.max(0.1, target.speed - 0.3);
                    else if (p.effect === "stun") target.stunTimer = 60;
                    else if (p.effect === "deep_stun") target.stunTimer = 120;

                    if (p.effect === "splash" || p.effect === "deep_splash") {
                        let radius = (p.effect === "deep_splash") ? 100 : 50;
                        room.monsters.forEach(m => {
                            if (Math.hypot(m.x - target.x, m.y - target.y) < radius) m.hp -= p.damage;
                        });
                    } else {
                        target.hp -= p.damage; 
                    }
                    
                    room.projectiles.splice(i, 1);

                    if (target.hp <= 0 && !target.isDead) {
                        target.isDead = true; room.stats.kills++; 
                        let owner = room.players.find(player => player.side === p.side);
                        let bonusGold = (owner && owner.profile && owner.profile.relics["R3"]) ? owner.profile.relics["R3"] * 5 : 0;
                        let earnedGold = (target.isBoss ? 150 : 15) + bonusGold;

                        room.stats.goldEarned += earnedGold;
                        if (owner) {
                            owner.gold += earnedGold;
                            if (target.isBoss && owner.inventory.length < 5) {
                                const itemKeys = Object.keys(ITEM_DB);
                                owner.inventory.push(itemKeys[Math.floor(Math.random() * itemKeys.length)]);
                            }
                        }
                    }
                } else {
                    p.x += (dx / dist) * p.speed; p.y += (dy / dist) * p.speed;
                }
            }

            room.monsters = room.monsters.filter(m => !m.isDead);

            for (let i = room.monsters.length - 1; i >= 0; i--) {
                let m = room.monsters[i];
                if (m.stunTimer > 0) {
                    m.stunTimer--; 
                } else {
                    m.y += m.speed; 
                    if (m.y >= 920) { room.nexusHp -= (m.isBoss ? 20 : 5); room.monsters.splice(i, 1); }
                }
            }

            if (room.nexusHp <= 0 && !room.isGameOver) {
                room.nexusHp = 0; room.isGameOver = true;
                io.to(roomCode).emit('game_over', room.stats);
            }

            if (!room.isGameOver) {
                if (room.frameCount % 600 === 0) { 
                    let maxHp = 500 + (room.frameCount / 2);
                    room.monsters.push({ id: Math.random().toString(36).substr(2, 9), x: 100 + Math.random() * 520, y: -30, speed: 0.4, hp: maxHp, maxHp: maxHp, isBoss: true, stunTimer: 0 });
                } else if (room.frameCount % 60 === 0) { 
                    let maxHp = 50 + (room.frameCount / 50); 
                    room.monsters.push({ id: Math.random().toString(36).substr(2, 9), x: 100 + Math.random() * 520, y: -30, speed: 0.8, hp: maxHp, maxHp: maxHp, isBoss: false, stunTimer: 0 });
                }
            }

            io.to(roomCode).emit('game_state', { monsters: room.monsters, units: room.units, projectiles: room.projectiles, nexusHp: room.nexusHp, players: room.players });
        }
    }
}, 1000 / 60);

io.on('connection', (socket) => {
    socket.on('join_room', (data) => {
        let roomCode = data.roomCode; let profile = data.profile; 
        if (!rooms[roomCode]) rooms[roomCode] = { players: [], monsters: [], units: [], projectiles: [], frameCount: 0, nexusHp: 100, isGameOver: false, stats: { kills: 0, wave: 1, goldEarned: 0 } };
        let room = rooms[roomCode];

        // ★ [핵심 해결 로직] 완벽한 중복 입장 차단! (이 유저의 소켓 ID가 이미 방에 있다면 무시)
        if (room.players.some(p => p.id === socket.id)) return;

        if (room.players.length >= 2) return socket.emit('error_msg', "방이 꽉 찼습니다!");

        socket.join(roomCode); 
        let side = room.players.length === 0 ? "left" : "right";
        let startGold = 500 + ((profile.passives?.startGoldLvl || 0) * 50);
        room.players.push({ id: socket.id, side: side, gold: startGold, profile: profile, inventory: [] });
        
        socket.emit('assign_side', side);
        if (room.players.length === 2) io.to(roomCode).emit('game_start');
    });

    socket.on('request_gacha', () => {
        let myRoomCode = null; let me = null;
        for (let code in rooms) { me = rooms[code].players.find(p => p.id === socket.id); if (me) { myRoomCode = code; break; } }
        if (myRoomCode && me && !rooms[myRoomCode].isGameOver) {
            if (me.gold >= 100) {
                me.gold -= 100;
                let randomUnitId = baseUnits[Math.floor(Math.random() * baseUnits.length)];
                let spawnX = (me.side === "left") ? (50 + Math.random() * 260) : (410 + Math.random() * 260);
                let spawnY = 700 + Math.random() * 200; 
                let newUnit = { id: Math.random().toString(36).substr(2, 9), x: spawnX, y: spawnY, side: me.side, type: randomUnitId, items: [] };
                rooms[myRoomCode].units.push(newUnit);
                socket.emit('gacha_result', { success: true, unit: newUnit });
            } else socket.emit('gacha_result', { success: false, msg: "골드가 부족합니다!" });
        }
    });

    socket.on('move_unit', (data) => {
        let myRoomCode = null; let me = null;
        for (let code in rooms) { me = rooms[code].players.find(p => p.id === socket.id); if (me) { myRoomCode = code; break; } }
        if (myRoomCode && me) {
            let unit = rooms[myRoomCode].units.find(u => u.id === data.id);
            if (unit && unit.side === me.side) { unit.x = data.x; unit.y = data.y; }
        }
    });

    socket.on('upgrade_unit', (data) => {
        let myRoomCode = null; let me = null;
        for (let code in rooms) { me = rooms[code].players.find(p => p.id === socket.id); if (me) { myRoomCode = code; break; } }
        if (myRoomCode && me) {
            let unit = rooms[myRoomCode].units.find(u => u.id === data.id);
            if (unit && unit.side === me.side) {
                let currentStats = UNIT_DB[unit.type];
                let isValidNext = (Array.isArray(currentStats.next) && currentStats.next.includes(data.next)) || (currentStats.next === data.next);
                if (isValidNext && me.gold >= currentStats.upgradeCost) {
                    me.gold -= currentStats.upgradeCost;
                    unit.type = data.next; unit.timer = UNIT_DB[data.next].cooldown; 
                }
            }
        }
    });

    socket.on('sell_unit', (data) => {
        let myRoomCode = null; let me = null;
        for (let code in rooms) { me = rooms[code].players.find(p => p.id === socket.id); if (me) { myRoomCode = code; break; } }
        if (myRoomCode && me) {
            let room = rooms[myRoomCode];
            let idx = room.units.findIndex(u => u.id === data.id);
            if (idx !== -1 && room.units[idx].side === me.side) {
                me.gold += UNIT_DB[room.units[idx].type].sellPrice; 
                room.units.splice(idx, 1); 
            }
        }
    });

    socket.on('equip_item', (data) => {
        let myRoomCode = null; let me = null;
        for (let code in rooms) { me = rooms[code].players.find(p => p.id === socket.id); if (me) { myRoomCode = code; break; } }
        if (myRoomCode && me) {
            let unit = rooms[myRoomCode].units.find(u => u.id === data.unitId && u.side === me.side);
            if (unit && me.inventory[data.itemIndex]) {
                if (!unit.items) unit.items = [];
                if (unit.items.length < 3) { 
                    unit.items.push(me.inventory[data.itemIndex]);
                    me.inventory.splice(data.itemIndex, 1); 
                }
            }
        }
    });

    socket.on('disconnect', () => {
        for (let roomCode in rooms) {
            let room = rooms[roomCode]; let index = room.players.findIndex(p => p.id === socket.id);
            if (index !== -1) { room.players.splice(index, 1); if (room.players.length === 0) delete rooms[roomCode]; break; }
        }
    });
});

http.listen(3000, () => console.log('서버 구동 완료!'));