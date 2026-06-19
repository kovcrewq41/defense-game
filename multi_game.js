const canvas = document.getElementById('gameCanvas'); 
const ctx = canvas.getContext('2d');
const logicalWidth = 720; const logicalHeight = 1280; 
const dpr = window.devicePixelRatio || 1;
canvas.width = logicalWidth * dpr; canvas.height = logicalHeight * dpr;
document.body.style.margin = "0"; document.body.style.overflow = "hidden"; document.body.style.backgroundColor = "#000";

function resizeCanvas() { 
    const windowRatio = window.innerWidth / window.innerHeight; const gameRatio = logicalWidth / logicalHeight; 
    if (windowRatio < gameRatio) { canvas.style.width = window.innerWidth + 'px'; canvas.style.height = (window.innerWidth / gameRatio) + 'px'; } 
    else { canvas.style.width = (window.innerHeight * gameRatio) + 'px'; canvas.style.height = window.innerHeight + 'px'; } 
    canvas.style.position = "absolute"; canvas.style.left = "50%"; canvas.style.top = "50%"; canvas.style.transform = "translate(-50%, -50%)"; canvas.style.zIndex = "1"; 
}
window.addEventListener('resize', resizeCanvas); resizeCanvas(); ctx.scale(dpr, dpr);

const centerX = logicalWidth / 2; const centerY = 550;
const socket = io(); window.serverGameSpeed = 1; 

let mySide = ""; let myGold = 0; let myInventory = []; 
let monsters = []; let units = []; let projectiles = []; let vfxList = []; 
let nexusHp = 10; let currentWave = 1; let maxWave = 20; let currentStage = 1; let countdown = 300; 
let waveState = 'SPAWNING'; let waveTimer = 0; let frameCount = 0;
let selectedUnit = null; let draggingUnit = null; let draggingItem = null; 
let activeSynergies = { SWORD: 0, ARCHER: 0, MAGE: 0, SHIELD: 0, GUNNER: 0, NINJA: 0 };
let isSynergyOpen = true; let mouseX = 0, mouseY = 0; let currentTooltip = ""; let screenShake = 0;

const IMAGE_CACHE = {}; 
function getSprite(src) { if (!src) return null; if (!IMAGE_CACHE[src]) { const img = new Image(); img.src = src; IMAGE_CACHE[src] = img; } return IMAGE_CACHE[src]; }
const SHEET_CACHE = { 
    "anim_chars_1.png": getSprite("anim_chars_1.png"), // 1성 (일반)
    "anim_chars_2.png": getSprite("anim_chars_2.png"), // 2성 (고급)
    "anim_chars_3.png": getSprite("anim_chars_3.png"), // 3성 (희귀)
    "anim_chars_4.png": getSprite("anim_chars_4.png"), // 4성 (전설)
    "anim_chars_5.png": getSprite("anim_chars_5.png"), // 5성 (히든)
    "monster_1.png": getSprite("monster_1.png"), 
    "boss_1.png": getSprite("boss_1.png"),
    "bg_1.png": getSprite("bg_1.png"),
    "bg_2.png": getSprite("bg_2.png"),
    "bg_3.png": getSprite("bg_3.png"),
    "bg_4.png": getSprite("bg_4.png"),
    // ★ 하드모드 에셋 3종 추가!
    "monster_hard_1.png": getSprite("monster_hard_1.png"),
    "boss_hard_1.png": getSprite("boss_hard_1.png"),
    "bg_hard_1.png": getSprite("bg_hard_1.png")
};

let PlayerProfile = { gold: 500, soulStones: 0, unlockedStage: 1, passives: { startGoldLvl: 0, attackBoostLvl: 0 }, mastery: { SWORD: 0, ARCHER: 0, MAGE: 0, SHIELD: 0, GUNNER: 0, NINJA: 0 }, relics: {}, unlockedHiddens: [] };
function loadGameData() { 
    const saved = localStorage.getItem('defenseSaveData'); 
    if (saved) { try { const parsed = JSON.parse(saved); if (parsed.soulStones !== undefined) PlayerProfile = Object.assign(PlayerProfile, parsed); } catch (e) { } } 
    updateLobbyProfile();
} 
function saveGameData() { localStorage.setItem('defenseSaveData', JSON.stringify(PlayerProfile)); updateLobbyProfile(); }
function updateLobbyProfile() {
    const elStones = document.getElementById('lobbySoulStones'); if(elStones) elStones.innerText = PlayerProfile.soulStones;
    const elRelics = document.getElementById('lobbyRelicsList');
    if(elRelics) {
        elRelics.innerHTML = ""; let hasRelic = false;
        for (const [rId, level] of Object.entries(PlayerProfile.relics)) {
            if (level > 0 && RELIC_DB[rId]) { hasRelic = true; elRelics.innerHTML += `<span class="relic-badge" style="border-color:${RELIC_DB[rId].color}">[Lv.${level}] ${RELIC_DB[rId].name}</span>`; }
        }
        if(!hasRelic) elRelics.innerHTML = "<span style='color:#777;'>보유한 유물이 없습니다.</span>";
    }
}
window.onload = () => { loadGameData(); };

let bgImage = new Image(); const TILE_SIZE = 80; const START_X = centerX - (9 * TILE_SIZE) / 2; const START_Y = centerY - (7 * TILE_SIZE) / 2;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const Sound = { play: (freq, type, duration, vol, freqSlide = 0) => { if (audioCtx.state === 'suspended') audioCtx.resume(); const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain(); osc.type = type; osc.connect(gain); gain.connect(audioCtx.destination); osc.frequency.setValueAtTime(freq, audioCtx.currentTime); if (freqSlide !== 0) osc.frequency.exponentialRampToValueAtTime(freqSlide, audioCtx.currentTime + duration); gain.gain.setValueAtTime(vol, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration); osc.start(); osc.stop(audioCtx.currentTime + duration); }, click: () => Sound.play(800, 'sine', 0.05, 0.03) };
const bgm = new Audio('bgm_1.mp3'); bgm.loop = true; bgm.volume = 0.3; 

