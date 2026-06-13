const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ★ [해상도 깨짐 보정 로직] 기기의 픽셀 비율을 감지해 강제로 고화질 HD로 뻥튀기합니다!
const logicalWidth = 720; 
const logicalHeight = 1280;
const dpr = window.devicePixelRatio || 1;

canvas.width = logicalWidth * dpr;
canvas.height = logicalHeight * dpr;
canvas.style.width = `${logicalWidth}px`;
canvas.style.height = `${logicalHeight}px`;

ctx.scale(dpr, dpr); // 텍스트 및 이미지 선명화 스케일 연동

const centerX = logicalWidth / 2;
const centerY = 550;

let screenShake = 0;
let currentScene = 'MAIN_MENU';
let units = [];
let selectedUnit = null;
let draggingUnit = null;
let monsters = [];
let projectiles = [];
let baseHp = 100; // 넥서스 기본 체력 최대치 100 고정
let frameCount = 0;
let goldParticles = [];
let inventory = [];
let draggingItem = null;
let activeSynergies = { SWORD: 0, ARCHER: 0, MAGE: 0, SHIELD: 0, ASSASSIN: 0, CANNON: 0, PRIEST: 0 };
let sessionStats = { kills: 0, maxWave: 0, goldEarned: 0 };
let bgImage = new Image();
bgImage.onload = function() { console.log("배경 이미지 로드 완료!"); }; 
bgImage.src = 'bg_1.png';

let gachaState = "IDLE";
let gachaTimer = 0;
let currentPull = null;
let gachaParticles = [];

let countdownTimer = 0; 
let isSynergyOpen = true;

const STAGE_DB = {
    1: { name: "1. 평화로운 초원", maxWave: 20, bgColor: "#051e05", hpMultiplier: 1.0 },
    2: { name: "2. 고블린 둥지", maxWave: 20, bgColor: "#0a1e05", hpMultiplier: 3.0 },
    3: { name: "3. 붉은 화산", maxWave: 20, bgColor: "#2e0f05", hpMultiplier: 8.0 },
    4: { name: "4. 메마른 사막", maxWave: 20, bgColor: "#3e2723", hpMultiplier: 15.0 },
    5: { name: "5. 버려진 묘지", maxWave: 20, bgColor: "#263238", hpMultiplier: 30.0 },
    6: { name: "6. 얼어붙은 설원", maxWave: 20, bgColor: "#001f3f", hpMultiplier: 50.0 },
    7: { name: "7. 타락한 신전", maxWave: 20, bgColor: "#311b92", hpMultiplier: 80.0 },
    8: { name: "8. 악몽의 심연", maxWave: 20, bgColor: "#1a0000", hpMultiplier: 120.0 },
    9: { name: "9. 종말의 제단", maxWave: 20, bgColor: "#000000", hpMultiplier: 200.0 },
    10: { name: "10. 지옥의 문", maxWave: 20, bgColor: "#110000", hpMultiplier: 400.0 }
};
let selectedStage = 1; let currentWave = 1;

const GRID_ROWS = 7;
const GRID_COLS = 7;
const TILE_SIZE = 80; 
const START_X = centerX - (GRID_COLS * TILE_SIZE) / 2;
const START_Y = centerY - (GRID_ROWS * TILE_SIZE) / 2;

const IMAGE_CACHE = {};
function getSprite(src) {
    if (!src) return null;
    if (!IMAGE_CACHE[src]) { const img = new Image(); img.src = src; IMAGE_CACHE[src] = img; }
    return IMAGE_CACHE[src];
}

const ITEM_DB = {
    "SWORD": { name: "B.F대검", color: "#ff5252", symbol: "⚔️", type: "dmg", value: 1.2 }, // 밸런스 조정 (1.3 -> 1.2)
    "BOW": { name: "곡궁", color: "#69f0ae", symbol: "🏹", type: "spd", value: 0.85 }, // 밸런스 조정 (0.7 -> 0.85)
    "STAFF": { name: "지팡이", color: "#40c4ff", symbol: "🪄", type: "rng", value: 30 }   // 사거리 보정 (40 -> 30)
};

function saveGame() {
    const saveData = { soulStones: PlayerProfile.soulStones, unlockedStage: PlayerProfile.unlockedStage, passives: PlayerProfile.passives, mastery: PlayerProfile.mastery, relics: PlayerProfile.relics };
    localStorage.setItem('defenseSaveData', JSON.stringify(saveData));
}
function loadGame() {
    const saved = localStorage.getItem('defenseSaveData');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed.soulStones !== undefined) PlayerProfile.soulStones = parsed.soulStones;
            if (parsed.unlockedStage !== undefined) PlayerProfile.unlockedStage = parsed.unlockedStage;
            if (parsed.passives) PlayerProfile.passives = parsed.passives;
            if (parsed.mastery) Object.assign(PlayerProfile.mastery, parsed.mastery);
            if (parsed.relics) PlayerProfile.relics = parsed.relics;
        } catch (e) { }
    }
}
loadGame();

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const Sound = {
    play: (freq, type, duration, vol, freqSlide = 0) => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.type = type; osc.connect(gain); gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        if (freqSlide !== 0) osc.frequency.exponentialRampToValueAtTime(freqSlide, audioCtx.currentTime + duration);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.start(); osc.stop(audioCtx.currentTime + duration);
    },
    shoot: () => {}, // ★ 기본 슛 사운드 삭제 (귀 피로감 전면 해결)
    hit: () => Sound.play(150, 'sawtooth', 0.1, 0.01, 50), // 타격음 볼륨 최소화 (0.03 -> 0.01)
    heal: () => Sound.play(800, 'sine', 0.2, 0.02, 1200),
    crit: () => Sound.play(300, 'sawtooth', 0.15, 0.02, 100), // 크리 볼륨 최소화 (0.05 -> 0.02)
    coin: () => { Sound.play(1200, 'sine', 0.1, 0.02); setTimeout(() => Sound.play(1600, 'sine', 0.15, 0.02), 50); },
    boss: () => Sound.play(100, 'square', 1.0, 0.05, 50),
    clear: () => { Sound.play(400, 'sine', 0.2, 0.05); setTimeout(() => Sound.play(600, 'sine', 0.4, 0.05), 200); },
    click: () => Sound.play(800, 'sine', 0.05, 0.03),
    drumroll: () => { let i = 0; let interval = setInterval(() => { Sound.play(100 + Math.random() * 50, 'square', 0.05, 0.05); i++; if (i > 15) clearInterval(interval); }, 100); },
    epic: () => { Sound.play(400, 'sine', 0.1, 0.05); setTimeout(() => Sound.play(600, 'sine', 0.1, 0.05), 150); setTimeout(() => Sound.play(800, 'sine', 0.4, 0.05), 300); },
    legendary: () => { Sound.play(400, 'square', 0.1, 0.05); setTimeout(() => Sound.play(500, 'square', 0.1, 0.05), 100); setTimeout(() => Sound.play(600, 'square', 0.1, 0.05), 200); setTimeout(() => Sound.play(800, 'square', 0.4, 0.05), 300); setTimeout(() => Sound.play(1200, 'sawtooth', 0.8, 0.05, 800), 500); }
};

