const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const logicalWidth = 720; 
const logicalHeight = 1280;
const dpr = window.devicePixelRatio || 1;

canvas.width = logicalWidth * dpr;
canvas.height = logicalHeight * dpr;

document.body.style.margin = "0";
document.body.style.overflow = "hidden";
document.body.style.backgroundColor = "#000";

function resizeCanvas() {
    const windowRatio = window.innerWidth / window.innerHeight;
    const gameRatio = logicalWidth / logicalHeight;
    
    if (windowRatio < gameRatio) {
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = (window.innerWidth / gameRatio) + 'px';
    } else {
        canvas.style.width = (window.innerHeight * gameRatio) + 'px';
        canvas.style.height = window.innerHeight + 'px';
    }
    
    canvas.style.position = "absolute";
    canvas.style.left = "50%";
    canvas.style.top = "50%";
    canvas.style.transform = "translate(-50%, -50%)";
    canvas.style.zIndex = "100"; 
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
ctx.scale(dpr, dpr);

const centerX = logicalWidth / 2;
const centerY = 550; // ★ 이 좌표가 없어서 멈췄던 겁니다! 부활 완료!

const socket = io("https://defense-game-ilbv.onrender.com");

let mySide = ""; 
let myGold = 0;
let myInventory = []; 
let monsters = []; 
let units = []; 
let projectiles = []; 
let nexusHp = 200; 
let isGameStarted = false; 
let frameCount = 0; 
let countdown = 0;
let currentWave = 1;
let maxWave = 20;
let isSynergyOpen = true;
let activeSynergies = { SWORD: 0, ARCHER: 0, MAGE: 0, SHIELD: 0, ASSASSIN: 0, CANNON: 0, PRIEST: 0 };

let draggingUnit = null;
let selectedUnit = null; 
let origGridX = 0; let origGridY = 0;
let draggingItem = null; 

const TILE_SIZE = 80;
const START_X = 0; 
const START_Y = 270; 

const ITEM_DB = {
    "SWORD": { name: "B.F대검", color: "#ff5252", symbol: "⚔️", type: "dmg", value: 1.2 },
    "BOW": { name: "곡궁", color: "#69f0ae", symbol: "🏹", type: "spd", value: 0.85 },
    "STAFF": { name: "지팡이", color: "#40c4ff", symbol: "🪄", type: "rng", value: 30 }
};

let bgImage = new Image(); bgImage.src = 'bg_1.png';
const IMAGE_CACHE = {};
function getSprite(src) {
    if (!src) return null;
    if (!IMAGE_CACHE[src]) { const img = new Image(); img.src = src; IMAGE_CACHE[src] = img; }
    return IMAGE_CACHE[src];
}

class UIButton {
    constructor(x, y, width, height, text, color, onClick) { this.x = x; this.y = y; this.width = width; this.height = height; this.text = text; this.color = color; this.onClick = onClick; }
    draw() { ctx.fillStyle = this.color; ctx.beginPath(); ctx.roundRect(this.x, this.y, this.width, this.height, 15); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = "#ffffff"; ctx.font = "bold 20px Malgun Gothic"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(this.text, this.x + this.width / 2, this.y + this.height / 2); }
    isClicked(mx, my) { return mx >= this.x && mx <= this.x + this.width && my >= this.y && my <= this.y + this.height; }
}

const gameButtons = [
    new UIButton(40, 1090, 300, 90, "🎲 뽑기 (100G)", "#1565c0", () => { socket.emit('request_gacha'); }),
    new UIButton(380, 1090, 300, 90, "🏃 로비로", "#c62828", () => { window.location.href = '/'; })
];

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

const lobby = document.getElementById('lobby');
const gameContainer = document.getElementById('gameContainer');
const roomInput = document.getElementById('roomInput');
const joinBtn = document.getElementById('joinBtn');
const statusMsg = document.getElementById('statusMsg');

const backBtn = document.createElement('button');
backBtn.innerText = "🏃 메인화면(싱글)으로 돌아가기";
backBtn.style.cssText = "display:block; width:100%; padding:15px; margin-top:20px; font-size:18px; font-weight:bold; background-color:#c62828; color:white; border:none; border-radius:10px; cursor:pointer;";
backBtn.onclick = () => window.location.href = '/';
lobby.appendChild(backBtn);

joinBtn.addEventListener('click', () => {
    if (roomInput.value.trim()) {
        joinBtn.disabled = true;
        socket.emit('join_room', { roomCode: roomInput.value.trim(), profile: PlayerProfile });
        statusMsg.textContent = "방 입장 완료! 다른 플레이어를 기다리는 중...";
        joinBtn.style.display = "none"; roomInput.style.display = "none";
        backBtn.style.display = "none";
    }
});

socket.on('assign_side', (side) => { mySide = side; });
socket.on('game_start', () => { lobby.style.display = 'none'; gameContainer.style.display = 'block'; isGameStarted = true; drawGameScreen(); });

socket.on('game_state', (data) => {
    if (!isGameStarted) return;
    if (data.countdown !== undefined) countdown = data.countdown;
    if (data.currentWave !== undefined) currentWave = data.currentWave;
    if (data.maxWave !== undefined) maxWave = data.maxWave;
    if (data.monsters) monsters = data.monsters;
    if (data.projectiles) projectiles = data.projectiles; 
    
    if (data.units) {
        if (draggingUnit) data.units.forEach(u => { if (u.id === draggingUnit.id) { u.x = draggingUnit.x; u.y = draggingUnit.y; } });
        units = data.units;
        if (draggingUnit) draggingUnit = units.find(u => u.id === draggingUnit.id);
        if (selectedUnit) selectedUnit = units.find(u => u.id === selectedUnit.id);
    }
    
    if (data.nexusHp !== undefined) nexusHp = data.nexusHp;
    if (data.players) {
        let me = data.players.find(p => p.id === socket.id);
        if (me) { 
            myGold = me.gold; 
            myInventory = me.inventory || [];
        }
    }
});

socket.on('game_over', (stats) => {
    isGameStarted = false; 
    document.getElementById('goKills').innerText = stats.kills;
    document.getElementById('goWave').innerText = stats.wave;
    document.getElementById('goGold').innerText = stats.goldEarned;
    document.getElementById('gameOverOverlay').style.display = 'flex';
});

socket.on('game_clear', (data) => {
    isGameStarted = false;
    let earnedStones = data.stage * 100;
    PlayerProfile.soulStones += earnedStones;
    localStorage.setItem('defenseSaveData', JSON.stringify(PlayerProfile));
    alert(`🎉 협동 모드 클리어! 🎉\n정산 보상: 영혼석 💎 ${earnedStones}개 획득!`);
    window.location.href = '/'; 
});

const popupOverlay = document.getElementById('popupOverlay');
socket.on('gacha_result', (data) => {
    if (data.success) {
        const unitDef = UNIT_DB[data.unit.type];
        if (unitDef) {
            document.getElementById('popupImg').style.backgroundImage = `url('${unitDef.imgSrc}')`;
            document.getElementById('popupName').innerText = unitDef.name;
            popupOverlay.style.display = 'flex'; 
        }
    } else alert(data.msg); 
});
document.getElementById('popupClose').addEventListener('click', () => { popupOverlay.style.display = 'none'; });

function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    let clientX = e.clientX; let clientY = e.clientY;
    if (e.touches && e.touches.length > 0) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    return { x: (clientX - rect.left) * (logicalWidth / rect.width), y: (clientY - rect.top) * (logicalHeight / rect.height) };
}

