const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const centerX = canvas.width / 2;

const socket = io(); 
let mySide = ""; 
let myGold = 0;
let myInventory = []; 
let monsters = []; 
let units = []; 
let projectiles = []; 
let nexusHp = 100; 
let isGameStarted = false; 
let frameCount = 0; 

let draggingUnit = null;
let selectedUnitId = null; 
let origX = 0; let origY = 0;
let draggingItem = null; 

const ITEM_DB = {
    "SWORD": { name: "B.F대검", color: "#ff5252", symbol: "⚔️", type: "dmg", value: 1.3 },
    "BOW": { name: "곡궁", color: "#69f0ae", symbol: "🏹", type: "spd", value: 0.7 },
    "STAFF": { name: "지팡이", color: "#40c4ff", symbol: "🪄", type: "rng", value: 40 }
};

let bgImage = new Image(); bgImage.src = 'bg_1.png';
const IMAGE_CACHE = {};
function getSprite(src) {
    if (!src) return null;
    if (!IMAGE_CACHE[src]) { const img = new Image(); img.src = src; IMAGE_CACHE[src] = img; }
    return IMAGE_CACHE[src];
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

const lobby = document.getElementById('lobby');
const gameContainer = document.getElementById('gameContainer');
const roomInput = document.getElementById('roomInput');
const joinBtn = document.getElementById('joinBtn');
const statusMsg = document.getElementById('statusMsg');

joinBtn.addEventListener('click', () => {
    if (roomInput.value.trim()) {
        // ★ [핵심 해결 로직] 더블클릭 원천 차단! 누르는 즉시 버튼을 잠가버립니다.
        joinBtn.disabled = true;
        
        socket.emit('join_room', { roomCode: roomInput.value.trim(), profile: PlayerProfile });
        statusMsg.textContent = "방 입장 완료! 다른 플레이어를 기다리는 중...";
        joinBtn.style.display = "none"; roomInput.style.display = "none";
    }
});

socket.on('assign_side', (side) => { mySide = side; });
socket.on('game_start', () => { lobby.style.display = 'none'; gameContainer.style.display = 'block'; isGameStarted = true; drawGameScreen(); });

socket.on('game_state', (data) => {
    if (!isGameStarted) return;
    if (data.monsters) monsters = data.monsters;
    if (data.projectiles) projectiles = data.projectiles; 
    
    if (data.units) {
        if (draggingUnit) data.units.forEach(u => { if (u.id === draggingUnit.id) { u.x = draggingUnit.x; u.y = draggingUnit.y; } });
        units = data.units;
        if (draggingUnit) draggingUnit = units.find(u => u.id === draggingUnit.id);
    }
    
    if (data.nexusHp !== undefined) nexusHp = data.nexusHp;
    if (data.players) {
        let me = data.players.find(p => p.id === socket.id);
        if (me) { 
            myGold = me.gold; 
            myInventory = me.inventory || [];
            document.getElementById('myGold').innerText = myGold; 
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

document.getElementById('btnGoLobby').addEventListener('click', () => { location.reload(); });
document.getElementById('btnGacha').addEventListener('click', () => { socket.emit('request_gacha'); });

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
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX = e.clientX; let clientY = e.clientY;
    if (e.touches && e.touches.length > 0) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

function handleDown(e) {
    if (!isGameStarted) return;
    const pos = getPointerPos(e);
    
    for (let i = 0; i < 5; i++) {
        let ix = 135 + i * 90; let iy = 1070;
        if (pos.x >= ix && pos.x <= ix + 70 && pos.y >= iy && pos.y <= iy + 70) {
            if (myInventory[i]) {
                draggingItem = { index: i, id: myInventory[i], x: pos.x, y: pos.y };
                selectedUnitId = null;
                return;
            }
        }
    }
    
    if (selectedUnitId) {
        let u = units.find(unit => unit.id === selectedUnitId);
        if (u && u.side === mySide) {
            const popupY = u.y - 80;
            const unitDef = UNIT_DB[u.type];
            let clickedUI = false;

            if (Array.isArray(unitDef.next)) {
                if (pos.y >= popupY - 20 && pos.y <= popupY + 20) {
                    if (pos.x >= u.x - 100 && pos.x <= u.x - 5) { 
                        if (myGold >= unitDef.upgradeCost) socket.emit('upgrade_unit', { id: u.id, next: unitDef.next[0] });
                        clickedUI = true;
                    } else if (pos.x >= u.x + 5 && pos.x <= u.x + 100) { 
                        if (myGold >= unitDef.upgradeCost) socket.emit('upgrade_unit', { id: u.id, next: unitDef.next[1] });
                        clickedUI = true;
                    }
                } else if (pos.y >= popupY + 25 && pos.y <= popupY + 60 && pos.x >= u.x - 40 && pos.x <= u.x + 40) { 
                    socket.emit('sell_unit', { id: u.id });
                    clickedUI = true;
                }
            } else {
                if (pos.x >= u.x - 90 && pos.x <= u.x - 10 && pos.y >= popupY + 10 && pos.y <= popupY + 50) { 
                    if (unitDef.next && myGold >= unitDef.upgradeCost) socket.emit('upgrade_unit', { id: u.id, next: unitDef.next });
                    clickedUI = true;
                } else if (pos.x >= u.x + 10 && pos.x <= u.x + 90 && pos.y >= popupY + 10 && pos.y <= popupY + 50) { 
                    socket.emit('sell_unit', { id: u.id });
                    clickedUI = true;
                }
            }
            if (clickedUI) { selectedUnitId = null; return; }
        }
        selectedUnitId = null;
    }

    const hitUnit = units.find(u => u.side === mySide && Math.hypot(u.x - pos.x, u.y - pos.y) < 40);
    if (hitUnit) { draggingUnit = hitUnit; origX = hitUnit.x; origY = hitUnit.y; }
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
        if (targetUnit) {
            socket.emit('equip_item', { unitId: targetUnit.id, itemIndex: draggingItem.index });
        }
        draggingItem = null; return;
    }

    if (!draggingUnit) return;
    let movedDist = Math.hypot(draggingUnit.x - origX, draggingUnit.y - origY);
    
    if (movedDist < 10) {
        draggingUnit.x = origX; draggingUnit.y = origY;
        selectedUnitId = draggingUnit.id;
    } else {
        let isValid = true;
        if (mySide === "left" && draggingUnit.x > centerX) isValid = false;
        if (mySide === "right" && draggingUnit.x < centerX) isValid = false;
        if (draggingUnit.y > 920 || draggingUnit.y < 50) isValid = false; 

        if (isValid) socket.emit('move_unit', { id: draggingUnit.id, x: draggingUnit.x, y: draggingUnit.y });
        else { draggingUnit.x = origX; draggingUnit.y = origY; }
    }
    draggingUnit = null;
}

canvas.addEventListener('mousedown', handleDown);
canvas.addEventListener('mousemove', handleMove);
canvas.addEventListener('mouseup', handleUp);
canvas.addEventListener('touchstart', handleDown, { passive: false });
canvas.addEventListener('touchmove', handleMove, { passive: false });
canvas.addEventListener('touchend', handleUp);

function drawGameScreen() {
    if (!isGameStarted) return;
    frameCount++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (bgImage && bgImage.complete) { ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height); } 
    else { ctx.fillStyle = "#1a1a1a"; ctx.fillRect(0, 0, centerX, canvas.height); ctx.fillStyle = "#2d2d2d"; ctx.fillRect(centerX, 0, centerX, canvas.height); }
    
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)"; ctx.lineWidth = 1;
    for(let x=0; x<=720; x+=80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 920); ctx.stroke(); }
    for(let y=0; y<=920; y+=80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(720, y); ctx.stroke(); }

    ctx.strokeStyle = "rgba(255, 255, 0, 0.5)"; ctx.lineWidth = 5;
    if(mySide === "left") ctx.strokeRect(0, 0, centerX, 920);
    else ctx.strokeRect(centerX, 0, centerX, 920);

    ctx.fillStyle = "rgba(75, 0, 130, 0.9)"; ctx.fillRect(0, 920, canvas.width, 100);
    ctx.fillStyle = (nexusHp > 30) ? "white" : "red"; ctx.font = "bold 30px Arial"; ctx.textAlign = "center";
    ctx.fillText(`🛡️ NEXUS HP: ${nexusHp}`, centerX, 980);

    ctx.fillStyle = "#222"; ctx.fillRect(0, 1020, canvas.width, 260); 
    ctx.fillStyle = "#aaa"; ctx.font = "bold 20px Malgun Gothic"; ctx.textAlign = "center"; 
    ctx.fillText("📦 내 아이템 보관함", centerX, 1055);
    
    for (let i = 0; i < 5; i++) { 
        let ix = 135 + i * 90; let iy = 1070; 
        ctx.fillStyle = "#333"; ctx.fillRect(ix, iy, 70, 70); 
        ctx.strokeStyle = "#555"; ctx.lineWidth = 2; ctx.strokeRect(ix, iy, 70, 70); 
        
        if (myInventory[i] && (!draggingItem || draggingItem.index !== i)) { 
            let item = ITEM_DB[myInventory[i]]; 
            ctx.fillStyle = item.color; ctx.beginPath(); ctx.arc(ix + 35, iy + 35, 25, 0, Math.PI * 2); ctx.fill(); 
            ctx.fillStyle = "#000"; ctx.font = "20px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(item.symbol, ix + 35, iy + 37); 
        } 
    }

    if (Array.isArray(units)) {
        units.forEach(u => {
            const unitDef = UNIT_DB[u.type];
            if (!unitDef) return;
            const img = getSprite(unitDef.imgSrc); const drawSize = 80;
            if (img && img.complete) {
                const frameW = img.naturalWidth / 2; const frameH = img.naturalHeight / 2;
                let frameCol = (frameCount % 60 < 30) ? 0 : 1; let frameRow = 0; 
                
                if (draggingUnit && draggingUnit.id === u.id) {
                    ctx.globalAlpha = 0.7; ctx.drawImage(img, frameCol * frameW, frameRow * frameH, frameW, frameH, u.x - drawSize/2, u.y - drawSize/2 - 15, drawSize, drawSize); ctx.globalAlpha = 1.0;
                } else {
                    ctx.drawImage(img, frameCol * frameW, frameRow * frameH, frameW, frameH, u.x - drawSize/2, u.y - drawSize/2, drawSize, drawSize);
                }
            } else {
                ctx.fillStyle = unitDef.color || "white"; ctx.beginPath(); ctx.arc(u.x, u.y, 25, 0, Math.PI * 2); ctx.fill();
            }

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

            if (selectedUnitId === u.id) {
                let drawRange = unitDef.range;
                if (u.items) u.items.forEach(itemId => { if (ITEM_DB[itemId].type === "rng") drawRange += ITEM_DB[itemId].value; });
                
                ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(u.x, u.y, drawRange, 0, Math.PI * 2); ctx.stroke();
                
                if (u.side === mySide) {
                    const popupY = u.y - 80;
                    ctx.textAlign = "center"; ctx.textBaseline = "middle";
                    
                    if (Array.isArray(unitDef.next)) {
                        ctx.fillStyle = (myGold >= unitDef.upgradeCost) ? "#2e7d32" : "#555"; ctx.fillRect(u.x - 100, popupY - 20, 95, 40);
                        ctx.fillStyle = "#fff"; ctx.font = "bold 12px Malgun Gothic"; ctx.fillText(UNIT_DB[unitDef.next[0]].name, u.x - 52, popupY);
                        
                        ctx.fillStyle = (myGold >= unitDef.upgradeCost) ? "#1565c0" : "#555"; ctx.fillRect(u.x + 5, popupY - 20, 95, 40);
                        ctx.fillStyle = "#fff"; ctx.fillText(UNIT_DB[unitDef.next[1]].name, u.x + 52, popupY);
                        
                        ctx.fillStyle = "#c62828"; ctx.fillRect(u.x - 40, popupY + 25, 80, 35);
                        ctx.fillStyle = "#fff"; ctx.fillText(`판매 ${unitDef.sellPrice}G`, u.x, popupY + 42);
                    } else {
                        ctx.fillStyle = (unitDef.next && myGold >= unitDef.upgradeCost) ? "#2e7d32" : "#555"; ctx.fillRect(u.x - 90, popupY + 10, 80, 40);
                        ctx.fillStyle = "#fff"; ctx.font = "bold 14px Malgun Gothic"; ctx.fillText(unitDef.next ? `업글 ${unitDef.upgradeCost}G` : "MAX", u.x - 50, popupY + 30);
                        
                        ctx.fillStyle = "#c62828"; ctx.fillRect(u.x + 10, popupY + 10, 80, 40);
                        ctx.fillStyle = "#fff"; ctx.fillText(`판매 ${unitDef.sellPrice}G`, u.x + 50, popupY + 30);
                    }
                }
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
            if (p.isHeal) {
                ctx.fillStyle = "#69f0ae";
                ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = "white"; ctx.font = "12px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("✚", p.x, p.y);
            } else {
                let pRadius = (p.effect === "crit") ? 8 : 5;
                ctx.arc(p.x, p.y, pRadius, 0, Math.PI * 2); ctx.fill();
            }
        });
    }

    if (draggingItem) { 
        let item = ITEM_DB[draggingItem.id]; 
        ctx.fillStyle = item.color; ctx.beginPath(); ctx.arc(draggingItem.x, draggingItem.y, 25, 0, Math.PI * 2); ctx.fill(); 
        ctx.fillStyle = "#000"; ctx.font = "20px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(item.symbol, draggingItem.x, draggingItem.y + 2); 
    }

    requestAnimationFrame(drawGameScreen);
}