class UIButton {
    constructor(x, y, width, height, text, color, onClick) { this.x = x; this.y = y; this.width = width; this.height = height; this.text = text; this.color = color; this.onClick = onClick; }
    draw() { ctx.fillStyle = this.color; ctx.beginPath(); ctx.roundRect(this.x, this.y, this.width, this.height, 15); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = "#ffffff"; ctx.font = "bold 20px Malgun Gothic"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(this.text, this.x + this.width / 2, this.y + this.height / 2); }
    isClicked(mx, my) { return mx >= this.x && mx <= this.x + this.width && my >= this.y && my <= this.y + this.height; }
}

class GachaParticle {
    constructor(x, y, color) { this.x = x; this.y = y; this.color = color; const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 15 + 5; this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed; this.life = 60 + Math.random() * 40; this.maxLife = this.life; }
    update() { this.x += this.vx; this.y += this.vy; this.vy += 0.5; this.life--; return this.life > 0; }
    draw() { ctx.globalAlpha = this.life / this.maxLife; ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1.0; }
}

class GoldParticle {
    constructor(x, y, amount, isBoss) { this.x = x; this.y = y - 20; this.amount = amount; this.isBoss = isBoss; this.alpha = 1.0; this.velocity = -1.5; this.life = 45; }
    update() { this.y += this.velocity; this.life--; this.alpha = Math.max(0, this.life / 45); return this.life > 0; }
    draw() { ctx.save(); ctx.globalAlpha = this.alpha; ctx.shadowColor = "black"; ctx.shadowBlur = 4; ctx.lineWidth = 3; ctx.fillStyle = this.isBoss ? "#ffb300" : "#ffdd57"; ctx.font = this.isBoss ? "bold 26px Malgun Gothic" : "bold 18px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText(`+${this.amount}G`, this.x, this.y); ctx.restore(); }
}

class Projectile {
    constructor(x, y, target, damage, effect) { this.x = x; this.y = y; this.target = target; this.baseDamage = damage; this.effect = effect; this.speed = 10; this.radius = (effect === "crit") ? 8 : 5; this.active = true; }
    update() {
        if (!this.target || (!this.target.isBase && this.target.hp <= 0)) { this.active = false; return; }
        const dx = this.target.x - this.x; const dy = this.target.y - this.y; const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 15) {
            if (this.target.isBase) { 
                baseHp += this.baseDamage; 
                if (baseHp > 100) baseHp = 100; // ★ 힐러 무제한 무한 넥서스 힐 버그 픽스
                Sound.heal(); 
                this.active = false; 
                return; 
            }
            let finalDamage = this.baseDamage;
            if ((this.effect === "slow" || this.effect === "deep_slow") && this.target.type === "FIRE") finalDamage = Math.floor(finalDamage * 1.5);
            if (this.effect === "splash" || this.effect === "deep_splash") { let splashRadius = (this.effect === "deep_splash") ? 100 : 50; for (let m of monsters) { if (Math.hypot(m.x - this.x, m.y - this.y) < splashRadius) m.hp -= finalDamage; } } else { this.target.hp -= finalDamage; }
            if (this.effect === "slow") this.target.speed = Math.max(0.3, this.target.speed - 0.1); else if (this.effect === "deep_slow") this.target.speed = Math.max(0.1, this.target.speed - 0.3); else if (this.effect === "stun") this.target.stunTimer = 60; else if (this.effect === "deep_stun") this.target.stunTimer = 120;
            this.active = false; 
            
            // ★ 잔렉 유발 크리티컬 쉐이크 기능 비활성화로 멀미감 차단
            if (this.effect === "crit") { Sound.crit(); } else { Sound.hit(); }
        } else { this.x += (dx / distance) * this.speed; this.y += (dy / distance) * this.speed; }
    }
    draw() { ctx.fillStyle = (this.effect === "slow" || this.effect === "deep_slow") ? "#00e5ff" : (this.effect === "stun" || this.effect === "deep_stun") ? "#cfd8dc" : (this.effect === "heal") ? "#69f0ae" : (this.effect === "crit") ? "#ff1744" : (this.effect === "splash" || this.effect === "deep_splash") ? "#ff9800" : "#ffff00"; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill(); }
}