function handleDown(e) {
    if (!isGameStarted) return;
    const pos = getPointerPos(e);
    
    let btnClicked = false;
    gameButtons.forEach(b => { 
        if (b.isClicked(pos.x, pos.y)) { b.onClick(); btnClicked = true; } 
    });
    if (btnClicked) return;

    if (pos.x >= 10 && pos.x <= 90 && pos.y >= 100 && pos.y <= 130) { isSynergyOpen = !isSynergyOpen; return; }

    for (let i = 0; i < 5; i++) {
        let ix = 135 + i * 90; let iy = 995;
        if (pos.x >= ix && pos.x <= ix + 70 && pos.y >= iy && pos.y <= iy + 70) {
            if (myInventory[i]) { draggingItem = { index: i, id: myInventory[i], x: pos.x, y: pos.y }; selectedUnit = null; return; }
        }
    }
    
    if (selectedUnit && draggingUnit === null) {
        if (pos.y >= 840 && pos.y <= 940) {
            const unitDef = UNIT_DB[selectedUnit.type];
            if (pos.x >= 590 && pos.x <= 690) { socket.emit('sell_unit', { id: selectedUnit.id }); selectedUnit = null; return; }
            if (Array.isArray(unitDef.next)) {
                if (pos.x >= 450 && pos.x <= 580) { if (myGold >= unitDef.upgradeCost) socket.emit('upgrade_unit', { id: selectedUnit.id, next: unitDef.next[1] }); selectedUnit = null; return; }
                if (pos.x >= 310 && pos.x <= 440) { if (myGold >= unitDef.upgradeCost) socket.emit('upgrade_unit', { id: selectedUnit.id, next: unitDef.next[0] }); selectedUnit = null; return; }
            } else if (unitDef.next) {
                if (pos.x >= 450 && pos.x <= 580) { if (myGold >= unitDef.upgradeCost) socket.emit('upgrade_unit', { id: selectedUnit.id, next: unitDef.next }); selectedUnit = null; return; }
            }
            if (pos.x >= 10 && pos.x <= 710) return; 
        }
    }

    const hitUnit = units.find(u => u.side === mySide && Math.hypot(u.x - pos.x, u.y - pos.y) < 40);
    if (hitUnit) { draggingUnit = hitUnit; selectedUnit = hitUnit; origGridX = hitUnit.gridX; origGridY = hitUnit.gridY; }
    else { selectedUnit = null; }
}