const gameButtons = [
    new UIButton(40, 1120, 300, 60, "🎲 뽑기 (100G)", "#1565c0", () => { socket.emit('request_gacha'); }),
    new UIButton(380, 1120, 300, 60, "🏃 방 나가기", "#c62828", () => { if(confirm("방을 나가고 로비로 가시겠습니까?")) window.location.href = '/multi'; }),
    new UIButton(590, 20, 110, 45, "▶ 1배속", "#f57f17", () => { socket.emit('toggle_speed'); }),
    new UIButton(590, 75, 110, 45, "🔊 BGM", "#4CAF50", function() { if (bgm.paused) { bgm.play().catch(e=>e); this.color = "#4CAF50"; } else { bgm.pause(); this.color = "#555"; } }),
    new UIButton(40, 1190, 310, 60, "💣 전체폭격 (300G)", "#c62828", () => { socket.emit('use_active', 'BOMB'); }),
    new UIButton(370, 1190, 310, 60, "💖 넥서스수리 (500G)", "#2e7d32", () => { socket.emit('use_active', 'HEAL'); })
];

document.getElementById('btnRelicGacha')?.addEventListener('click', () => {
    // ★ 50 -> 100으로 상향
    if (PlayerProfile.soulStones >= 100) {
        PlayerProfile.soulStones -= 100; 
        let totalWeight = Object.values(RELIC_DB).reduce((sum, r) => sum + r.weight, 0); let rand = Math.random() * totalWeight; let pickedId = null;
        for (let [id, r] of Object.entries(RELIC_DB)) { if (rand < r.weight) { pickedId = id; break; } rand -= r.weight; }
        PlayerProfile.relics[pickedId] = (PlayerProfile.relics[pickedId] || 0) + 1; 
        saveGameData();
        
        // ★ alert 대신 새롭게 만든 팝업 함수 호출
        showGachaResult(RELIC_DB[pickedId]);
    } else { 
        alert("영혼석이 부족합니다! (필요: 100개)"); 
    }
});