class Unit {
    constructor(id, col, row) { this.gridX = col; this.gridY = row; this.radius = 35; this.timer = 0; this.origGridX = col; this.origGridY = row; this.x = START_X + this.gridX * TILE_SIZE + TILE_SIZE / 2; this.y = START_Y + this.gridY * TILE_SIZE + TILE_SIZE / 2; this.attackAnimTimer = 0; this.items = []; this.loadData(id); }
    loadData(id) { 
        this.id = id; 
        const data = UNIT_DB[id]; 
        this.name = data.name; 
        this.color = data.color; 
        // ★ 전직 시 시너지 정보 증발 오류 해결 방어 로직 추가
        this.trait = data.trait || this.id.split('_')[0]; 
        this.upgradeCost = data.upgradeCost; 
        this.sellPrice = data.sellPrice; 
        this.next = data.next; 
        this.damage = data.damage; 
        this.range = data.range; 
        this.cooldown = data.cooldown; 
        this.effect = data.effect || null; 
        this.imgSrc = data.imgSrc || null; 
    }
    updatePosition() { if (draggingUnit !== this) { this.x = START_X + this.gridX * TILE_SIZE + TILE_SIZE / 2; this.y = START_Y + this.gridY * TILE_SIZE + TILE_SIZE / 2; } }
    update() {
        if (this.attackAnimTimer > 0) this.attackAnimTimer--; this.timer--;
        if (this.timer <= 0) {
            let buffedCooldown = this.cooldown; let buffedDamage = this.damage; let buffedRange = this.range; let buffedEffect = this.effect;
            if (this.trait === "SWORD" && activeSynergies.SWORD >= 3) buffedCooldown = Math.floor(this.cooldown * 0.4);
            if (this.trait === "ARCHER" && activeSynergies.ARCHER >= 3) { buffedDamage = Math.floor(this.damage * 1.5); buffedRange = this.range + 80; }
            if (this.trait === "MAGE" && activeSynergies.MAGE >= 3) buffedEffect = "deep_slow";
            if (this.trait === "SHIELD" && activeSynergies.SHIELD >= 3) buffedEffect = "deep_stun";
            if (this.trait === "CANNON" && activeSynergies.CANNON >= 3) { buffedEffect = "deep_splash"; buffedDamage = Math.floor(this.damage * 1.5); }
            if (this.trait === "ASSASSIN") { let critChance = activeSynergies.ASSASSIN >= 3 ? 0.5 : 0.2; let critMult = activeSynergies.ASSASSIN >= 3 ? 3 : 2; if (Math.random() < critChance) { buffedDamage *= critMult; buffedEffect = "crit"; } }
            for (let itemId of this.items) { let itemDef = ITEM_DB[itemId]; if (itemDef.type === "dmg") buffedDamage = Math.floor(buffedDamage * itemDef.value); if (itemDef.type === "spd") buffedCooldown = Math.floor(buffedCooldown * itemDef.value); if (itemDef.type === "rng") buffedRange += itemDef.value; }
            const r1Lvl = PlayerProfile.relics["R1"] || 0; const r2Lvl = PlayerProfile.relics["R2"] || 0; const r5Lvl = PlayerProfile.relics["R5"] || 0;
            let relicDmgMult = 1 + (r1Lvl * 0.1); if (r5Lvl > 0) relicDmgMult *= Math.pow(2, r5Lvl);
            
            buffedCooldown = Math.floor(buffedCooldown * Math.pow(0.9, r2Lvl));
            // ★ 무제한 연사로 인한 브라우저 과부하 방지 안전장치 (최하 10프레임 한계 고정)
            if (buffedCooldown < 10) buffedCooldown = 10;

            const passiveMultiplier = 1 + (PlayerProfile.passives.attackBoostLvl * 0.05); const classMasteryLvl = PlayerProfile.mastery[this.trait] || 0; const masteryMultiplier = 1 + (classMasteryLvl * 0.1);
            const finalDamage = Math.floor(buffedDamage * passiveMultiplier * masteryMultiplier * relicDmgMult);
            if (this.trait === "PRIEST") { let healAmount = Math.floor(finalDamage * 0.5); if (activeSynergies.PRIEST >= 3) healAmount *= 1.2; projectiles.push(new Projectile(this.x, this.y, { x: centerX, y: centerY, isBase: true }, healAmount, "heal")); this.timer = buffedCooldown; this.attackAnimTimer = 20; return; }
            let target = null; let minDist = buffedRange;
            for (let m of monsters) { let dist = Math.hypot(m.x - this.x, m.y - this.y); if (dist <= minDist) { target = m; minDist = dist; } }
            if (target) { projectiles.push(new Projectile(this.x, this.y, target, finalDamage, buffedEffect)); this.timer = buffedCooldown; this.attackAnimTimer = 20; }
        }
    }
    draw() {
        const img = getSprite(this.imgSrc);
        if (img && img.complete && img.naturalWidth > 0) { 
            const frameW = img.naturalWidth / 2; const frameH = img.naturalHeight / 2; const drawSize = 80; 
            let frameCol = 0; let frameRow = 0; 
            
            // ★ 조잡한 무한 대기 액션 전면 제거, 공격 쿨다운 시에만 모션 작동하도록 고정
            if (this.attackAnimTimer > 10) { frameCol = 0; frameRow = 1; } 
            else if (this.attackAnimTimer > 0) { frameCol = 1; frameRow = 1; } 
            else { frameCol = 0; frameRow = 0; } 
            
            ctx.drawImage(img, frameCol * frameW, frameRow * frameH, frameW, frameH, this.x - drawSize / 2, this.y - drawSize / 2, drawSize, drawSize); 
        }
        else { ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.stroke(); }
        ctx.fillStyle = "#fff"; ctx.font = "bold 14px Malgun Gothic"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(this.name, this.x, this.y + 45);
        if (this.items && this.items.length > 0) { let startX = this.x - (this.items.length * 14) / 2 + 7; for (let i = 0; i < this.items.length; i++) { let itemDef = ITEM_DB[this.items[i]]; ctx.fillStyle = itemDef.color; ctx.fillRect(startX + i * 14 - 5, this.y + 50, 10, 10); } }
        
        if (selectedUnit === this) { 
            let drawRange = this.range; if (this.trait === "ARCHER" && activeSynergies.ARCHER >= 3) drawRange += 80; 
            for (let itemId of this.items) { if (ITEM_DB[itemId].type === "rng") drawRange += ITEM_DB[itemId].value; } 
            ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"; ctx.beginPath(); ctx.arc(this.x, this.y, drawRange, 0, Math.PI * 2); ctx.stroke(); 
        }
    }
    isHit(mx, my) { return ((this.x - mx) ** 2 + (this.y - my) ** 2) <= (this.radius ** 2); }
}