function handleMove(e) {
    e.preventDefault(); 
    const pos = getPointerPos(e);
    if (draggingItem) { draggingItem.x = pos.x; draggingItem.y = pos.y; return; }
    if (draggingUnit) { draggingUnit.x = pos.x; draggingUnit.y = pos.y; }
}

function handleUp(e) {
    if (draggingItem) {
        let targetUnit = units.find(u => u.side === mySide && Math.hypot(u.x - draggingItem.x, u.y - draggingItem.y) < 40);
        if (targetUnit) socket.emit('equip_item', { unitId: targetUnit.id, itemIndex: draggingItem.index });
        draggingItem = null; return;
    }

    if (!draggingUnit) return;
    
    const targetCol = Math.floor((draggingUnit.x - START_X) / TILE_SIZE);
    const targetRow = Math.floor((draggingUnit.y - START_Y) / TILE_SIZE);
    let isValid = true;

    if (targetCol < 0 || targetCol > 8 || targetRow < 0 || targetRow > 6) isValid = false;
    if (mySide === "left" && targetCol > 3) isValid = false; 
    if (mySide === "right" && targetCol < 5) isValid = false; 

    if (isValid) {
        socket.emit('move_unit', { id: draggingUnit.id, gridX: targetCol, gridY: targetRow });
    } else {
        draggingUnit.x = START_X + origGridX * TILE_SIZE + TILE_SIZE/2;
        draggingUnit.y = START_Y + origGridY * TILE_SIZE + TILE_SIZE/2;
    }
    draggingUnit = null;
}

canvas.addEventListener('mousedown', handleDown); canvas.addEventListener('mousemove', handleMove); canvas.addEventListener('mouseup', handleUp); canvas.addEventListener('touchstart', handleDown, { passive: false }); canvas.addEventListener('touchmove', handleMove, { passive: false }); canvas.addEventListener('touchend', handleUp);

function calculateMySynergies() {
    activeSynergies = { SWORD: 0, ARCHER: 0, MAGE: 0, SHIELD: 0, ASSASSIN: 0, CANNON: 0, PRIEST: 0 };
    const myUnits = units.filter(u => u.side === mySide);
    const uniqueIds = [...new Set(myUnits.map(u => u.type))];
    uniqueIds.forEach(id => { 
        const trait = UNIT_DB[id].trait || id.split('_')[0]; 
        if (trait) activeSynergies[trait]++; 
    });
}