// ★ 뽑기 연출을 위한 팝업 UI 생성 함수
function showGachaResult(relic) {
    // 동적 키프레임 (애니메이션) 추가
    if (!document.getElementById('gachaAnimStyles')) {
        let style = document.createElement('style');
        style.id = 'gachaAnimStyles';
        style.innerHTML = `
            @keyframes fadeInBg { from { opacity: 0; } to { opacity: 1; } }
            @keyframes popOut { 0% { transform: scale(0.5); opacity: 0; } 80% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
            @keyframes glowEffect { 0% { box-shadow: 0 0 10px ${relic.color}; } 50% { box-shadow: 0 0 30px ${relic.color}, 0 0 10px white; } 100% { box-shadow: 0 0 10px ${relic.color}; } }
        `;
        document.head.appendChild(style);
    }

    let overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background-color:rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index:9999; animation:fadeInBg 0.3s ease-in-out;';
    
    let box = document.createElement('div');
    box.style.cssText = `background:#222; border: 3px solid ${relic.color}; padding:40px; border-radius:15px; text-align:center; animation:popOut 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards, glowEffect 2s infinite alternate;`;
    
    box.innerHTML = `
        <div style="font-size:28px; color:#ffdd57; margin-bottom:15px; font-weight:bold;">✨ 유물 획득! ✨</div>
        <div style="font-size:36px; font-weight:900; color:${relic.color}; margin-bottom:15px;">[${relic.grade}급]</div>
        <div style="font-size:32px; font-weight:bold; color:#fff; margin-bottom:20px;">${relic.name}</div>
        <div style="font-size:16px; color:#ccc; margin-bottom:30px;">${relic.desc.replace("{val}", relic.baseVal)}</div>
        <button style="padding:12px 30px; font-size:18px; font-weight:bold; background:#4CAF50; border:none; border-radius:8px; color:#fff; cursor:pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.3);" onclick="this.parentElement.parentElement.remove()">확인</button>
    `;
    
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

document.getElementById('btnOpenCollection')?.addEventListener('click', () => {
    const cRelics = document.getElementById('collectionRelics'); const cUnits = document.getElementById('collectionUnits');
    cRelics.innerHTML = ""; cUnits.innerHTML = "";
    for (let [id, r] of Object.entries(RELIC_DB)) {
        let lvl = PlayerProfile.relics[id] || 0; let displayLvl = lvl > 0 ? lvl : 1; let currentVal = (r.baseVal * displayLvl).toFixed(1).replace(/\.0$/, ''); let descStr = r.desc.replace("{val}", currentVal);
        cRelics.innerHTML += `<div style="background:#111; padding:8px; border-radius:5px; border:1px solid ${r.color}; opacity:${lvl>0?1:0.4}"><div style="color:${r.color}; font-weight:bold;">[${r.grade}] ${r.name}</div><div style="font-size:12px; color:#aaa; margin-top:5px;">${descStr}</div><div style="font-size:12px; color:#fff; margin-top:5px;">현재 Lv.${lvl}</div></div>`;
    }
    for (let [id, u] of Object.entries(UNIT_DB)) {
        let isUnlockedHidden = PlayerProfile.unlockedHiddens && PlayerProfile.unlockedHiddens.includes(id); if (u.isHidden && !isUnlockedHidden) continue; 
        let skillHtml = ""; if (u.skillName) { skillHtml = `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #444;"><div style="color: #ffeb3b; font-size: 12px; font-weight: bold;">${u.skillName}</div><div style="color: #aaa; font-size: 11px; margin-top: 2px;">${u.skillDesc}</div></div>`; }
        let borderColor = u.isHidden ? '#ff9800' : '#555';
        cUnits.innerHTML += `<div style="background:#111; padding:8px; border-radius:5px; border:1px solid ${borderColor};"><div style="color:${u.color||'#fff'}; font-weight:bold;">${u.name} <span style="font-size:10px; color:#aaa;">(${u.trait})</span></div><div style="font-size:12px; color:#ccc; margin-top: 3px;">공:${u.damage} / 쿨:${u.cooldown} / 사거리:${u.range}</div>${skillHtml}</div>`;
    }
    document.getElementById('collectionModal').style.display = 'flex';
});

document.getElementById('btnDataManage')?.addEventListener('click', () => { document.getElementById('dataCode').value = ""; document.getElementById('dataModal').style.display = 'flex'; });
window.exportData = function() { let encoded = btoa(JSON.stringify(PlayerProfile)); document.getElementById('dataCode').value = encoded; alert("데이터 코드가 생성되었습니다. 복사해서 보관하세요!"); };
window.importData = function() {
    let code = document.getElementById('dataCode').value.trim(); if(code === "") return;
    try { let decoded = JSON.parse(atob(code)); if (decoded.soulStones !== undefined) { PlayerProfile = decoded; saveGameData(); alert("데이터 복구 성공!"); document.getElementById('dataModal').style.display = 'none'; } else { alert("유효하지 않은 코드입니다."); } } catch(e) { alert("유효하지 않은 코드입니다."); }
};
window.resetData = function() {
    if (confirm("⚠️ 경고 ⚠️\n\n정말 모든 데이터를 초기화하시겠습니까?")) { localStorage.removeItem('defenseSaveData'); PlayerProfile = { gold: 500, soulStones: 0, unlockedStage: 1, passives: { startGoldLvl: 0, attackBoostLvl: 0 }, mastery: { SWORD: 0, ARCHER: 0, MAGE: 0, SHIELD: 0, GUNNER: 0, NINJA: 0 }, relics: {}, unlockedHiddens: [] }; alert("데이터가 완전히 초기화되었습니다."); window.location.reload(); }
};

const stageSelect = document.getElementById('stageSelect');
if(stageSelect) {
    stageSelect.addEventListener('change', (e) => {
        const stageId = e.target.value;
        const def = STAGE_DB[stageId];
        if (def) {
            document.getElementById('infoTitle').innerText = def.name;
            document.getElementById('infoDesc').innerText = def.desc;
            if(document.getElementById('infoMonster') && def.monster) document.getElementById('infoMonster').innerText = `👾 등장 몬스터: ${def.monster}`;
            document.getElementById('infoReward').innerText = `🎁 클리어 보상: 영혼석 ${def.multiRewardMult}배 획득 (멀티 코옵)`;

            const infoPanel = document.getElementById('stageInfoPanel');
            if (stageId == 5) {
                infoPanel.style.border = "2px solid #ff5252";
                infoPanel.style.boxShadow = "inset 0 0 15px rgba(255, 82, 82, 0.3)";
                document.getElementById('infoTitle').style.color = "#ff5252";
                document.getElementById('infoDesc').innerHTML = `<span style="color:#ff5252; font-weight:bold;">⚠️ 경고: 물리/마법 내성 몬스터가 등장하며, 보스는 상태이상에 면역입니다!</span><br><br>${def.desc}`;
            } else {
                infoPanel.style.border = "1px solid #444";
                infoPanel.style.boxShadow = "inset 0 0 10px rgba(0,0,0,0.5)";
                document.getElementById('infoTitle').style.color = "#4fc3f7";
            }
        }
    });
}

// ★ 멀티플레이 시작 및 렌더링 루프 실행
const joinBtn = document.getElementById('joinBtn');
if(joinBtn) {
    joinBtn.addEventListener('click', () => {
        let roomCode = document.getElementById('roomInput').value; if (!roomCode || roomCode.trim() === "") roomCode = "1234";
        let selStage = document.getElementById('stageSelect').value || "1"; currentStage = parseInt(selStage);
        
        document.getElementById('lobby').style.display = 'none'; 
        document.getElementById('gameContainer').style.display = 'block'; 
        resizeCanvas();
        if (audioCtx.state === 'suspended') audioCtx.resume(); 
        bgm.play().catch(e => e);
        
        socket.emit('join_room', { roomCode: roomCode, stage: currentStage, profile: PlayerProfile });
        
        // ★ 블랙스크린의 원인! 렌더링 루프를 여기서 실행시킵니다.
        requestAnimationFrame(gameLoop);
    });
}

const LAB_UPGRADES = { SWORD: { name: "⚔️ 검사 훈련", desc: "검사 유닛 데미지 10% 증가" }, ARCHER: { name: "🏹 궁수 훈련", desc: "궁수 유닛 데미지 10% 증가" }, MAGE: { name: "🪄 마법사 훈련", desc: "마법사 유닛 데미지 10% 증가" }, SHIELD: { name: "🛡️ 방패병 훈련", desc: "방패병 유닛 데미지 10% 증가" }, GUNNER: { name: "🔫 총잡이 훈련", desc: "총잡이 유닛 데미지 10% 증가" }, NINJA: { name: "🥷 닌자 훈련", desc: "닌자 유닛 데미지 10% 증가" } };
const HIDDEN_UNLOCKS = [ { id: "SWORD_5", name: "🗡️ 빛의 심판관" }, { id: "ARCHER_5", name: "🏹 엘프 왕" }, { id: "MAGE_5", name: "🔮 절대자" }, { id: "SHIELD_5", name: "🛡️ 아이기스" }, { id: "GUNNER_5", name: "🚀 헤비 디스트로이어" }, { id: "NINJA_5", name: "🥷 아수라" } ];

const btnOpenLab = document.getElementById('btnOpenLab');
function renderLab() {
    let profile = PlayerProfile; if (!profile.unlockedHiddens) profile.unlockedHiddens = []; const labList = document.getElementById('labList');
    if (labList) {
        labList.style.display = "block"; 
        labList.innerHTML = `<div style="font-weight:bold; color:#69f0ae; margin-bottom:10px; font-size:18px;">💪 기본 마스터리 (영구 스탯)</div><div id="masteryGrid" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom: 20px;"></div><div style="font-weight:bold; color:#ffeb3b; margin-bottom:10px; font-size:18px;">🌟 히든 영웅 해금 (각 50 영혼석)</div><div id="hiddenGrid" style="display:grid; grid-template-columns:1fr 1fr; gap:10px;"></div>`;
        let mGrid = document.getElementById('masteryGrid');
        for (const [key, info] of Object.entries(LAB_UPGRADES)) {
            let currentLvl = profile.mastery[key] || 0; let cost = (currentLvl + 1) * 10; let isMax = currentLvl >= 10; let btnBg = isMax ? '#555' : (profile.soulStones >= cost ? '#4CAF50' : '#d32f2f');
            mGrid.innerHTML += `<div style="background:#333; padding:10px; border-radius:8px; border:1px solid #555;"><div style="font-weight:bold; font-size:14px; color:#fff;">${info.name} <span style="color:#69f0ae;">(Lv.${currentLvl})</span></div><button onclick="upgradeMastery('${key}')" style="margin-top:5px; width:100%; padding:5px; border:none; border-radius:5px; cursor:pointer; font-weight:bold; background:${btnBg}; color:white;">${isMax ? "MAX" : `강화 (${cost}석)`}</button></div>`;
        }
        let hGrid = document.getElementById('hiddenGrid');
        HIDDEN_UNLOCKS.forEach(h => {
            let isUnlocked = profile.unlockedHiddens.includes(h.id); let btnBg = isUnlocked ? '#1565c0' : (profile.soulStones >= 50 ? '#ff9800' : '#d32f2f');
            hGrid.innerHTML += `<div style="background:#333; padding:10px; border-radius:8px; border:1px solid #555;"><div style="font-weight:bold; font-size:14px; color:#fff;">${h.name}</div><button onclick="unlockHidden('${h.id}')" style="margin-top:5px; width:100%; padding:5px; border:none; border-radius:5px; cursor:pointer; font-weight:bold; background:${btnBg}; color:white;">${isUnlocked ? "✅ 해금 완료" : "잠금 해제 (50석)"}</button></div>`;
        });
    }
}
window.upgradeMastery = function(traitKey) { let currentLvl = PlayerProfile.mastery[traitKey] || 0; let cost = (currentLvl + 1) * 10; if (currentLvl >= 10) { alert("이미 최대 레벨입니다!"); return; } if (PlayerProfile.soulStones >= cost) { PlayerProfile.soulStones -= cost; PlayerProfile.mastery[traitKey] = currentLvl + 1; saveGameData(); renderLab(); } else { alert("영혼석이 부족합니다!"); } }
window.unlockHidden = function(hiddenId) { if (!PlayerProfile.unlockedHiddens) PlayerProfile.unlockedHiddens = []; if (PlayerProfile.unlockedHiddens.includes(hiddenId)) { alert("이미 해금된 영웅입니다!"); return; } if (PlayerProfile.soulStones >= 50) { PlayerProfile.soulStones -= 50; PlayerProfile.unlockedHiddens.push(hiddenId); saveGameData(); renderLab(); alert("히든 영웅이 해금되었습니다!"); } else { alert("영혼석이 부족합니다!"); } }
if(btnOpenLab) btnOpenLab.addEventListener('click', () => { renderLab(); document.getElementById('labModal').style.display = 'flex'; });

// ==========================================
// ★ 누락된 UI 버튼 클릭 이벤트 완벽 연결 ★
// ==========================================

// 1. 로비에서 '메인으로' 돌아가기 (싱글플레이 화면으로 이동)
document.getElementById('backBtn')?.addEventListener('click', () => {
    window.location.href = '/'; 
});

// 2. 클래스 연구소 '닫기' 버튼 먹통 해결
document.getElementById('btnCloseLab')?.addEventListener('click', () => {
    document.getElementById('labModal').style.display = 'none';
});

// 3. 게임 오버/클리어 후 '로비로 돌아가기' 버튼 먹통 해결
// (완벽한 초기화를 위해 페이지 새로고침 방식으로 적용)
document.getElementById('btnGoLobby')?.addEventListener('click', () => {
    window.location.reload(); 
});

function spawnVFX(type, x, y, opts = {}) {
    vfxList.push({ type: type, x: x, y: y, life: opts.life || 20, maxLife: opts.life || 20, ...opts });
}

socket.on('show_msg', (data) => { addFloatingText(data.msg, centerX, centerY, data.color || "#ffea00"); });
socket.on('assign_side', (side) => { mySide = side; addFloatingText(`당신은 [${side === 'left' ? '1P' : '2P'}] 진영입니다!`, centerX, centerY, "#69f0ae"); });
socket.on('game_state', (state) => {
    nexusHp = state.nexusHp; currentWave = state.currentWave; maxWave = state.maxWave; currentStage = state.stage; countdown = state.countdown; waveState = state.waveState; waveTimer = state.waveTimer; frameCount = state.frameCount;
    window.serverGameSpeed = state.gameSpeed || 1; window.currentStats = state.stats; 
    let me = state.players.find(p => p.id === socket.id); if (me) { myGold = me.gold; myInventory = me.inventory; }
    units = state.units; if (selectedUnit) selectedUnit = units.find(u => u.id === selectedUnit.id) || null; if (draggingUnit) draggingUnit = units.find(u => u.id === draggingUnit.id) || null;
    activeSynergies = { SWORD: 0, ARCHER: 0, MAGE: 0, SHIELD: 0, GUNNER: 0, NINJA: 0 };
    let myUnits = units.filter(u => u.side === mySide); const uniqueTypes = [...new Set(myUnits.map(u => u.type))]; uniqueTypes.forEach(t => { const uDef = UNIT_DB[t]; if (uDef && uDef.trait) activeSynergies[uDef.trait]++; });
    
    let serverMonsterIds = new Set(state.monsters.map(m => m.id));
    state.monsters.forEach(serverM => { let localM = monsters.find(m => m.id === serverM.id); if (localM) { localM.targetX = serverM.x; localM.targetY = serverM.y; localM.hp = serverM.hp; localM.maxHp = serverM.maxHp; localM.stunTimer = serverM.stunTimer; localM.animOffset = serverM.animOffset; } else { serverM.targetX = serverM.x; serverM.targetY = serverM.y; monsters.push(serverM); } });
    monsters = monsters.filter(localM => serverMonsterIds.has(localM.id));
    
    let serverProjIds = new Set(state.projectiles.map(p => p.id));
    state.projectiles.forEach(serverP => { let localP = projectiles.find(p => p.id === serverP.id); if (localP) { localP.targetX = serverP.x; localP.targetY = serverP.y; } else { serverP.targetX = serverP.x; serverP.targetY = serverP.y; projectiles.push(serverP); } });
    projectiles = projectiles.filter(localP => serverProjIds.has(localP.id));
});
socket.on('game_over', (stats) => { 
    document.getElementById('gameOverOverlay').style.display = 'flex'; document.getElementById('goKills').innerText = stats.kills; document.getElementById('goWave').innerText = currentWave; document.getElementById('goGold').innerText = Math.floor(myGold); updateDamageMeter(stats); 
    let safeMult = STAGE_DB[currentStage]?.multiRewardMult || 1.0; let baseReward = ((currentWave - 1) * 2) + (Math.floor((currentWave - 1) / 5) * 20); let earnedStones = Math.floor(baseReward * safeMult) || 0; PlayerProfile.soulStones += earnedStones; saveGameData(); 
    let goStones = document.getElementById('goStones'); if (goStones) goStones.innerText = earnedStones;
});
socket.on('game_clear', (data) => { 
    document.getElementById('gameOverOverlay').style.display = 'flex'; document.querySelector('.go-title').innerText = "STAGE CLEAR!"; document.querySelector('.go-title').style.color = "#69f0ae"; document.getElementById('goKills').innerText = data.stats.kills; document.getElementById('goWave').innerText = currentWave; document.getElementById('goGold').innerText = Math.floor(myGold); updateDamageMeter(data.stats); 
    let safeMult = STAGE_DB[currentStage]?.multiRewardMult || 1.0; let baseReward = (currentWave * 2) + (Math.floor(currentWave / 5) * 20) + 100; let earnedStones = Math.floor(baseReward * safeMult) || 0; PlayerProfile.soulStones += earnedStones; if (PlayerProfile.unlockedStage === currentStage && PlayerProfile.unlockedStage < Object.keys(STAGE_DB).length) PlayerProfile.unlockedStage++; saveGameData(); 
    let goStones = document.getElementById('goStones'); if (goStones) goStones.innerText = earnedStones;
});
socket.on('boss_spawned', () => { screenShake = 30; addFloatingText("⚠️ 보스 몬스터 등장!", centerX, centerY - 100, "#ff5252"); });

function getPointerPos(event) { const rect = canvas.getBoundingClientRect(); const clientX = event.touches ? event.touches[0].clientX : event.clientX; const clientY = event.touches ? event.touches[0].clientY : event.clientY; return { x: (clientX - rect.left) * (logicalWidth / rect.width), y: (clientY - rect.top) * (logicalHeight / rect.height) }; }

canvas.addEventListener('mousedown', (e) => {
    if (audioCtx.state === 'suspended') { audioCtx.resume(); } const pos = getPointerPos(e);

    // ★ 1. 몬스터 클릭 여부 먼저 확인
    let clickedMonster = null;
    for (let m of monsters) {
        let dist = Math.hypot(m.x - pos.x, m.y - pos.y);
        if (dist <= m.radius * 1.5) { // 터치하기 쉽게 판정을 살짝 넓게 줌
            clickedMonster = m;
            break;
        }
    }

    if (clickedMonster) {
        window.selectedMonster = clickedMonster; // 몬스터 선택됨!
        selectedUnit = null; // 유닛 선택은 해제
        return; // 여기서 클릭 종료
    } else {
        window.selectedMonster = null; // 허공 클릭 시 몬스터 정보창 닫기
    }

    if (pos.x >= 10 && pos.x <= 90 && pos.y >= 100 && pos.y <= 130) { isSynergyOpen = !isSynergyOpen; return; }
    if (selectedUnit && draggingUnit === null) {
        const unitDef = UNIT_DB[selectedUnit.type]; if (!unitDef) return;
        if (pos.x >= 10 && pos.x <= 710 && pos.y >= 850 && pos.y <= 990) {
            if (pos.x >= 590 && pos.x <= 690) { Sound.click(); socket.emit('sell_unit', { id: selectedUnit.id }); selectedUnit = null; return; }
            if (unitDef.next) {
                if (Array.isArray(unitDef.next)) { if (pos.x >= 450 && pos.x <= 580) { Sound.click(); socket.emit('upgrade_unit', { id: selectedUnit.id, next: unitDef.next[1] }); selectedUnit = null; return; } if (pos.x >= 310 && pos.x <= 440) { Sound.click(); socket.emit('upgrade_unit', { id: selectedUnit.id, next: unitDef.next[0] }); selectedUnit = null; return; } } else { if (pos.x >= 450 && pos.x <= 580) { Sound.click(); socket.emit('upgrade_unit', { id: selectedUnit.id, next: unitDef.next }); selectedUnit = null; return; } }
            } return; 
        } selectedUnit = null; 
    }
    gameButtons.forEach(b => { if (b.isClicked(pos.x, pos.y)) { Sound.click(); b.onClick(); } });
    for (let i = 0; i < 5; i++) { let ix = 135 + i * 90; let iy = 1030; if (pos.x >= ix && pos.x <= ix + 70 && pos.y >= iy && pos.y <= iy + 70) { if (myInventory[i]) { draggingItem = { index: i, id: myInventory[i], x: pos.x, y: pos.y }; selectedUnit = null; return; } } }
    let hit = null; for (let u of units) { if (u.side === mySide) { let dist = Math.hypot(u.x - pos.x, u.y - pos.y); if (dist <= 35) { hit = u; break; } } } if (hit) { draggingUnit = hit; selectedUnit = hit; } else { selectedUnit = null; }
});
canvas.addEventListener('mousemove', (e) => {
    const pos = getPointerPos(e); mouseX = pos.x; mouseY = pos.y; currentTooltip = "";
    for (let i = 0; i < 5; i++) { let ix = 135 + i * 90; let iy = 1030; if (mouseX >= ix && mouseX <= ix + 70 && mouseY >= iy && mouseY <= iy + 70) { if (myInventory[i]) { let itm = ITEM_DB[myInventory[i]]; let effStr = itm.type === 'dmg' ? `공격력 ${Math.round((itm.value-1)*100)}% 증가` : itm.type === 'spd' ? `공격속도 ${Math.round((1-itm.value)*100)}% 증가` : `사거리 +${itm.value}`; currentTooltip = `[${itm.name}] ${effStr}`; } } }
    if (draggingItem) { draggingItem.x = pos.x; draggingItem.y = pos.y; } if (draggingUnit) { draggingUnit.x = pos.x; draggingUnit.y = pos.y; }
});
canvas.addEventListener('mouseup', (e) => {
    const pos = getPointerPos(e);
    if (draggingItem) { let targetUnit = null; for (let u of units) { if (u.side === mySide && Math.hypot(u.x - draggingItem.x, u.y - draggingItem.y) <= 35) { targetUnit = u; break; } } if (targetUnit) { if (!targetUnit.items) targetUnit.items = []; if (targetUnit.items.length < 3) { Sound.click(); socket.emit('equip_item', { unitId: targetUnit.id, itemIndex: draggingItem.index }); } else { addFloatingText("아이템은 최대 3개까지만 가능합니다!", centerX, centerY, "#ff5252"); } } draggingItem = null; return; }
    if (draggingUnit) { const col = Math.floor((pos.x - START_X) / TILE_SIZE); const row = Math.floor((pos.y - START_Y) / TILE_SIZE); let allowedCols = mySide === "left" ? [1, 2, 3] : [5, 6, 7]; if (row >= 1 && row <= 5 && allowedCols.includes(col)) { socket.emit('move_unit', { id: draggingUnit.id, gridX: col, gridY: row }); } draggingUnit = null; }
});
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); if (e.touches.length > 0) canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY })); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); if (e.touches.length > 0) canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY })); }, { passive: false });
canvas.addEventListener('touchend', (e) => { e.preventDefault(); if (e.changedTouches && e.changedTouches.length > 0) canvas.dispatchEvent(new MouseEvent('mouseup', { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY })); else canvas.dispatchEvent(new MouseEvent('mouseup', {})); }, { passive: false });