class Monster {
    constructor(isBoss = false, isFinalBoss = false) {
        this.isBoss = isBoss; this.isFinalBoss = isFinalBoss;
        const angle = Math.random() * Math.PI * 2; const spawnRadius = 480;
        this.x = centerX + Math.cos(angle) * spawnRadius; this.y = centerY + Math.sin(angle) * spawnRadius;
        
        let baseMaxHp = isBoss ? 500 + (frameCount / 2) : 50 + (frameCount / 100); if (isFinalBoss) baseMaxHp *= 2;
        this.speed = isBoss ? 0.3 : 0.8; this.radius = isBoss ? 30 : 15; this.mutantType = "NORMAL";
        if (!isBoss) { const rand = Math.random(); if (rand < 0.2) { this.mutantType = "FAST"; this.speed = 1.4; baseMaxHp *= 0.5; this.radius = 10; } else if (rand < 0.4) { this.mutantType = "TANK"; this.speed = 0.4; baseMaxHp *= 2.5; this.radius = 20; } }
        
        const stageMulti = STAGE_DB[selectedStage].hpMultiplier; 
        this.maxHp = baseMaxHp * stageMulti; 
        this.hp = this.maxHp; 
        this.stunTimer = 0; 
        this.type = (Math.random() < 0.3) ? "FIRE" : "NORMAL";
    }
    update() { if (this.stunTimer > 0) { this.stunTimer--; return false; } const dx = centerX - this.x; const dy = centerY - this.y; const dist = Math.sqrt(dx * dx + dy * dy); if (dist < 30) return true; this.x += (dx / dist) * this.speed; this.y += (dy / dist) * this.speed; return false; }
    draw() {
        if (this.stunTimer > 0) { ctx.fillStyle = "#9e9e9e"; } else if (this.type === "FIRE") { ctx.fillStyle = "#ff5722"; } else if (this.mutantType === "FAST") { ctx.fillStyle = "#00bcd4"; } else if (this.mutantType === "TANK") { ctx.fillStyle = "#795548"; } else { ctx.fillStyle = "#d32f2f"; }
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
        if (this.isBoss) { ctx.strokeStyle = this.isFinalBoss ? "#ff00ff" : "#ffd700"; ctx.lineWidth = 5; ctx.stroke(); ctx.fillStyle = "#fff"; ctx.font = "bold 14px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText(this.isFinalBoss ? "FINAL BOSS" : "BOSS", this.x, this.y - 35); }
        else { ctx.strokeStyle = "#b71c1c"; ctx.lineWidth = 2; ctx.stroke(); if (this.type === "FIRE") { ctx.fillStyle = "#ffcc80"; ctx.font = "12px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText("🔥불", this.x, this.y - 20); } }
        ctx.fillStyle = "black"; ctx.fillRect(this.x - 20, this.y - (this.isBoss ? 55 : 25), 40, 5); ctx.fillStyle = "#00e676"; ctx.fillRect(this.x - 20, this.y - (this.isBoss ? 55 : 25), 40 * (this.hp / this.maxHp), 5);
    }
}

function getValidSpawnPos() {
    let emptyTiles = [];
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (r === 3 && c === 3) continue;
            let isOccupied = units.some(u => u.gridX === c && u.gridY === r);
            if (!isOccupied) emptyTiles.push({ col: c, row: r });
        }
    }
    if (emptyTiles.length === 0) return null; return emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
}

// ★ 기획안 반영: 롤토체스식 중복 제거 시너지 카운트 규칙 유지
function calculateSynergies() {
    activeSynergies = { SWORD: 0, ARCHER: 0, MAGE: 0, SHIELD: 0, ASSASSIN: 0, CANNON: 0, PRIEST: 0 };
    const uniqueIds = [...new Set(units.map(u => u.id))]; 
    uniqueIds.forEach(id => { 
        const trait = UNIT_DB[id].trait || id.split('_')[0]; 
        if (trait) activeSynergies[trait]++; 
    });
}

const menuButtons = [
    new UIButton(centerX - 200, 480, 70, 70, "◀", "#37474f", () => { if (selectedStage > 1) { selectedStage--; updateStageText(); } }),
    new UIButton(centerX - 120, 480, 240, 70, "1. 평화로운 초원", "#111", () => { }),
    new UIButton(centerX + 130, 480, 70, 70, "▶", "#37474f", () => { if (selectedStage < PlayerProfile.unlockedStage && selectedStage < Object.keys(STAGE_DB).length) { selectedStage++; updateStageText(); } }),
    
    new UIButton(centerX - 175, 570, 350, 80, "전투 시작 (싱글)", "#2e7d32", () => {
        currentScene = 'GAME'; units = []; monsters = []; projectiles = []; goldParticles = []; inventory = []; draggingItem = null; baseHp = 100; frameCount = 0; currentWave = 1;
        countdownTimer = 300; // 전투 시작전 5초 배치 유예 시간 활성화
        PlayerProfile.gold = 500 + (PlayerProfile.passives.startGoldLvl * 50); calculateSynergies();
        const r4Lvl = PlayerProfile.relics["R4"] || 0;
        for (let i = 0; i < r4Lvl; i++) { const pos = getValidSpawnPos(); if (pos) { const arr = ["SWORD_3A", "ARCHER_3A", "MAGE_3A", "SHIELD_3A", "ASSASSIN_3A", "CANNON_3A", "PRIEST_3A"]; units.push(new Unit(arr[Math.floor(Math.random() * arr.length)], pos.col, pos.row)); } }
    }),
    new UIButton(centerX - 175, 670, 350, 80, "🤝 협동 모드 (멀티)", "#00695c", () => { window.location.href = '/multi'; }),
    new UIButton(centerX - 175, 770, 350, 80, "패시브 성장", "#1565c0", () => { currentScene = 'PASSIVE_TREE'; }),
    new UIButton(centerX - 175, 870, 350, 80, "영웅 도감", "#e65100", () => { currentScene = 'DEX'; updateDexButtonsText(); }),
    new UIButton(centerX - 175, 970, 350, 80, "🔮 유물 뽑기", "#6a1b9a", () => { currentScene = 'RELIQUARY'; }),
    new UIButton(centerX - 120, 1100, 240, 50, "데이터 초기화", "#8e0000", () => { if (confirm("초기화하시겠습니까?")) { localStorage.removeItem('defenseSaveData'); location.reload(); } })
];

function updateStageText() { menuButtons[1].text = STAGE_DB[selectedStage].name; }
updateStageText();

const gameOverButtons = [ new UIButton(centerX - 150, 750, 300, 80, "로비로 돌아가기", "#c62828", () => { currentScene = 'MAIN_MENU'; }) ];
const relicButtons = [
    new UIButton(centerX - 150, 950, 300, 80, "✨ 1회 뽑기 (100💎)", "#6a1b9a", () => {
        if (gachaState !== "IDLE") return;
        if (PlayerProfile.soulStones >= 100) {
            PlayerProfile.soulStones -= 100; const rand = Math.random() * 1000; let sum = 0;
            for (let key in RELIC_DB) { sum += RELIC_DB[key].weight; if (rand <= sum) { currentPull = key; break; } }
            PlayerProfile.relics[currentPull] = (PlayerProfile.relics[currentPull] || 0) + 1; saveGame(); gachaState = "SPINNING"; gachaTimer = 90; Sound.drumroll();
        } else { alert("영혼석이 부족합니다!"); }
    }),
    new UIButton(centerX - 150, 1080, 300, 80, "뒤로 가기", "#c62828", () => { if (gachaState === "IDLE") currentScene = 'MAIN_MENU'; })
];

const passiveButtons = [
    new UIButton(centerX - 200, 340, 400, 80, "", "#37474f", () => { let cost = 100 + PlayerProfile.passives.startGoldLvl * 50; if (PlayerProfile.soulStones >= cost) { PlayerProfile.soulStones -= cost; PlayerProfile.passives.startGoldLvl++; updatePassiveButtonsText(); saveGame(); } }),
    new UIButton(centerX - 200, 540, 400, 80, "", "#37474f", () => { let cost = 150 + PlayerProfile.passives.attackBoostLvl * 100; if (PlayerProfile.soulStones >= cost) { PlayerProfile.soulStones -= cost; PlayerProfile.passives.attackBoostLvl++; updatePassiveButtonsText(); saveGame(); } }),
    new UIButton(centerX - 150, 1100, 300, 80, "뒤로 가기", "#c62828", () => { currentScene = 'MAIN_MENU'; })
];
function updatePassiveButtonsText() { passiveButtons[0].text = `💰 골드 증가 Lv.${PlayerProfile.passives.startGoldLvl} (${100 + PlayerProfile.passives.startGoldLvl * 50}💎)`; passiveButtons[1].text = `⚔️ 공격력 강화 Lv.${PlayerProfile.passives.attackBoostLvl} (${150 + PlayerProfile.passives.attackBoostLvl * 100}💎)`; }

const dexButtons = [
    new UIButton(centerX - 330, 220, 280, 60, "", "#4e342e", () => { let c = 50 + PlayerProfile.mastery.SWORD * 50; if (PlayerProfile.soulStones >= c) { PlayerProfile.soulStones -= c; PlayerProfile.mastery.SWORD++; updateDexButtonsText(); saveGame(); } }),
    new UIButton(centerX - 330, 320, 280, 60, "", "#2e7d32", () => { let c = 50 + PlayerProfile.mastery.ARCHER * 50; if (PlayerProfile.soulStones >= c) { PlayerProfile.soulStones -= c; PlayerProfile.mastery.ARCHER++; updateDexButtonsText(); saveGame(); } }),
    new UIButton(centerX - 330, 420, 280, 60, "", "#1565c0", () => { let c = 50 + PlayerProfile.mastery.MAGE * 50; if (PlayerProfile.soulStones >= c) { PlayerProfile.soulStones -= c; PlayerProfile.mastery.MAGE++; updateDexButtonsText(); saveGame(); } }),
    new UIButton(centerX - 330, 520, 280, 60, "", "#37474f", () => { let c = 50 + PlayerProfile.mastery.SHIELD * 50; if (PlayerProfile.soulStones >= c) { PlayerProfile.soulStones -= c; PlayerProfile.mastery.SHIELD++; updateDexButtonsText(); saveGame(); } }),
    new UIButton(centerX + 30, 220, 280, 60, "", "#6a1b9a", () => { let c = 50 + PlayerProfile.mastery.ASSASSIN * 50; if (PlayerProfile.soulStones >= c) { PlayerProfile.soulStones -= c; PlayerProfile.mastery.ASSASSIN++; updateDexButtonsText(); saveGame(); } }),
    new UIButton(centerX + 30, 320, 280, 60, "", "#d84315", () => { let c = 50 + PlayerProfile.mastery.CANNON * 50; if (PlayerProfile.soulStones >= c) { PlayerProfile.soulStones -= c; PlayerProfile.mastery.CANNON++; updateDexButtonsText(); saveGame(); } }),
    new UIButton(centerX + 30, 420, 280, 60, "", "#f57f17", () => { let c = 50 + PlayerProfile.mastery.PRIEST * 50; if (PlayerProfile.soulStones >= c) { PlayerProfile.soulStones -= c; PlayerProfile.mastery.PRIEST++; updateDexButtonsText(); saveGame(); } }),
    new UIButton(centerX - 150, 1100, 300, 80, "뒤로 가기", "#c62828", () => { currentScene = 'MAIN_MENU'; })
];
function updateDexButtonsText() {
    dexButtons[0].text = `검사 Lv.${PlayerProfile.mastery.SWORD} (${50 + PlayerProfile.mastery.SWORD * 50}💎)`; dexButtons[1].text = `궁수 Lv.${PlayerProfile.mastery.ARCHER} (${50 + PlayerProfile.mastery.ARCHER * 50}💎)`;
    dexButtons[2].text = `법사 Lv.${PlayerProfile.mastery.MAGE} (${50 + PlayerProfile.mastery.MAGE * 50}💎)`; dexButtons[3].text = `방패 Lv.${PlayerProfile.mastery.SHIELD} (${50 + PlayerProfile.mastery.SHIELD * 50}💎)`;
    dexButtons[4].text = `도적 Lv.${PlayerProfile.mastery.ASSASSIN} (${50 + PlayerProfile.mastery.ASSASSIN * 50}💎)`; dexButtons[5].text = `포병 Lv.${PlayerProfile.mastery.CANNON} (${50 + PlayerProfile.mastery.CANNON * 50}💎)`;
    dexButtons[6].text = `사제 Lv.${PlayerProfile.mastery.PRIEST} (${50 + PlayerProfile.mastery.PRIEST * 50}💎)`;
}
updatePassiveButtonsText(); updateDexButtonsText();

const gameButtons = [
    new UIButton(40, 1090, 300, 90, "🎲 뽑기 (100G)", "#1565c0", () => {
        if (PlayerProfile.gold >= 100) {
            const tilePos = getValidSpawnPos(); if (tilePos === null) { alert("빈 칸이 없습니다!"); return; }
            PlayerProfile.gold -= 100;
            const baseUnits = ["SWORD_1", "ARCHER_1", "MAGE_1", "SHIELD_1", "ASSASSIN_1", "CANNON_1", "PRIEST_1"];
            const rareUnits = ["SWORD_2", "ARCHER_2", "MAGE_2", "SHIELD_2", "ASSASSIN_2", "CANNON_2", "PRIEST_2"];
            const classIndex = Math.floor(Math.random() * 7);
            const spawnUnitId = (Math.random() < 0.10) ? rareUnits[classIndex] : baseUnits[classIndex];
            units.push(new Unit(spawnUnitId, tilePos.col, tilePos.row));
        }
    }),
    new UIButton(380, 1090, 300, 90, "🏃 포기", "#c62828", () => { currentScene = 'MAIN_MENU'; })
];

function getPointerPos(event) { const rect = canvas.getBoundingClientRect(); const clientX = event.touches ? event.touches[0].clientX : event.clientX; const clientY = event.touches ? event.touches[0].clientY : event.clientY; return { x: (clientX - rect.left) * (logicalWidth / rect.width), y: (clientY - rect.top) * (logicalHeight / rect.height) }; }

function handleDown(event) {
    if (audioCtx && audioCtx.state === 'suspended') { audioCtx.resume(); }
    const pos = getPointerPos(event); let btnClicked = false; let buttonsToCheck = [];
    
    if (currentScene === 'GAME') {
        if (pos.x >= 10 && pos.x <= 90 && pos.y >= 100 && pos.y <= 130) { isSynergyOpen = !isSynergyOpen; return; }
        
        // ★ 하단 고정 UI 패널 터치 이벤트 가로 연동 (간섭 및 터치 겹침 100% 완전 해결)
        if (selectedUnit && draggingUnit === null) {
            if (pos.y >= 840 && pos.y <= 940) {
                if (pos.x >= 590 && pos.x <= 690) {
                    Sound.click(); PlayerProfile.gold += selectedUnit.sellPrice;
                    units = units.filter(u => u !== selectedUnit); selectedUnit = null; return;
                }
                if (Array.isArray(selectedUnit.next)) {
                    if (pos.x >= 450 && pos.x <= 580) { // 오른쪽 분기 전직
                        if (PlayerProfile.gold >= selectedUnit.upgradeCost) { Sound.click(); PlayerProfile.gold -= selectedUnit.upgradeCost; selectedUnit.loadData(selectedUnit.next[1]); selectedUnit = null; } return;
                    }
                    if (pos.x >= 310 && pos.x <= 440) { // 왼쪽 분기 전직
                        if (PlayerProfile.gold >= selectedUnit.upgradeCost) { Sound.click(); PlayerProfile.gold -= selectedUnit.upgradeCost; selectedUnit.loadData(selectedUnit.next[0]); selectedUnit = null; } return;
                    }
                } else if (selectedUnit.next) {
                    if (pos.x >= 450 && pos.x <= 580) { // 단일 전직 및 레어 업글
                        if (PlayerProfile.gold >= selectedUnit.upgradeCost) { Sound.click(); PlayerProfile.gold -= selectedUnit.upgradeCost; selectedUnit.loadData(selectedUnit.next); selectedUnit = null; } return;
                    }
                }
                if (pos.x >= 10 && pos.x <= 710) return; 
            }
        }
    }

    if (currentScene === 'MAIN_MENU') buttonsToCheck = menuButtons; else if (currentScene === 'PASSIVE_TREE') buttonsToCheck = passiveButtons; else if (currentScene === 'DEX') buttonsToCheck = dexButtons; else if (currentScene === 'RELIQUARY') buttonsToCheck = relicButtons; else if (currentScene === 'GAME') buttonsToCheck = gameButtons; else if (currentScene === 'GAME_OVER') buttonsToCheck = gameOverButtons;
    buttonsToCheck.forEach(b => { if (b.isClicked(pos.x, pos.y)) { if (b.text && !b.text.includes("초원") && !b.text.includes("둥지") && !b.text.includes("지옥")) { Sound.click(); } b.onClick(); btnClicked = true; } });
    if (btnClicked) return;

    if (currentScene === 'GAME') {
        for (let i = 0; i < 5; i++) { let ix = 145 + i * 90; let iy = 995; if (pos.x >= ix && pos.x <= ix + 70 && pos.y >= iy && pos.y <= iy + 70) { if (inventory[i]) { draggingItem = { index: i, id: inventory[i], x: pos.x, y: pos.y }; selectedUnit = null; return; } } }
        let hitUnit = null; for (let i = units.length - 1; i >= 0; i--) if (units[i].isHit(pos.x, pos.y)) { hitUnit = units[i]; break; }
        if (hitUnit) { draggingUnit = hitUnit; selectedUnit = hitUnit; draggingUnit.origGridX = hitUnit.gridX; draggingUnit.origGridY = hitUnit.gridY; } else { selectedUnit = null; }
    }
}
function handleMove(event) { const pos = getPointerPos(event); if (draggingItem) { draggingItem.x = pos.x; draggingItem.y = pos.y; return; } if (draggingUnit) { draggingUnit.x = pos.x; draggingUnit.y = pos.y; } }
function handleUp(event) {
    if (draggingItem) {
        let targetUnit = null; for (let u of units) { if (u.isHit(draggingItem.x, draggingItem.y)) { targetUnit = u; break; } }
        if (targetUnit) { if (targetUnit.items.length < 3) { Sound.click(); targetUnit.items.push(draggingItem.id); inventory.splice(draggingItem.index, 1); } else { alert("유닛당 아이템은 최대 3개까지만 장착할 수 있습니다!"); } }
        draggingItem = null; return;
    }
    if (draggingUnit) {
        const col = Math.floor((draggingUnit.x - START_X) / TILE_SIZE); const row = Math.floor((draggingUnit.y - START_Y) / TILE_SIZE); let isInvalid = true;
        if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS && !(col === 3 && row === 3)) {
            let targetUnit = units.find(u => u !== draggingUnit && u.gridX === col && u.gridY === row);
            if (targetUnit) { targetUnit.gridX = draggingUnit.origGridX; targetUnit.gridY = draggingUnit.origGridY; targetUnit.updatePosition(); draggingUnit.gridX = col; draggingUnit.gridY = row; isInvalid = false; } else { draggingUnit.gridX = col; draggingUnit.gridY = row; isInvalid = false; }
        }
        if (isInvalid) { draggingUnit.gridX = draggingUnit.origGridX; draggingUnit.gridY = draggingUnit.origGridY; } else { draggingUnit.origGridX = draggingUnit.gridX; draggingUnit.origGridY = draggingUnit.gridY; }
        draggingUnit.updatePosition(); draggingUnit = null;
    }
}
canvas.addEventListener('mousedown', handleDown); canvas.addEventListener('mousemove', handleMove); canvas.addEventListener('mouseup', handleUp); canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleDown(e); }, { passive: false }); canvas.addEventListener('touchmove', (e) => { e.preventDefault(); handleMove(e); }, { passive: false }); canvas.addEventListener('touchend', (e) => { e.preventDefault(); handleUp(e); }, { passive: false });