function drawUI() {
    ctx.fillStyle = "#ffdd57"; ctx.font = "bold 28px Malgun Gothic"; ctx.textAlign = "center";
    ctx.fillText(`보유 골드: ${myGold} G`, centerX, 80);
    ctx.fillStyle = "#fff"; ctx.font = "bold 22px Malgun Gothic";
    ctx.fillText(`멀티 협동 모드 - 웨이브 ${currentWave} / ${maxWave}`, centerX, 40);

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

function drawFixedUnitPanel() {
    if (!selectedUnit) return;
    const unitDef = UNIT_DB[selectedUnit.type];
    if (!unitDef) return;

    ctx.fillStyle = "rgba(20, 20, 25, 0.95)"; ctx.beginPath(); ctx.roundRect(10, 840, 700, 100, 10); ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"; ctx.lineWidth = 2; ctx.stroke();

    ctx.fillStyle = unitDef.color || "#fff"; ctx.font = "bold 24px Malgun Gothic"; ctx.textAlign = "left";
    ctx.fillText(`[${unitDef.name}]`, 25, 875);
    
    ctx.fillStyle = "#ddd"; ctx.font = "16px Malgun Gothic";
    ctx.fillText(`공격력: ${unitDef.damage}  |  공속: ${unitDef.cooldown}  |  사거리: ${unitDef.range}`, 25, 915);

    ctx.fillStyle = "#c62828"; ctx.fillRect(590, 850, 100, 80);
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "bold 16px Malgun Gothic";
    ctx.fillText("💰 판매", 640, 880); 
    ctx.fillStyle = "#ffdd57"; ctx.font = "bold 20px Arial"; ctx.fillText(`+${unitDef.sellPrice} G`, 640, 910);

    if (Array.isArray(unitDef.next)) {
        ctx.fillStyle = (myGold >= unitDef.upgradeCost) ? "#1565c0" : "#444"; ctx.fillRect(450, 850, 130, 80); 
        ctx.fillStyle = "#fff"; ctx.font = "bold 15px Malgun Gothic"; ctx.fillText(`▶ ${UNIT_DB[unitDef.next[1]].name}`, 515, 880); 
        ctx.fillStyle = (myGold >= unitDef.upgradeCost) ? "#ffea00" : "#ff5252"; ctx.font = "bold 18px Arial"; ctx.fillText(`${unitDef.upgradeCost} G`, 515, 910);
        
        ctx.fillStyle = (myGold >= unitDef.upgradeCost) ? "#2e7d32" : "#444"; ctx.fillRect(310, 850, 130, 80); 
        ctx.fillStyle = "#fff"; ctx.font = "bold 15px Malgun Gothic"; ctx.fillText(`▶ ${UNIT_DB[unitDef.next[0]].name}`, 375, 880); 
        ctx.fillStyle = (myGold >= unitDef.upgradeCost) ? "#ffea00" : "#ff5252"; ctx.font = "bold 18px Arial"; ctx.fillText(`${unitDef.upgradeCost} G`, 375, 910);
    } else if (unitDef.next) {
        ctx.fillStyle = (myGold >= unitDef.upgradeCost) ? "#2e7d32" : "#444"; ctx.fillRect(450, 850, 130, 80); 
        ctx.fillStyle = "#fff"; ctx.font = "bold 16px Malgun Gothic"; ctx.fillText("⭐ 레벨업", 515, 880); 
        ctx.fillStyle = (myGold >= unitDef.upgradeCost) ? "#ffea00" : "#ff5252"; ctx.font = "bold 20px Arial"; ctx.fillText(`-${unitDef.upgradeCost} G`, 515, 910);
    } else {
        ctx.fillStyle = "#333"; ctx.fillRect(450, 850, 130, 80); ctx.fillStyle = "#888"; ctx.font = "bold 20px Arial"; ctx.fillText("MAX", 515, 895);
    }
}

function drawGameScreen() {
    if (!isGameStarted) return;
    frameCount++;
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    
    if (bgImage && bgImage.complete && bgImage.naturalWidth !== 0) {
        const imgRatio = bgImage.width / bgImage.height; 
        const canvasRatio = logicalWidth / logicalHeight; 
        let drawW, drawH, drawX, drawY;
        if (imgRatio > canvasRatio) { 
            drawH = logicalHeight; drawW = logicalHeight * imgRatio; 
        } else { 
            drawW = logicalWidth; drawH = logicalWidth / imgRatio; 
        }
        drawX = (logicalWidth - drawW) / 2; drawY = (logicalHeight - drawH) / 2; 
        ctx.drawImage(bgImage, drawX, drawY, drawW, drawH);
    } else { 
        ctx.fillStyle = "#1a1a1a"; ctx.fillRect(0, 0, centerX, logicalHeight); 
        ctx.fillStyle = "#2d2d2d"; ctx.fillRect(centerX, 0, centerX, logicalHeight); 
    }
    
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)"; ctx.lineWidth = 1;
    for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 9; c++) {
            if (c === 4) continue; 
            let tx = START_X + c * TILE_SIZE; let ty = START_Y + r * TILE_SIZE;
            ctx.fillStyle = "rgba(255, 255, 255, 0.05)"; ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            ctx.strokeRect(tx, ty, TILE_SIZE, TILE_SIZE);
        }
    }

    ctx.strokeStyle = "rgba(255, 255, 0, 0.5)"; ctx.lineWidth = 5;
    if(mySide === "left") ctx.strokeRect(START_X, START_Y, TILE_SIZE * 4, TILE_SIZE * 7);
    else ctx.strokeRect(START_X + TILE_SIZE * 5, START_Y, TILE_SIZE * 4, TILE_SIZE * 7);

    calculateMySynergies();
    drawUI();

    if (countdown > 0) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; ctx.fillRect(0, 0, logicalWidth, logicalHeight);
        ctx.fillStyle = "#ffdd57"; ctx.font = "bold 80px Malgun Gothic"; ctx.textAlign = "center";
        let sec = Math.ceil(countdown / 60);
        ctx.fillText(`전투 시작 ${sec}초 전!`, centerX, centerY - 50);
        ctx.fillStyle = "#fff"; ctx.font = "24px Malgun Gothic";
        ctx.fillText("유닛을 뽑아 진영에 배치하세요!", centerX, centerY + 20);
    }

    if (Array.isArray(units)) {
        units.forEach(u => {
            const unitDef = UNIT_DB[u.type];
            if (!unitDef) return;
            const img = getSprite(unitDef.imgSrc); const drawSize = 80;
            if (img && img.complete) {
                const frameW = img.naturalWidth / 2; const frameH = img.naturalHeight / 2;
                let frameCol = 0; let frameRow = 0; 
                if (draggingUnit && draggingUnit.id === u.id) {
                    ctx.globalAlpha = 0.7; ctx.drawImage(img, frameCol * frameW, frameRow * frameH, frameW, frameH, u.x - drawSize/2, u.y - drawSize/2 - 15, drawSize, drawSize); ctx.globalAlpha = 1.0;
                } else {
                    ctx.drawImage(img, frameCol * frameW, frameRow * frameH, frameW, frameH, u.x - drawSize/2, u.y - drawSize/2, drawSize, drawSize);
                }
            } else { ctx.fillStyle = unitDef.color || "white"; ctx.beginPath(); ctx.arc(u.x, u.y, 25, 0, Math.PI * 2); ctx.fill(); }

            ctx.strokeStyle = (u.side === "left") ? "cyan" : "lime"; ctx.lineWidth = 2; ctx.beginPath();
            ctx.ellipse(u.x, u.y + 25, 30, 12, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = "#fff"; ctx.font = "bold 14px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText(unitDef.name, u.x, u.y + 50);

            if (u.items && u.items.length > 0) { 
                let startX = u.x - (u.items.length * 14) / 2 + 7; 
                for (let i = 0; i < u.items.length; i++) { 
                    let itemDef = ITEM_DB[u.items[i]]; 
                    ctx.fillStyle = itemDef.color; ctx.fillRect(startX + i * 14 - 5, u.y + 50, 10, 10); 
                } 
            }

            if (selectedUnit && selectedUnit.id === u.id) {
                let drawRange = unitDef.range;
                if (u.items) u.items.forEach(itemId => { if (ITEM_DB[itemId].type === "rng") drawRange += ITEM_DB[itemId].value; });
                ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(u.x, u.y, drawRange, 0, Math.PI * 2); ctx.stroke();
            }
        });
    }

    if (Array.isArray(monsters)) {
        monsters.forEach(m => {
            if (m.stunTimer > 0) ctx.fillStyle = "#9e9e9e"; 
            else if (m.isBoss) ctx.fillStyle = "#ffb300"; 
            else ctx.fillStyle = "red"; 

            ctx.beginPath(); ctx.arc(m.x, m.y, m.isBoss ? 30 : 15, 0, Math.PI * 2); ctx.fill();
            if (m.isBoss) {
                ctx.strokeStyle = "#ffd700"; ctx.lineWidth = 5; ctx.stroke();
                ctx.fillStyle = "#fff"; ctx.font = "bold 14px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText("BOSS", m.x, m.y - 35);
            }
            let barY = m.y - (m.isBoss ? 55 : 25);
            ctx.fillStyle = "black"; ctx.fillRect(m.x - 20, barY, 40, 5);
            ctx.fillStyle = "#00e676"; ctx.fillRect(m.x - 20, barY, 40 * (m.hp / m.maxHp), 5);
        });
    }

    if (Array.isArray(projectiles)) {
        projectiles.forEach(p => {
            ctx.fillStyle = (p.effect === "slow" || p.effect === "deep_slow") ? "#00e5ff" : 
                            (p.effect === "stun" || p.effect === "deep_stun") ? "#cfd8dc" : 
                            (p.effect === "crit") ? "#ff1744" : 
                            (p.effect === "splash" || p.effect === "deep_splash") ? "#ff9800" : "#ffff00"; 
            ctx.beginPath(); 
            if (p.isHeal) { ctx.fillStyle = "#69f0ae"; ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "white"; ctx.font = "12px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("✚", p.x, p.y); } 
            else { let pRadius = (p.effect === "crit") ? 8 : 5; ctx.arc(p.x, p.y, pRadius, 0, Math.PI * 2); ctx.fill(); }
        });
    }

    ctx.fillStyle = "rgba(75, 0, 130, 0.95)"; ctx.fillRect(0, 950, logicalWidth, 70);
    ctx.fillStyle = (nexusHp > 50) ? "white" : "red"; ctx.font = "bold 30px Arial"; ctx.textAlign = "center";
    ctx.fillText(`🛡️ NEXUS HP: ${nexusHp}`, centerX, 995);

    ctx.fillStyle = "#222"; ctx.fillRect(0, 1020, logicalWidth, 260); 
    ctx.fillStyle = "#aaa"; ctx.font = "bold 20px Malgun Gothic"; ctx.textAlign = "center"; 
    ctx.fillText("📦 내 아이템 보관함", centerX, 1055);
    
    for (let i = 0; i < 5; i++) { 
        let ix = 135 + i * 90; let iy = 995; 
        ctx.fillStyle = "#333"; ctx.fillRect(ix, iy, 70, 70); 
        ctx.strokeStyle = "#555"; ctx.lineWidth = 2; ctx.strokeRect(ix, iy, 70, 70); 
        if (myInventory[i] && (!draggingItem || draggingItem.index !== i)) { 
            let item = ITEM_DB[myInventory[i]]; 
            ctx.fillStyle = item.color; ctx.beginPath(); ctx.arc(ix + 35, iy + 35, 25, 0, Math.PI * 2); ctx.fill(); 
            ctx.fillStyle = "#000"; ctx.font = "20px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(item.symbol, ix + 35, iy + 37); 
        } 
    }

    if (draggingItem) { 
        let item = ITEM_DB[draggingItem.id]; 
        ctx.fillStyle = item.color; ctx.beginPath(); ctx.arc(draggingItem.x, draggingItem.y, 25, 0, Math.PI * 2); ctx.fill(); 
        ctx.fillStyle = "#000"; ctx.font = "20px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(item.symbol, draggingItem.x, draggingItem.y + 2); 
    }

    drawFixedUnitPanel(); 
    gameButtons.forEach(btn => btn.draw());

    requestAnimationFrame(drawGameScreen);
}