// ★ 렌더링 루프 전용 함수 (싱글플레이 로직 없음!)
function gameLoop() {
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    let speedBtn = gameButtons[2]; if (speedBtn) { speedBtn.text = window.serverGameSpeed === 2 ? "▶▶ 2배속" : "▶ 1배속"; speedBtn.color = window.serverGameSpeed === 2 ? "#d84315" : "#f57f17"; }

    let stageDef = STAGE_DB[currentStage] || {};

    // ★ DB에 bgSrc가 명시되어 있으면 그걸 쓰고, 없으면 `bg_스테이지번호.png`를 자동으로 찾습니다.
    let targetBg = stageDef.bgSrc || `bg_${currentStage}.png`;

    // 이미지 로딩이 완료되었는지 꼼꼼하게 체크 후 그리기
    if (SHEET_CACHE[targetBg] && SHEET_CACHE[targetBg].complete && SHEET_CACHE[targetBg].naturalWidth > 0) {
        ctx.drawImage(SHEET_CACHE[targetBg], 0, 0, logicalWidth, logicalHeight);
    } else {
        // 혹시라도 이미지가 없거나 로딩 전이면 기본 어두운 배경을 깝니다
        ctx.fillStyle = "#1a1a1a"; ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    }

    for (let r = 0; r < 7; r++) { for (let c = 0; c < 9; c++) { if (r === 0 || r === 6 || c === 0 || c === 8) { ctx.fillStyle = "rgba(0, 0, 0, 0.4)"; } else if (c === 4) { ctx.fillStyle = "rgba(0, 0, 0, 0.8)"; } else { ctx.fillStyle = "rgba(255, 255, 255, 0.1)"; } ctx.fillRect(START_X + c * TILE_SIZE, START_Y + r * TILE_SIZE, TILE_SIZE, TILE_SIZE); ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1; ctx.strokeRect(START_X + c * TILE_SIZE, START_Y + r * TILE_SIZE, TILE_SIZE, TILE_SIZE); } }
    
    ctx.save(); if (screenShake > 0) { ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake); screenShake *= 0.9; if (screenShake < 0.5) screenShake = 0; }
    
    let nexusX = START_X + 4 * TILE_SIZE + TILE_SIZE / 2; let nexusY = START_Y + 6 * TILE_SIZE + TILE_SIZE / 2;
    ctx.fillStyle = "#0288d1"; ctx.beginPath(); ctx.arc(nexusX, nexusY, 30, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "bold 20px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText(`HP ${nexusHp}`, nexusX, nexusY + 7);
    if (countdown > 0) { ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(0, 0, logicalWidth, logicalHeight); ctx.fillStyle = "#ffdd57"; ctx.font = "bold 65px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText(`전투 시작 ${Math.ceil(countdown / 60)}초 전!`, centerX, centerY - 60); ctx.fillStyle = "#fff"; ctx.font = "22px Malgun Gothic"; ctx.fillText("아내분과 전술 대화를 나누며 유닛을 뽑아두세요!", centerX, centerY + 20); }
    
    monsters.forEach(m => {
        if (m.targetX !== undefined) { m.x += (m.targetX - m.x) * 0.4; } if (m.targetY !== undefined) { m.y += (m.targetY - m.y) * 0.4; }
        const drawSize = m.isBoss ? 120 : (m.radius * 3.5); ctx.save(); if (m.stunTimer > 0) { ctx.filter = 'grayscale(100%)'; } else if (m.type === "FIRE" && !m.isBoss) { ctx.filter = 'sepia(100%) saturate(300%) hue-rotate(-50deg)'; }
        
        // ★ 일반 몬스터도 서버가 보내준 sheetSrc를 사용하도록 변경!
        const targetSheetKey = m.sheetSrc || (m.isBoss ? "boss_1.png" : "monster_1.png"); 
        const sheet = SHEET_CACHE[targetSheetKey];

        if (m.isBoss) {
            const bossOffsetY = 30; 
            if (sheet && sheet.complete && sheet.naturalWidth > 0) {
                const cols = 4; const rows = 4; const sw = sheet.naturalWidth / cols; const sh = sheet.naturalHeight / rows;
                let colIdx = Math.floor(frameCount / 15 + (m.animOffset||0)) % cols;
                let useRow = m.sheetRow !== undefined ? m.sheetRow : 0;
                ctx.drawImage(sheet, colIdx * sw, useRow * sh, sw, sh, m.x - drawSize / 2, m.y - drawSize / 2 - bossOffsetY, drawSize, drawSize);
            } else {
                ctx.beginPath(); ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2); ctx.fillStyle = m.isFinalBoss ? "#ff00ff" : "#ffd700"; ctx.fill();
            }
            ctx.fillStyle = "#fff"; ctx.font = "bold 13px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText(m.isFinalBoss ? "FINAL BOSS" : "BOSS", m.x, m.y - drawSize/2 - bossOffsetY - 5);
        } else {
            if (sheet && sheet.complete && sheet.naturalWidth > 0) {
                const cols = 4; const rows = (targetSheetKey === 'monster_1.png') ? 6 : 4; 
                const sw = sheet.naturalWidth / cols; const sh = sheet.naturalHeight / rows; let colIdx = Math.floor(frameCount / 15 + m.animOffset) % cols; const sx = colIdx * sw; const sy = m.sheetRow * sh; const dx = m.x - drawSize / 2; const dy = m.y - drawSize / 2 - 5; ctx.drawImage(sheet, sx, sy, sw, sh, dx, dy, drawSize, drawSize); 
            } else { ctx.beginPath(); ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2); ctx.fillStyle = "#d32f2f"; ctx.fill(); } 
        }
        ctx.restore();
        let hpBarY = m.y - (m.isBoss ? (drawSize/2 - 10) : 25); ctx.fillStyle = "black"; ctx.fillRect(m.x - 20, hpBarY, 40, 5); ctx.fillStyle = "#00e676"; ctx.fillRect(m.x - 20, hpBarY, 40 * (m.hp / m.maxHp), 5);
        if (m.poisonTimer > 0) { ctx.fillStyle = "#69f0ae"; ctx.font = "12px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText("☠️독", m.x, hpBarY - 10); }
    });
    
    projectiles.forEach(p => {
        if (p.targetX !== undefined) { p.x += (p.targetX - p.x) * 0.4; } if (p.targetY !== undefined) { p.y += (p.targetY - p.y) * 0.4; }
        ctx.fillStyle = p.color || "#ffea00"; ctx.save(); ctx.translate(p.x, p.y);
        if (p.style === "meteor") { ctx.fillStyle = "rgba(255, 61, 0, 0.5)"; ctx.beginPath(); ctx.arc(0, 0, 35, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#ffdd57"; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill(); } 
        else { if (p.style === "spin_sword") { ctx.rotate(frameCount * 0.3); ctx.fillRect(-10, -2, 20, 4); ctx.fillRect(-2, -10, 4, 20); } else if (p.style === "blood_slash" || p.style === "light_beam") { ctx.fillRect(-10, -2, 20, 4); } else if (p.style === "heavy_arrow" || p.style === "sniper_bullet") { ctx.fillRect(-15, -2, 30, 4); } else { ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); } } ctx.restore();
    });

    units.forEach(u => {
        const uDef = UNIT_DB[u.type]; if (!uDef) return; const sheet = SHEET_CACHE[uDef.sheetSrc];
        if (uDef.skill && uDef.skill.type.startsWith('aura_buff')) { ctx.strokeStyle = "rgba(255, 235, 59, 0.15)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(u.x, u.y, uDef.skill.radius + (Math.sin(frameCount*0.1)*5), 0, Math.PI * 2); ctx.stroke(); }
        if (draggingUnit && draggingUnit.id === u.id) { ctx.save(); ctx.globalAlpha = 0.6; }
        if (sheet && sheet.complete && sheet.naturalWidth > 0) { const cols = 4; const rows = 6; const sw = sheet.naturalWidth / cols; const sh = sheet.naturalHeight / rows; let colIdx = 0; if (u.attackAnimTimer > 13) colIdx = 1; else if (u.attackAnimTimer > 6) colIdx = 2; else if (u.attackAnimTimer > 0) colIdx = 3; ctx.drawImage(sheet, colIdx * sw, uDef.sheetRow * sh, sw, sh, u.x - 40, u.y - 40, 80, 80); } else { ctx.fillStyle = uDef.color || "#fff"; ctx.beginPath(); ctx.arc(u.x, u.y, 25, 0, Math.PI * 2); ctx.fill(); }
        if (u.items && u.items.length > 0) { let startX = u.x - (u.items.length * 14) / 2 + 7; for (let i = 0; i < u.items.length; i++) { let itemDef = ITEM_DB[u.items[i]]; if (itemDef) { ctx.fillStyle = itemDef.color; ctx.fillRect(startX + i * 14 - 5, u.y + 48, 10, 10); } } }
        if (draggingUnit && draggingUnit.id === u.id) ctx.restore();
        if (selectedUnit && selectedUnit.id === u.id) { ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(u.x, u.y, uDef.range, 0, Math.PI * 2); ctx.stroke(); }
    });

    vfxList.forEach((v, i) => {
        v.life--; let p = 1 - (v.life / v.maxLife); 
        ctx.save();
        if (v.type === 'explosion') { ctx.globalAlpha = 1 - p; ctx.fillStyle = v.color; ctx.beginPath(); ctx.arc(v.x, v.y, v.radius * p, 0, Math.PI*2); ctx.fill(); } 
        else if (v.type === 'slash') { ctx.globalAlpha = 1 - p; ctx.strokeStyle = v.color; ctx.lineWidth = 10 * (1 - p); ctx.beginPath(); ctx.moveTo(v.x - 80, v.y - 80); ctx.lineTo(v.x + 80, v.y + 80); ctx.stroke(); } 
        else if (v.type === 'execute') { ctx.globalAlpha = 1 - p; ctx.strokeStyle = v.color; ctx.lineWidth = 15 * (1 - p); ctx.beginPath(); ctx.moveTo(v.x - 50, v.y - 50); ctx.lineTo(v.x + 50, v.y + 50); ctx.moveTo(v.x + 50, v.y - 50); ctx.lineTo(v.x - 50, v.y + 50); ctx.stroke(); } 
        else if (v.type === 'ice') { ctx.globalAlpha = 1 - p; ctx.fillStyle = v.color || "#40c4ff"; ctx.fillRect(v.x - 30 - p*20, v.y - 30 - p*20, 60 + p*40, 60 + p*40); } 
        else if (v.type === 'hit') { ctx.globalAlpha = 1 - p; ctx.fillStyle = v.color; ctx.beginPath(); ctx.arc(v.x, v.y, v.radius * Math.sin(p*Math.PI), 0, Math.PI*2); ctx.fill(); } 
        else if (v.type === 'flash') { ctx.globalAlpha = (1 - p) * 0.5; ctx.fillStyle = v.color; ctx.fillRect(0, 0, logicalWidth, logicalHeight); }
        ctx.restore();
    });
    vfxList = vfxList.filter(v => v.life > 0);

    ctx.restore(); 
    ctx.fillStyle = "#ffdd57"; ctx.font = "bold 26px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText(`보유 골드: ${Math.floor(myGold)} G  |  진영: ${mySide === 'left' ? '1P (좌)' : '2P (우)'}`, centerX, 80);
    const stName = STAGE_DB[currentStage] ? STAGE_DB[currentStage].name : `스테이지 ${currentStage}`; ctx.fillStyle = "#fff"; ctx.font = "bold 20px Malgun Gothic"; ctx.fillText(`${stName} - 웨이브 ${currentWave} / ${maxWave}`, centerX, 40);
    ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.fillRect(10, 100, 80, 30); ctx.fillStyle = "#fff"; ctx.font = "bold 14px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText(isSynergyOpen ? "▲ 시너지" : "▼ 시너지", 50, 120);
    if (isSynergyOpen) { ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; ctx.beginPath(); ctx.roundRect(10, 135, 700, 60, 10); ctx.fill(); let sIdx = 0; const sNames = { SWORD: "검사", ARCHER: "궁수", MAGE: "마법사", SHIELD: "방패병", NINJA: "닌자", GUNNER: "총잡이" }; for (const [trait, count] of Object.entries(activeSynergies)) { if (count > 0) { let dx = 30 + (sIdx % 4) * 170; let dy = 160 + (sIdx >= 4 ? 25 : 0); ctx.fillStyle = count >= 3 ? "#ffca28" : "#aaa"; ctx.font = count >= 3 ? "bold 15px Malgun Gothic" : "15px Malgun Gothic"; ctx.textAlign = "left"; ctx.fillText(`${sNames[trait]} (${count}/3)`, dx, dy); sIdx++; } } }
    if (waveState === 'COUNTDOWN') { ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 200, logicalWidth, 60); ctx.fillStyle = "#69f0ae"; ctx.font = "bold 24px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText(`다음 웨이브 정비까지 ${Math.ceil(waveTimer / 60)}초!`, centerX, 238); }
    ctx.fillStyle = "#222"; ctx.fillRect(0, 990, logicalWidth, 290); ctx.fillStyle = "#aaa"; ctx.font = "bold 19px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText("📦 내 멀티플레이 아이템함 (보스 처치 시 공유 획득)", centerX, 1010);
    for (let i = 0; i < 5; i++) { let ix = 135 + i * 90; let iy = 1030; ctx.fillStyle = "#333"; ctx.fillRect(ix, iy, 70, 70); ctx.strokeStyle = "#555"; ctx.lineWidth = 2; ctx.strokeRect(ix, iy, 70, 70); if (myInventory[i] && (!draggingItem || draggingItem.index !== i)) { let item = ITEM_DB[myInventory[i]]; if (item) { ctx.fillStyle = item.color; ctx.beginPath(); ctx.arc(ix + 35, iy + 35, 25, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#000"; ctx.font = "20px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(item.symbol, ix + 35, iy + 37); } } }
    if (draggingItem) { let item = ITEM_DB[draggingItem.id]; if (item) { ctx.fillStyle = item.color; ctx.beginPath(); ctx.arc(draggingItem.x, draggingItem.y, 25, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#000"; ctx.font = "20px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(item.symbol, draggingItem.x, draggingItem.y + 2); } }
    drawFixedUnitPanel(ctx, selectedUnit, UNIT_DB, ITEM_DB, mySide, PlayerProfile, activeSynergies, myGold);

    // ★ 몬스터 정보 툴팁 UI (유닛 정보창과 동일한 위치에 표시)
    if (window.selectedMonster) {
        let m = window.selectedMonster;
        let mName = m.isBoss ? "보스 몬스터" : "일반 몬스터";
        if (m.mutantType === "FAST") mName = "빠른 돌연변이";
        if (m.mutantType === "TANK") mName = "거대 돌연변이";

        // 검은 반투명 배경 & 붉은 테두리
        ctx.fillStyle = "rgba(0, 0, 0, 0.85)"; ctx.fillRect(10, 850, 700, 140);
        ctx.strokeStyle = "#ff5252"; ctx.lineWidth = 2; ctx.strokeRect(10, 850, 700, 140);

        // 이름 및 체력 바
        ctx.fillStyle = "#ff5252"; ctx.font = "bold 22px Malgun Gothic"; ctx.textAlign = "left"; 
        ctx.fillText(`[${mName}]`, 30, 890);

        ctx.fillStyle = "white"; ctx.font = "16px Malgun Gothic";
        ctx.fillText(`체력: ${Math.floor(m.hp)} / ${Math.floor(m.maxHp)}`, 30, 925);
        ctx.fillText(`이동 속도: ${m.speed.toFixed(1)}`, 30, 955);

        // 내성 및 특성 표시
        let resText = "없음 (일반 속성)"; let resColor = "#ccc";
        if (m.resistType === "PHYSICAL") { resText = "🛡️ 물리 내성 (물리피해 50% 반감)"; resColor = "#ff8a65"; }
        else if (m.resistType === "MAGIC") { resText = "🔮 마법 내성 (마법피해 50% 반감)"; resColor = "#b388ff"; }

        ctx.fillStyle = "#aaa"; ctx.fillText(`방어 특성:`, 250, 925);
        ctx.fillStyle = resColor; ctx.font = "bold 16px Malgun Gothic"; ctx.fillText(`${resText}`, 330, 925);

        if (m.isBoss && m.ccImmune) {
            ctx.fillStyle = "#ffeb3b"; ctx.fillText(`⚠️ 상태이상(CC기) 완전 면역`, 250, 955);
        }
    }
    gameButtons.forEach(btn => btn.draw(ctx)); drawTooltip(ctx, currentTooltip, mouseX, mouseY); renderFloatingTexts(ctx); 
    
    // ★ 렌더링 무한 반복
    requestAnimationFrame(gameLoop);
}