// ★ 가로형 압축 시너지 UI (토글 버튼 완벽 연동)
function drawUI() {
    ctx.fillStyle = "#ffdd57"; ctx.font = "bold 28px Malgun Gothic"; ctx.textAlign = "center";
    ctx.fillText(`보유 골드: ${PlayerProfile.gold} G`, centerX, 80);
    ctx.fillStyle = "#fff"; ctx.font = "bold 22px Malgun Gothic";
    ctx.fillText(`${STAGE_DB[selectedStage].name} - 웨이브 ${currentWave} / ${STAGE_DB[selectedStage].maxWave}`, centerX, 40);

    ctx.fillStyle = "rgba(255, 255, 255, 0.2)"; ctx.fillRect(10, 100, 80, 30);
    ctx.fillStyle = "#fff"; ctx.font = "bold 14px Malgun Gothic"; ctx.textAlign = "center";
    ctx.fillText(isSynergyOpen ? "▲ 시너지" : "▼ 시너지", 50, 120);

    if (isSynergyOpen) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; ctx.beginPath(); ctx.roundRect(10, 135, 700, 60, 10); ctx.fill();
        let index = 0; const traitNames = { SWORD: "검사", ARCHER: "궁수", MAGE: "마법사", SHIELD: "방패병", ASSASSIN: "도적", CANNON: "포병", PRIEST: "사제" };
        for (const [trait, count] of Object.entries(activeSynergies)) {
            if (count > 0) {
                let drawX = 30 + (index % 4) * 170; let drawY = 160 + (index >= 4 ? 25 : 0);
                ctx.fillStyle = count >= 3 ? "#ffca28" : "#aaaaaa"; ctx.font = count >= 3 ? "bold 16px Malgun Gothic" : "16px Malgun Gothic";
                ctx.textAlign = "left"; ctx.fillText(`${traitNames[trait]} (${count}/3)`, drawX, drawY); index++;
            }
        }
    }
}

// ★ [혁신] 하단 고정 UI 패널 그리기 (골드 비용 가독성 및 분기 텍스트 가시성 극대화)
function drawFixedUnitPanel() {
    if (!selectedUnit) return;
    
    ctx.fillStyle = "rgba(20, 20, 25, 0.95)"; 
    ctx.beginPath(); ctx.roundRect(10, 840, 700, 100, 10); ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"; ctx.lineWidth = 2; ctx.stroke();

    ctx.fillStyle = selectedUnit.color || "#fff";
    ctx.font = "bold 24px Malgun Gothic"; ctx.textAlign = "left";
    ctx.fillText(`[${selectedUnit.name}]`, 25, 875);
    
    ctx.fillStyle = "#ddd"; ctx.font = "16px Malgun Gothic";
    ctx.fillText(`공격력: ${selectedUnit.damage}  |  공속: ${selectedUnit.cooldown}  |  사거리: ${selectedUnit.range}`, 25, 915);

    // 판매 UI 영역 설정
    ctx.fillStyle = "#c62828"; ctx.fillRect(590, 850, 100, 80);
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "bold 16px Malgun Gothic";
    ctx.fillText("💰 판매", 640, 880); 
    ctx.fillStyle = "#ffdd57"; ctx.font = "bold 20px Arial"; 
    ctx.fillText(`+${selectedUnit.sellPrice} G`, 640, 910);

    // 업그레이드 전직 UI 분기 연동
    if (Array.isArray(selectedUnit.next)) {
        // 우측 루트 전직 버튼
        ctx.fillStyle = (PlayerProfile.gold >= selectedUnit.upgradeCost) ? "#1565c0" : "#444";
        ctx.fillRect(450, 850, 130, 80); 
        ctx.fillStyle = "#fff"; ctx.font = "bold 15px Malgun Gothic";
        ctx.fillText(`▶ ${UNIT_DB[selectedUnit.next[1]].name}`, 515, 880); 
        ctx.fillStyle = (PlayerProfile.gold >= selectedUnit.upgradeCost) ? "#ffea00" : "#ff5252";
        ctx.font = "bold 18px Arial"; ctx.fillText(`${selectedUnit.upgradeCost} G`, 515, 910);
        
        // 좌측 루트 전직 버튼
        ctx.fillStyle = (PlayerProfile.gold >= selectedUnit.upgradeCost) ? "#2e7d32" : "#444";
        ctx.fillRect(310, 850, 130, 80); 
        ctx.fillStyle = "#fff"; ctx.font = "bold 15px Malgun Gothic";
        ctx.fillText(`▶ ${UNIT_DB[selectedUnit.next[0]].name}`, 375, 880); 
        ctx.fillStyle = (PlayerProfile.gold >= selectedUnit.upgradeCost) ? "#ffea00" : "#ff5252";
        ctx.font = "bold 18px Arial"; ctx.fillText(`${selectedUnit.upgradeCost} G`, 375, 910);

    } else if (selectedUnit.next) {
        // 일반 단일 진화 연동
        ctx.fillStyle = (PlayerProfile.gold >= selectedUnit.upgradeCost) ? "#2e7d32" : "#444";
        ctx.fillRect(450, 850, 130, 80); 
        ctx.fillStyle = "#fff"; ctx.font = "bold 16px Malgun Gothic";
        ctx.fillText("⭐ 레벨업", 515, 880); 
        ctx.fillStyle = (PlayerProfile.gold >= selectedUnit.upgradeCost) ? "#ffea00" : "#ff5252";
        ctx.font = "bold 20px Arial"; ctx.fillText(`-${selectedUnit.upgradeCost} G`, 515, 910);
    } else {
        ctx.fillStyle = "#333"; ctx.fillRect(450, 850, 130, 80);
        ctx.fillStyle = "#888"; ctx.font = "bold 20px Arial"; ctx.fillText("MAX", 515, 895);
    }
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (bgImage && bgImage.complete && bgImage.naturalWidth !== 0) {
        const imgRatio = bgImage.width / bgImage.height; const canvasRatio = canvas.width / canvas.height; let drawW, drawH, drawX, drawY;
        if (imgRatio > canvasRatio) { drawH = canvas.height; drawW = canvas.height * imgRatio; } else { drawW = canvas.width; drawH = canvas.width / imgRatio; }
        drawX = (canvas.width - drawW) / 2; drawY = (canvas.height - drawH) / 2; ctx.drawImage(bgImage, drawX, drawY, drawW, drawH);
        const startX = centerX - (GRID_COLS * TILE_SIZE) / 2; const startY = centerY - (GRID_ROWS * TILE_SIZE) / 2;
        for (let r = 0; r < GRID_ROWS; r++) { for (let c = 0; c < GRID_COLS; c++) { const tx = startX + c * TILE_SIZE; const ty = startY + r * TILE_SIZE; ctx.fillStyle = "rgba(255, 255, 255, 0.05)"; ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE); ctx.strokeStyle = "rgba(255, 255, 255, 0.15)"; ctx.lineWidth = 1; ctx.strokeRect(tx, ty, TILE_SIZE, TILE_SIZE); } }
    } else { ctx.fillStyle = "red"; ctx.fillRect(0, 0, canvas.width, canvas.height); }

    ctx.save();
    if (screenShake > 0) { const dx = (Math.random() - 0.5) * screenShake; const dy = (Math.random() - 0.5) * screenShake; ctx.translate(dx, dy); screenShake *= 0.9; if (screenShake < 0.5) screenShake = 0; }

    if (currentScene === 'MAIN_MENU') { ctx.fillStyle = "#111"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "#ffd700"; ctx.font = "bold 60px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText("업그레이드 디펜스", centerX, 300); menuButtons.forEach(btn => btn.draw()); }
    else if (currentScene === 'GAME_OVER') { ctx.fillStyle = "#222"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "#ff5252"; ctx.font = "bold 80px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText("GAME OVER", centerX, 300); ctx.fillStyle = "#fff"; ctx.font = "30px Malgun Gothic"; ctx.fillText(`처치한 몬스터: ${sessionStats.kills}마리`, centerX, 450); ctx.fillText(`최고 웨이브: ${sessionStats.maxWave}`, centerX, 500); ctx.fillText(`획득한 골드: ${sessionStats.goldEarned}G`, centerX, 550); gameOverButtons.forEach(btn => btn.draw()); }
    else if (currentScene === 'PASSIVE_TREE') { ctx.fillStyle = "#1e272c"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "#ffffff"; ctx.font = "bold 40px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText("🌳 영구 패시브 성장", centerX, 120); ctx.fillStyle = "#ffd700"; ctx.font = "bold 30px Malgun Gothic"; ctx.fillText(`보유 영혼석: ${PlayerProfile.soulStones} 💎`, centerX, 200); passiveButtons.forEach(btn => btn.draw()); }
    else if (currentScene === 'DEX') { ctx.fillStyle = "#2e1c0c"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "#ffffff"; ctx.font = "bold 40px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText("📖 영웅 도감 & 마스터리", centerX, 80); ctx.fillStyle = "#ffd700"; ctx.font = "bold 26px Malgun Gothic"; ctx.fillText(`보유 영혼석: ${PlayerProfile.soulStones} 💎`, centerX, 130); dexButtons.forEach(btn => btn.draw()); }
    else if (currentScene === 'RELIQUARY') {
        ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "#ffffff"; ctx.font = "bold 40px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText("🔮 유물 뽑기", centerX, 80); ctx.fillStyle = "#ffd700"; ctx.font = "bold 26px Malgun Gothic"; ctx.fillText(`보유 영혼석: ${PlayerProfile.soulStones} 💎`, centerX, 130);
        if (gachaState === "IDLE") { relicButtons.forEach(btn => btn.draw()); let startY = 220; ctx.fillStyle = "#aaa"; ctx.font = "18px Malgun Gothic"; ctx.fillText("보유 중인 유물 현황 (최대 5종)", centerX, startY); startY += 40; for (let key in PlayerProfile.relics) { if (PlayerProfile.relics[key] > 0) { let rDef = RELIC_DB[key]; ctx.fillStyle = rDef.color; ctx.font = "bold 22px Malgun Gothic"; ctx.fillText(`[${rDef.grade}] ${rDef.name} Lv.${PlayerProfile.relics[key]}`, centerX, startY); startY += 30; } } }
        else if (gachaState === "SPINNING") { gachaTimer--; screenShake = 5; ctx.fillStyle = "#fff"; ctx.font = "bold 30px Malgun Gothic"; ctx.fillText("두구두구두구...", centerX, 400); if (gachaTimer <= 0) { gachaState = "RESULT"; gachaTimer = 180; const rData = RELIC_DB[currentPull]; if (rData.grade === "SS") { screenShake = 40; Sound.legendary(); } else if (rData.grade === "S" || rData.grade === "A") { screenShake = 15; Sound.epic(); } else { screenShake = 5; Sound.clear(); } for (let i = 0; i < 60; i++) gachaParticles.push(new GachaParticle(centerX, 400, rData.color)); } }
        else if (gachaState === "RESULT") { gachaTimer--; const rData = RELIC_DB[currentPull]; gachaParticles.forEach((p, i) => { if (!p.update()) gachaParticles.splice(i, 1); else p.draw(); }); ctx.fillStyle = rData.color; ctx.font = "bold 50px Malgun Gothic"; ctx.shadowColor = rData.color; ctx.shadowBlur = 20; ctx.fillText(`[${rData.grade}] ${rData.name}!`, centerX, 400); ctx.shadowBlur = 0; ctx.fillStyle = "#fff"; ctx.font = "24px Malgun Gothic"; ctx.fillText(rData.desc, centerX, 460); if (gachaTimer <= 0) gachaState = "IDLE"; }
    }
    else if (currentScene === 'GAME') {
        calculateSynergies();
        ctx.fillStyle = "#0288d1"; ctx.beginPath(); ctx.arc(centerX, centerY, 30, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "bold 20px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText(`HP ${baseHp}`, centerX, centerY + 7);
        
        // ★ 전장 시작 5초 전 카운트다운 타임 연동
        if (countdownTimer > 0) {
            countdownTimer--;
            units.forEach(unit => { unit.updatePosition(); unit.draw(); });
            ctx.fillStyle = "rgba(0, 0, 0, 0.4)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#ffdd57"; ctx.font = "bold 80px Malgun Gothic"; ctx.textAlign = "center";
            let sec = Math.ceil(countdownTimer / 60);
            ctx.fillText(`전투 시작 ${sec}초 전!`, centerX, centerY - 50);
            ctx.fillStyle = "#fff"; ctx.font = "24px Malgun Gothic";
            ctx.fillText("유닛을 뽑아 미리 배치하세요!", centerX, centerY + 20);
        } else {
            frameCount++;
            if (currentWave <= STAGE_DB[selectedStage].maxWave) { 
                if (frameCount % 60 === 0 && frameCount % 600 !== 0) monsters.push(new Monster(false, false));
                
                // ★ 5라운드(600프레임) 단위 중간 보스 및 최종 20라운드 최종 보스 출격 설정
                if (frameCount % 600 === 0 && frameCount > 0) { 
                    let isFinal = (currentWave === STAGE_DB[selectedStage].maxWave); 
                    let isMidBoss = (currentWave % 5 === 0);
                    if (isMidBoss || isFinal) { 
                        monsters.push(new Monster(true, isFinal)); 
                        Sound.boss(); 
                        screenShake = Math.max(screenShake, 15); // ★ 보스 등장시에만 화면 쉐이크 작동!
                    }
                    let waveBonusGold = currentWave * 20; PlayerProfile.gold += waveBonusGold; goldParticles.push(new GoldParticle(centerX, centerY - 50, waveBonusGold, false));
                    if (!isFinal) currentWave++; 
                } 
            }
            units.forEach(unit => { unit.updatePosition(); unit.update(); unit.draw(); });
            for (let i = projectiles.length - 1; i >= 0; i--) { let p = projectiles[i]; p.update(); p.draw(); if (!p.active) projectiles.splice(i, 1); }
            for (let i = monsters.length - 1; i >= 0; i--) {
                let m = monsters[i];
                if (m.hp <= 0) {
                    const r3Lvl = PlayerProfile.relics["R3"] || 0; const earnedGold = (m.isBoss ? 150 : 12) + (r3Lvl * 5); sessionStats.kills++; sessionStats.goldEarned += earnedGold; PlayerProfile.gold += earnedGold; goldParticles.push(new GoldParticle(m.x, m.y, earnedGold, m.isBoss)); Sound.coin(); if (m.isBoss && inventory.length < 5) { const itemKeys = Object.keys(ITEM_DB); inventory.push(itemKeys[Math.floor(Math.random() * itemKeys.length)]); }
                    if (m.isFinalBoss) { 
                        Sound.clear(); 
                        let reward = selectedStage * 50; PlayerProfile.soulStones += reward; 
                        if (PlayerProfile.unlockedStage === selectedStage && PlayerProfile.unlockedStage < Object.keys(STAGE_DB).length) PlayerProfile.unlockedStage++; 
                        saveGame(); 
                        alert(`🎉 스테이지 ${selectedStage} 클리어! 🎉\n정산 보상: 영혼석 💎 ${reward}개 획득!`); 
                        currentScene = 'MAIN_MENU'; 
                    } 
                    monsters.splice(i, 1); continue;
                }
                let reachedBase = m.update(); m.draw();
                if (reachedBase) { 
                    baseHp -= m.isBoss ? 3 : 1; monsters.splice(i, 1); 
                    if (baseHp <= 0) { sessionStats.maxWave = currentWave; const earnedStones = Math.floor(frameCount / 300); PlayerProfile.soulStones += earnedStones; saveGame(); alert(`기지가 파괴되었습니다!\n정산 보상: 영혼석 💎 ${earnedStones}개 획득!`); currentScene = 'GAME_OVER'; } 
                }
            }
            for (let i = goldParticles.length - 1; i >= 0; i--) { let p = goldParticles[i]; if (!p.update()) goldParticles.splice(i, 1); else p.draw(); }
        }
        
        ctx.fillStyle = "#222"; ctx.fillRect(0, 950, canvas.width, 330); ctx.fillStyle = "#444"; ctx.fillRect(0, 950, canvas.width, 10); ctx.fillStyle = "#aaa"; ctx.font = "20px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText("보스를 잡아 획득한 아이템을 유닛에게 드래그하세요!", centerX, 980);
        for (let i = 0; i < 5; i++) { let ix = 145 + i * 90; let iy = 995; ctx.fillStyle = "#333"; ctx.fillRect(ix, iy, 70, 70); ctx.strokeStyle = "#555"; ctx.lineWidth = 2; ctx.strokeRect(ix, iy, 70, 70); if (inventory[i] && (!draggingItem || draggingItem.index !== i)) { let item = ITEM_DB[inventory[i]]; ctx.fillStyle = item.color; ctx.beginPath(); ctx.arc(ix + 35, iy + 35, 25, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#000"; ctx.font = "20px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(item.symbol, ix + 35, iy + 37); } }
        if (draggingItem) { let item = ITEM_DB[draggingItem.id]; ctx.fillStyle = item.color; ctx.beginPath(); ctx.arc(draggingItem.x, draggingItem.y, 25, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#000"; ctx.font = "20px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(item.symbol, draggingItem.x, draggingItem.y + 2); }
        
        drawUI();
        drawFixedUnitPanel(); // 하단 탭 고정 연산 패널 출력
        gameButtons.forEach(btn => btn.draw()); 
    }
    ctx.restore(); requestAnimationFrame(gameLoop);
}

gameLoop();