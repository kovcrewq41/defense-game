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
let isGameRunning = false; let gameSpeed = 1;
let mySide = "single"; let myGold = 0; let myInventory = []; 
let monsters = []; let units = []; let projectiles = []; 

// ★ 신규: VFX(시각 효과) 엔진 배열
let vfxList = []; 

let nexusHp = 10; let currentWave = 1; let maxWave = 20; let currentStage = 1; let countdown = 180; 
let waveState = 'SPAWNING'; let waveTimer = 0; let frameCount = 0;
let stats = { kills: 0, p1Damage: 0, p2Damage: 0 }; let monstersSpawnedThisWave = 0;
let selectedUnit = null; let draggingUnit = null; let draggingItem = null; 
let activeSynergies = { SWORD: 0, ARCHER: 0, MAGE: 0, SHIELD: 0, GUNNER: 0, NINJA: 0 };
let isSynergyOpen = true; let mouseX = 0, mouseY = 0; let currentTooltip = ""; let screenShake = 0;

const baseUnits = ["SWORD_1", "ARCHER_1", "MAGE_1", "SHIELD_1", "GUNNER_1", "NINJA_1"];
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
    "bg_hard_1.png": getSprite("bg_hard_1.png"),
    "items.png": getSprite("items.png"), // 👈 신규: 아이템 도트 그래픽 추가!
    "anim_chars_1.png": getSprite("anim_chars_1.png"),
};

let PlayerProfile = { gold: 500, soulStones: 0, unlockedStage: 1, passives: { startGoldLvl: 0, attackBoostLvl: 0 }, mastery: { SWORD: 0, ARCHER: 0, MAGE: 0, SHIELD: 0, GUNNER: 0, NINJA: 0 }, relics: {}, unlockedHiddens: [] };

function loadGameData() { 
    const saved = localStorage.getItem('defenseSaveData'); 
    if (saved) { 
        try { const parsed = JSON.parse(saved); if (parsed.soulStones !== undefined) PlayerProfile = Object.assign(PlayerProfile, parsed); } catch (e) { } 
    } 
    updateLobbyProfile();
} 
function saveGameData() { localStorage.setItem('defenseSaveData', JSON.stringify(PlayerProfile)); updateLobbyProfile(); }
function updateLobbyProfile() {
    const elStones = document.getElementById('lobbySoulStones'); if(elStones) elStones.innerText = PlayerProfile.soulStones;
    const elRelics = document.getElementById('lobbyRelicsList');
    if(elRelics) {
        elRelics.innerHTML = ""; let hasRelic = false;
        for (const [rId, level] of Object.entries(PlayerProfile.relics)) { if (level > 0 && RELIC_DB[rId]) { hasRelic = true; elRelics.innerHTML += `<span class="relic-badge" style="border-color:${RELIC_DB[rId].color}">[Lv.${level}] ${RELIC_DB[rId].name}</span>`; } }
        if(!hasRelic) elRelics.innerHTML = "<span style='color:#777;'>보유한 유물이 없습니다.</span>";
    }
}
window.onload = () => { loadGameData(); };

let bgImage = new Image(); const TILE_SIZE = 80; const MAP_COLS = 7; const MAP_ROWS = 7;
const START_X = centerX - (MAP_COLS * TILE_SIZE) / 2; const START_Y = centerY - (MAP_ROWS * TILE_SIZE) / 2;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const Sound = { play: (freq, type, duration, vol, freqSlide = 0) => { if (audioCtx.state === 'suspended') audioCtx.resume(); const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain(); osc.type = type; osc.connect(gain); gain.connect(audioCtx.destination); osc.frequency.setValueAtTime(freq, audioCtx.currentTime); if (freqSlide !== 0) osc.frequency.exponentialRampToValueAtTime(freqSlide, audioCtx.currentTime + duration); gain.gain.setValueAtTime(vol, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration); osc.start(); osc.stop(audioCtx.currentTime + duration); }, click: () => Sound.play(800, 'sine', 0.05, 0.03) };
const bgm = new Audio('bgm_1.mp3'); bgm.loop = true; bgm.volume = 0.3; 

const gameButtons = [
    new UIButton(40, 1120, 300, 60, "🎲 뽑기 (100G)", "#1565c0", () => requestGacha()),
    new UIButton(380, 1120, 300, 60, "🏃 방 나가기", "#c62828", () => { if(confirm("로비로 돌아가시겠습니까?")) window.location.reload(); }),
    new UIButton(590, 20, 110, 45, "▶ 1배속", "#f57f17", () => { gameSpeed = (gameSpeed === 1) ? 2 : 1; }),
    new UIButton(590, 75, 110, 45, "🔊 BGM", "#4CAF50", function() { if (bgm.paused) { bgm.play().catch(e=>e); this.color = "#4CAF50"; } else { bgm.pause(); this.color = "#555"; } }),
    new UIButton(40, 1190, 310, 60, "💣 전체폭격 (300G)", "#c62828", () => useActiveSkill('BOMB')),
    new UIButton(370, 1190, 310, 60, "💖 넥서스수리 (500G)", "#2e7d32", () => useActiveSkill('HEAL'))
];

// 로비 이벤트 리스너들
document.getElementById('btnRelicGacha')?.addEventListener('click', () => {
    if (PlayerProfile.soulStones >= 50) {
        PlayerProfile.soulStones -= 50; let totalWeight = Object.values(RELIC_DB).reduce((sum, r) => sum + r.weight, 0); let rand = Math.random() * totalWeight; let pickedId = null;
        for (let [id, r] of Object.entries(RELIC_DB)) { if (rand < r.weight) { pickedId = id; break; } rand -= r.weight; }
        PlayerProfile.relics[pickedId] = (PlayerProfile.relics[pickedId] || 0) + 1; saveGameData();
        alert(`🎉 축하합니다!\n\n[${RELIC_DB[pickedId].grade}급] ${RELIC_DB[pickedId].name} 획득!\n(현재 레벨: ${PlayerProfile.relics[pickedId]})`);
    } else { alert("영혼석이 부족합니다!"); }
});
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
if(stageSelect) { stageSelect.addEventListener('change', (e) => { const val = parseInt(e.target.value); const info = STAGE_DB[val]; if(info) { document.getElementById('infoTitle').innerText = info.name; document.getElementById('infoDesc').innerText = info.desc; document.getElementById('infoReward').innerText = `🎁 클리어 보상: 영혼석 ${info.singleRewardMult}배 획득 (싱글 전용)`; } }); }
const btnStartSingle = document.getElementById('btnStartSingle');
if(btnStartSingle) {
    btnStartSingle.addEventListener('click', () => {
        currentStage = parseInt(document.getElementById('stageSelect').value) || 1;
        document.getElementById('heroSelectModal').style.display = 'flex';
    });
}

const LAB_UPGRADES = { SWORD: { name: "⚔️ 검사 훈련", desc: "검사 데미지 10% 증가" }, ARCHER: { name: "🏹 궁수 훈련", desc: "궁수 데미지 10% 증가" }, MAGE: { name: "🪄 마법사 훈련", desc: "마법사 데미지 10% 증가" }, SHIELD: { name: "🛡️ 방패병 훈련", desc: "방패병 데미지 10% 증가" }, GUNNER: { name: "🔫 총잡이 훈련", desc: "총잡이 데미지 10% 증가" }, NINJA: { name: "🥷 닌자 훈련", desc: "닌자 데미지 10% 증가" } };
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

function getValidSpawnPos() { let emptyTiles = []; for (let r = 1; r <= 5; r++) { for (let c = 1; c <= 5; c++) { if (!units.some(u => u.gridX === c && u.gridY === r)) { emptyTiles.push({ col: c, row: r }); } } } if (emptyTiles.length === 0) return null; return emptyTiles[Math.floor(Math.random() * emptyTiles.length)]; }

// ★ VFX 이펙트 생성 함수
function spawnVFX(type, x, y, opts = {}) {
    vfxList.push({ type: type, x: x, y: y, life: opts.life || 20, maxLife: opts.life || 20, ...opts });
}

function startGame() {
    isGameRunning = true; myGold = 300 + ((PlayerProfile.passives?.startGoldLvl || 0) * 20); myInventory = []; units = []; monsters = []; projectiles = []; vfxList = [];
    nexusHp = 10; currentWave = 1; maxWave = STAGE_DB[currentStage].maxWave; stats = { kills: 0, p1Damage: 0, p2Damage: 0 }; countdown = 180; waveState = 'SPAWNING';
    // 👇 신규 추가: 선택한 주력 영웅을 맵 정중앙에 소환! 👇
    if (chosenStartingHero) {
        let newHero = {
            ...UNIT_DB[chosenStartingHero], id: Math.random().toString(36).substr(2, 9), type: chosenStartingHero, side: mySide, gridX: 3, gridY: 3, x: START_X + 3 * TILE_SIZE + TILE_SIZE/2, y: START_Y + 3 * TILE_SIZE + TILE_SIZE/2, timer: 0, attackAnimTimer: 0, items: [], hyperTimer: 0, critRate: UNIT_DB[chosenStartingHero].critRate || 0, critDamage: UNIT_DB[chosenStartingHero].critDamage || 1.5, mana: UNIT_DB[chosenStartingHero].mana || 0, maxMana: UNIT_DB[chosenStartingHero].maxMana || 100, manaPerAttack: UNIT_DB[chosenStartingHero].manaPerAttack || 10
        };
        units.push(newHero);
        chosenStartingHero = null;
    }
    let spawnTiers = RELIC_ENGINE.getSpawnTiers(PlayerProfile.relics);
    spawnTiers.forEach(tier => {
        const pos = getValidSpawnPos();
        if (pos) {
const arr = ["SWORD_", "ARCHER_", "MAGE_", "SHIELD_", "GUNNER_", "NINJA_"].map(t => t + tier);
            const unitId = arr[Math.floor(Math.random() * arr.length)];
            let newHero = {
                ...UNIT_DB[unitId],
                id: Math.random().toString(36).substr(2, 9),
                type: unitId,
                side: mySide,
                gridX: pos.col,
                gridY: pos.row,
                x: START_X + pos.col * TILE_SIZE + TILE_SIZE/2,
                y: START_Y + pos.row * TILE_SIZE + TILE_SIZE/2,
                timer: 0,
                attackAnimTimer: 0,
                items: [],
                hyperTimer: 0,
                // 👇 data.js에 값이 없으면 기본값을 자동으로 달아주는 마법의 코드 👇
                critRate: UNIT_DB[unitId].critRate || 0,
                critDamage: UNIT_DB[unitId].critDamage || 1.5,
                mana: UNIT_DB[unitId].mana || 0,
                maxMana: UNIT_DB[unitId].maxMana || 100,
                manaPerAttack: UNIT_DB[unitId].manaPerAttack || 10
            };
            units.push(newHero);
        }
    });
    bgm.play().catch(e => console.log("BGM 자동재생 방지됨:", e)); requestAnimationFrame(gameLoop);
}

function requestGacha() {
    if (myGold >= 100) {
        let pos = getValidSpawnPos(); if (!pos) { addFloatingText("진영에 빈 칸이 없습니다!", centerX, centerY, "#ff5252"); return; }
        myGold -= 100; const rareUnits = ["SWORD_2", "ARCHER_2", "MAGE_2", "SHIELD_2", "GUNNER_2", "NINJA_2"]; const classIndex = Math.floor(Math.random() * 6); 
        const spawnUnitId = (Math.random() < 0.10) ? rareUnits[classIndex] : baseUnits[classIndex];
        let newHero = {
            ...UNIT_DB[spawnUnitId],
            id: Math.random().toString(36).substr(2, 9),
            type: spawnUnitId,
            side: mySide,
            gridX: pos.col,
            gridY: pos.row,
            x: START_X + pos.col * TILE_SIZE + TILE_SIZE/2,
            y: START_Y + pos.row * TILE_SIZE + TILE_SIZE/2,
            timer: 0,
            attackAnimTimer: 0,
            items: [],
            hyperTimer: 0,

            // 👇 data.js에 값이 없으면 기본값을 자동으로 달아주는 마법의 코드 👇
            critRate: UNIT_DB[spawnUnitId].critRate || 0,
            critDamage: UNIT_DB[spawnUnitId].critDamage || 1.5,
            mana: UNIT_DB[spawnUnitId].mana || 0,
            maxMana: UNIT_DB[spawnUnitId].maxMana || 100,
            manaPerAttack: UNIT_DB[spawnUnitId].manaPerAttack || 10
        };
        units.push(newHero);
        addFloatingText("소환 완료!", centerX, centerY, "#69f0ae");
    } else { addFloatingText("골드가 부족합니다!", centerX, centerY, "#ff5252"); }
}

function useActiveSkill(type) {
    if (type === 'BOMB') {
        if (myGold >= 300) { 
            myGold -= 300; 
            monsters.forEach(m => { m.hp -= 500; if (m.hp <= 0 && !m.isDead) handleKill(m); }); 
            screenShake = 20; 
            // 융단 폭격 VFX
            spawnVFX('flash', centerX, centerY, {color: "rgba(255, 0, 0, 0.5)", life: 15});
        } else { addFloatingText("골드가 부족합니다!", centerX, centerY, "#ff5252"); }
    } else if (type === 'HEAL') {
        if (myGold >= 500) { if (nexusHp < 10) { myGold -= 500; nexusHp = Math.min(nexusHp + 3, 10); } else { addFloatingText("넥서스 체력이 가득 찼습니다!", centerX, centerY, "#ff5252"); } } else { addFloatingText("골드가 부족합니다!", centerX, centerY, "#ff5252"); }
    }
}

function handleKill(m) {
    if (m.isDead) return; m.isDead = true; stats.kills++;
    let baseGold = m.isBoss ? 50 : 3; let bonusMult = RELIC_ENGINE.getGoldBonus(PlayerProfile.relics); myGold += baseGold * (1 + bonusMult);
    if (m.isBoss && myInventory.length < 5) { 
        // 💡 신규 로직: 'isCombined'가 없는(완성템이 아닌) 순수 재료 템만 골라내서 드랍!
        let baseItemKeys = Object.keys(ITEM_DB).filter(key => !ITEM_DB[key].isCombined); 
        myInventory.push(baseItemKeys[Math.floor(Math.random() * baseItemKeys.length)]); 
    }
}

function updatePhysics() {
    if (nexusHp <= 0 || currentWave > maxWave) return;
    let stageDef = STAGE_DB[currentStage] || STAGE_DB[1]; // ★ 데이터 주도 설계 적용
    let hpMulti = stageDef.hpMultiplier; 

    for (let step = 0; step < gameSpeed; step++) {
        if (countdown > 0) { countdown--; continue; } frameCount++;
        if (waveState === 'SPAWNING') {
            if (frameCount % 30 === 0) {
                let baseMaxHp = 50 + (frameCount / 100); let mSpeed = 0.8; let radius = 15; let mutantType = "NORMAL";
                if (currentStage > 1) { const mutantChance = Math.min(0.2 + (currentStage - 2) * 0.15, 0.6); if (Math.random() < mutantChance) { if (Math.random() < 0.5) { mutantType = "FAST"; mSpeed = 1.4 + (currentStage * 0.1); baseMaxHp *= 0.5; radius = 10; } else { mutantType = "TANK"; mSpeed = 0.4; baseMaxHp *= 2.5; radius = 20; } } }
                
                const spawnMonster = () => {
                    let stageDef = STAGE_DB[currentStage] || {};
                    let mType = (Math.random() < 0.3) ? "FIRE" : "NORMAL";
                    let mPath = [ {c: 0, r: 0}, {c: 6, r: 0}, {c: 6, r: 6}, {c: 0, r: 6}, {c: 0, r: 1} ]; 
                    let startTileX = START_X + mPath[0].c * TILE_SIZE + TILE_SIZE/2; let startTileY = START_Y + mPath[0].r * TILE_SIZE + TILE_SIZE/2; 

                    let rType = "NONE";
                    if (currentStage >= 5) { rType = Math.random() < 0.5 ? "PHYSICAL" : "MAGIC"; }

                    // ★ 싱글 엔진에도 DB에서 몬스터 시트 이름 가져오기
                    let sheetSrc = stageDef.mobSheetSrc || "monster_1.png";
                    let sheetRow = stageDef.mobSheetRow !== undefined ? stageDef.mobSheetRow : 0; 
                    
                    // ★ 5스테이지 하드모드 전용 몬스터 스킨 매핑
                    if (currentStage >= 5) {
                        if (mutantType === "FAST") sheetRow = 2;      // 2행: 박쥐 (빠름)
                        else if (mutantType === "TANK") sheetRow = 3; // 3행: 해골 (탱커)
                        else sheetRow = Math.random() < 0.5 ? 0 : 1;  // 0,1행: 슬라임/유령 (일반)
                    } else {
                        if (currentStage === 2) sheetRow = 1; else if (currentStage === 3) sheetRow = 3; else if (currentStage === 4) sheetRow = 5; 
                        if (mutantType === "FAST") sheetRow = 4; 
                        if (mutantType === "TANK") sheetRow = 2; 
                    }

                    monsters.push({ id: Math.random().toString(36).substr(2, 9), path: mPath, pathIndex: 0, x: startTileX, y: startTileY - 80, targetY: startTileY, isEntering: true, hp: baseMaxHp * hpMulti, maxHp: baseMaxHp * hpMulti, speed: mSpeed, radius: radius, type: mType, mutantType: mutantType, isBoss: false, stunTimer: 0, poisonTimer: 0, poisonDmg: 0, sheetSrc: sheetSrc, sheetRow: sheetRow, animOffset: Math.floor(Math.random() * 4), resistType: rType }); 
                };
                spawnMonster(); monstersSpawnedThisWave += 1;
            }
            if (monstersSpawnedThisWave >= 20) {
                let isFinal = (currentWave === maxWave); let isMidBoss = (currentWave % 5 === 0);
                if (isMidBoss || isFinal) { 
                    let bossBaseHp = 500 + (frameCount / 2); if (isFinal) bossBaseHp *= 2; 
                    const spawnBoss = () => { 
                        // ★ 싱글 경로 U자 꽉 채우기 (종착점을 0,6으로 변경)
                        let mPath = [ {c: 0, r: 0}, {c: 6, r: 0}, {c: 6, r: 6}, {c: 0, r: 6}, {c: 0, r: 1} ]; 
                        let startTileX = START_X + mPath[0].c * TILE_SIZE + TILE_SIZE/2; let startTileY = START_Y + mPath[0].r * TILE_SIZE + TILE_SIZE/2; 
                        let bossRow = Math.floor(currentWave / 5) - 1; if (bossRow < 0) bossRow = 0; if (bossRow > 3) bossRow = 3; 
                        
                        // ★ DB에 적힌 보스 정보(면역, 스킬여부 등)를 그대로 가져옴
                        monsters.push({ 
                            id: Math.random().toString(36).substr(2, 9), path: mPath, pathIndex: 0, x: startTileX, y: startTileY - 80, targetY: startTileY, isEntering: true, hp: bossBaseHp * hpMulti, maxHp: bossBaseHp * hpMulti, speed: 0.3, radius: stageDef.bossRadius || 30, type: "NORMAL", mutantType: "NORMAL", isBoss: true, isFinalBoss: isFinal, stunTimer: 0, poisonTimer: 0, poisonDmg: 0, sheetSrc: stageDef.bossSheet || "boss_1.png", sheetRow: bossRow, stage: currentStage, animOffset: Math.floor(Math.random() * 4), 
                            ccImmune: stageDef.ccImmune || false, castSkill: stageDef.castSkill || false, skillCooldown: 180 
                        }); 
                    }; 
                    spawnBoss(); screenShake = 30; addFloatingText("⚠️ 보스 등장!", centerX, centerY - 100, "#ff5252"); 
                }
                waveState = 'WAITING_CLEAR';
            }
        } else if (waveState === 'WAITING_CLEAR') { if (monsters.length === 0) { myGold += currentWave * 5; if (currentWave >= maxWave) { handleGameOver(true); } else { waveState = 'COUNTDOWN'; waveTimer = 180; } }
        } else if (waveState === 'COUNTDOWN') { waveTimer--; if (waveTimer <= 0) { currentWave++; monstersSpawnedThisWave = 0; waveState = 'SPAWNING'; } }

        activeSynergies = { SWORD:0, ARCHER:0, MAGE:0, SHIELD:0, GUNNER:0, NINJA:0 };
        units.forEach(u => { let st = UNIT_DB[u.type]; if(st && st.trait) activeSynergies[st.trait]++; });
        let auras = units.filter(u => (UNIT_DB[u.type] && UNIT_DB[u.type].skill && UNIT_DB[u.type].skill.type.startsWith('aura_'))); let hasGlobalSlow = auras.some(u => UNIT_DB[u.type].skill.type === 'aura_global_slow');
        
        // 🛡️ [신규] 방어/마방/체력 스탯 계산 및 오라(Aura) 등록
        let defensiveAuras = [];
        units.forEach(u => {
            let uDef = UNIT_DB[u.type]; if(!uDef) return;
            let tHp = uDef.hp || 100; let tArmor = uDef.armor || 0; let tMr = uDef.mr || 0;
            if (u.items) {
                u.items.forEach(itemId => {
                    let iDef = ITEM_DB[itemId];
                    if(iDef) {
                        if (iDef.type === "hp") tHp += iDef.value;
                        if (iDef.type === "armor") tArmor += iDef.value;
                        if (iDef.type === "mr") tMr += iDef.value;
                        if (iDef.stat) { // 완성템 스탯 합산
                            if (iDef.stat.type === "hp") tHp += iDef.stat.value;
                            if (iDef.stat.type === "armor") tArmor += iDef.stat.value;
                            if (iDef.stat.type === "mr") tMr += iDef.stat.value;
                        }
                    }
                });
            }
            u.calcHp = tHp; u.calcArmor = tArmor; u.calcMr = tMr;
            u.auraRadius = 60 + (tHp * 0.1); // 💡 기획자님의 핵심: 체력에 비례해서 가시/슬로우 반경 뻥튀기!
            if (tArmor > 0 || tMr > 0) defensiveAuras.push(u);
        });

        units.forEach(u => {
            if (u.stunTimer > 0) { u.stunTimer--; return; }
            if (u.attackAnimTimer > 0) u.attackAnimTimer--; if (u.timer > 0) u.timer--;
            if (u.timer <= 0) {
                const uStats = UNIT_DB[u.type]; if (!uStats) return;
                let syn = activeSynergies[uStats.trait] || 0; let buffedDamage = uStats.damage; let buffedCooldown = uStats.cooldown; let buffedRange = uStats.range;
                if (u.hyperTimer > 0) { u.hyperTimer--; buffedCooldown = Math.floor(buffedCooldown * 0.33); }

                auras.forEach(a => { let dist = Math.hypot(a.x - u.x, a.y - u.y); if (a.skill.type === 'aura_buff_dmg' && dist <= a.skill.radius) buffedDamage = Math.floor(buffedDamage * a.skill.value); if (a.skill.type === 'aura_buff_all' && dist <= a.skill.radius) { buffedDamage = Math.floor(buffedDamage * a.skill.value); buffedCooldown = Math.max(10, Math.floor(buffedCooldown / a.skill.value)); } });
                let itemCritBonus = 0; let itemManaBonus = 0; let itemManaMult = 1; let itemBossMult = 1;
                if (u.items) { u.items.forEach(itemId => { let itemDef = ITEM_DB[itemId]; if (itemDef) { 
                    if (itemDef.type === "dmg") buffedDamage = Math.floor(buffedDamage * itemDef.value); 
                    if (itemDef.type === "spd") buffedCooldown = Math.floor(buffedCooldown * itemDef.value); 
                    if (itemDef.type === "rng") buffedRange += itemDef.value; 
                    if (itemDef.type === "crit") itemCritBonus += itemDef.value; // 연습용 장갑 적용
                    if (itemDef.type === "mana") itemManaBonus += itemDef.value; // 여신의 눈물 적용
                    
                    if (itemDef.stat) { // 완성템 특수 스탯 적용 (무대, 라바돈, 거학 등)
                        if (itemDef.stat.type === "dmg") buffedDamage = Math.floor(buffedDamage * itemDef.stat.value);
                        if (itemDef.stat.type === "spd") buffedCooldown = Math.floor(buffedCooldown * itemDef.stat.value);
                        if (itemDef.stat.type === "rng") buffedRange += itemDef.stat.value;
                        if (itemDef.stat.critRateBonus) itemCritBonus += itemDef.stat.critRateBonus;
                        if (itemDef.stat.bossDmgMult) itemBossMult *= itemDef.stat.bossDmgMult;
                        if (itemDef.stat.manaGainMult) itemManaMult *= itemDef.stat.manaGainMult;
                        if (itemDef.stat.rangeBonus) buffedRange += itemDef.stat.rangeBonus;
                    }
                } }); }

                let statMods = RELIC_ENGINE.getStatMods(PlayerProfile.relics); let relicDmgMult = statMods.dmgMult; buffedCooldown = Math.floor(buffedCooldown * statMods.spdFactor); if (buffedCooldown < 10) buffedCooldown = 10; buffedRange += statMods.rangeBonus; 

                const passiveMultiplier = 1 + ((PlayerProfile.passives?.attackBoostLvl || 0) * 0.05); const classMasteryLvl = PlayerProfile.mastery?.[uStats.trait] || 0; const masteryMultiplier = 1 + (classMasteryLvl * 0.1);
                const finalDamage = Math.floor(buffedDamage * passiveMultiplier * masteryMultiplier * relicDmgMult);

                let target = null; let validMonsters = []; let rangeSq = buffedRange * buffedRange;
                monsters.forEach(m => { let dx = m.x - u.x; let dy = m.y - u.y; let distSq = dx*dx + dy*dy; if (distSq <= rangeSq) validMonsters.push({ m, distSq }); });
                if (validMonsters.length > 0) { if (uStats.trait === "ARCHER" || uStats.trait === "GUNNER") validMonsters.sort((a, b) => b.m.hp - a.m.hp); else if (uStats.trait === "NINJA") validMonsters.sort((a, b) => b.m.pathIndex - a.m.pathIndex); else validMonsters.sort((a, b) => a.distSq - b.distSq); target = validMonsters[0].m; }
                
                if (target) {
                    let activeSkill = null; let pStyle = uStats.projectile ? uStats.projectile.style : "default"; let pColor = uStats.projectile ? uStats.projectile.color : "#ffff00"; let pSplash = uStats.splashRadius || 0;
                    if (uStats.skill && uStats.skill.type.startsWith('proc_')) { 
                        if (Math.random() < uStats.skill.chance) { 
                            activeSkill = uStats.skill; 
                            if (activeSkill.type === 'proc_hyper_spd') u.hyperTimer = activeSkill.duration; 
                            if (activeSkill.type === 'proc_meteor') { pColor = "#ff5722"; pStyle = "meteor"; } 
                        } 
                    } else if (uStats.skill && uStats.skill.type.startsWith('passive_')) { activeSkill = uStats.skill; }
                    
                    if (activeSkill && activeSkill.type === 'proc_global_dmg') {
                        spawnVFX('flash', centerX, centerY, {color: "rgba(255, 100, 0, 0.4)", life: 10});
                        monsters.forEach(m => { m.hp -= finalDamage * activeSkill.mult; if (m.hp <= 0 && !m.isDead) handleKill(m); });
                        u.timer = buffedCooldown; u.attackAnimTimer = 20; screenShake = 15; return;
                    }
                    
                    // 💥 1. 크리티컬 & 보스 추가 데미지 로직
                    let appliedDamage = finalDamage;
                    if (target.isBoss) appliedDamage = Math.floor(appliedDamage * itemBossMult); // 거인 학살자 적용!
                    
                    let isCrit = false;
                    let totalCritRate = (u.critRate || 0) + itemCritBonus; // 무한의 대검, 장갑 확률 합산!
                    if (Math.random() < totalCritRate) {
                        appliedDamage = Math.floor(appliedDamage * (u.critDamage || 1.5));
                        isCrit = true;
                    }

                    // 💧 2. 마나 충전 로직
                    let gainedMana = ((u.manaPerAttack || 10) + itemManaBonus) * itemManaMult; // 여눈, 라바돈 적용!
                    u.mana = (u.mana || 0) + gainedMana;
                    if (u.mana >= (u.maxMana || 100)) {
                        addFloatingText("✨스킬 ON!", u.x, u.y - 30, "#40c4ff");
                        u.mana = 0; 
                    }

                    // 🎯 3. 발사체 생성 (크리티컬이 터졌다면 데미지가 뻥튀기된 appliedDamage가 들어감)
                    let targets = [target];
                    if (activeSkill && activeSkill.type === 'passive_multishot') { 
                        targets = validMonsters.slice(0, activeSkill.targets).map(v => v.m); 
                    }
                    targets.forEach(t => { 
                        projectiles.push({ 
                            id: Math.random().toString(36).substr(2, 9), 
                            x: u.x, y: u.y, 
                            targetId: t.id, 
                            damage: appliedDamage, // <- 수정됨: 기본 데미지가 아닌 크리 적용 데미지
                            speed: 10, side: u.side, 
                            style: pStyle, color: pColor, 
                            splashRadius: pSplash, 
                            skill: activeSkill, 
                            damageType: uStats.damageType,
                            hasRedBuff: (u.items && u.items.includes("RED_BUFF")), // 🔥 레드 버프 장착 여부 확인
                            isCrit: isCrit // 발사체에 크리티컬 여부를 꼬리표로 달아줌
                        }); 
                    });
                    u.timer = buffedCooldown; u.attackAnimTimer = 20;
                }
            }
        });

        for (let i = projectiles.length - 1; i >= 0; i--) {
            let p = projectiles[i]; let target = monsters.find(m => m.id === p.targetId); if (!target) { projectiles.splice(i, 1); continue; }
            let dist = Math.hypot(target.x - p.x, target.y - p.y);
            if (dist <= 15) { 
                let finalDamage = p.damage; 
                // ★ 상성 체크: 몬스터 내성과 내 공격 타입이 같으면 데미지 50% 깎임!
                if (target.resistType === "PHYSICAL" && p.damageType === "PHYSICAL") finalDamage = Math.floor(finalDamage * 0.5);
                // 👇 크리티컬 발동 시: 노란색 큰 폭발 VFX (디버프/내성 처리 후 보여주기)
                if (p.isCrit) { spawnVFX('hit', target.x, target.y, {color: '#ffea00', radius: 50}); }

                if (target.resistType === "MAGIC" && p.damageType === "MAGIC") finalDamage = Math.floor(finalDamage * 0.5);
                
                let splashRad = p.splashRadius; let s = p.skill;

                if (s) {
                    if (s.type === 'proc_crit') { finalDamage *= s.mult; spawnVFX('hit', target.x, target.y, {color: '#ffea00', radius: 45}); }
                    if (s.type === 'passive_boss_killer' && target.isBoss) { finalDamage *= s.mult; spawnVFX('hit', target.x, target.y, {color: '#ff1744', radius: 60}); }
                    if (s.type === 'proc_execute') { if (target.isBoss) finalDamage *= s.bossMult; else finalDamage = target.hp + 9999; spawnVFX('execute', target.x, target.y, {color: p.color}); }
                    if (s.type === 'proc_percent_dmg') { finalDamage += target.hp * s.percent; spawnVFX('execute', target.x, target.y, {color: '#b71c1c'}); }
                    
                    if (s.type === 'proc_knockback') { if (!target.ccImmune) { target.y -= s.pushDist; target.stunTimer = 60; spawnVFX('explosion', target.x, target.y, {color: 'rgba(200,255,255,0.7)', radius: 50}); } else { spawnVFX('hit', target.x, target.y, {color: '#888'}); } }
                    if (s.type === 'proc_stun') { if (!target.ccImmune) { target.stunTimer = s.duration; if (p.color === "#40c4ff") spawnVFX('ice', target.x, target.y, {}); else spawnVFX('explosion', target.x, target.y, {color: 'rgba(255,200,0,0.5)', radius: 40}); } else { spawnVFX('hit', target.x, target.y, {color: '#888'}); } }

                    if (s.type === 'passive_poison') { target.poisonTimer = 180; target.poisonDmg = finalDamage * 0.2; }
                    if (s.type === 'proc_splash') { finalDamage *= s.mult; splashRad = (splashRad || 40) * s.radiusMult; spawnVFX('explosion', target.x, target.y, {color: 'rgba(255,60,0,0.7)', radius: splashRad}); }
                    if (s.type === 'proc_meteor') { finalDamage *= s.mult; splashRad = s.radius; screenShake = 8; spawnVFX('explosion', target.x, target.y, {color: 'rgba(255,0,0,0.9)', radius: splashRad}); }
                    if (s.type === 'proc_pierce') { finalDamage *= s.mult; splashRad = 150; spawnVFX('slash', target.x, target.y, {color: p.color}); } 
                } else if (splashRad > 0) { spawnVFX('explosion', target.x, target.y, {color: 'rgba(255,200,100,0.4)', radius: splashRad}); }
                
                if (splashRad > 0) {
                    let splashSq = splashRad * splashRad;
                    monsters.forEach(otherM => { if (otherM.id !== target.id && !otherM.isDead) { let dx = otherM.x - target.x; let dy = otherM.y - target.y; if (dx*dx + dy*dy <= splashSq) { let splashDmg = Math.floor(finalDamage * 0.8); otherM.hp -= splashDmg; if (otherM.hp <= 0 && !otherM.isDead) handleKill(otherM); } } });
                }
                // 🔥 붉은 덩굴정령 버프 적용 로직
                if (p.hasRedBuff) { 
                    target.burnTimer = 300; // 60프레임 * 5초 = 300
                    target.burnDmg = target.maxHp * 0.01; // 최대 체력의 1%
                    target.wound = true; // 치유 감소 표식
                }
                
                target.hp -= finalDamage; projectiles.splice(i, 1); if (target.hp <= 0 && !target.isDead) handleKill(target);
            } else { p.x += (target.x - p.x) / dist * p.speed; p.y += (target.y - p.y) / dist * p.speed; }
        }

        monsters = monsters.filter(m => !m.isDead);
        monsters.forEach(m => { 
            // 🛡️ 1. 탱커 어그로 (보스 스킬 타겟팅)
            if (m.isBoss && m.castSkill) {
                if (m.skillCooldown > 0) m.skillCooldown--;
                if (m.skillCooldown <= 0) {
                    m.skillCooldown = 180;
                    let validUnits = units.filter(u => !u.stunTimer || u.stunTimer <= 0);
                    if (validUnits.length > 0) {
                        // 랜덤이 아니라 '체력(calcHp)이 가장 높은 영웅'을 무조건 먼저 노립니다!
                        let targetUnit = validUnits.reduce((max, obj) => ((max.calcHp || 100) > (obj.calcHp || 100)) ? max : obj);
                        
                        // 강인함: 체력이 높을수록 기절 시간(90프레임) 대폭 감소
                        let hpValue = targetUnit.calcHp || 100;
                        let ccMult = 1000 / (1000 + hpValue); 
                        targetUnit.stunTimer = Math.floor(90 * ccMult); 
                        
                        spawnVFX('flash', targetUnit.x, targetUnit.y, {color: "rgba(255, 255, 0, 0.4)", radius: 60});
                        addFloatingText("🛡️어그로 핑퐁!", targetUnit.x, targetUnit.y - 30, "#ffeb3b");
                    }
                }
            }

            // 🛡️ 2. 가시 갑옷 & 늪 오라 적용 (방어/마방)
            let mrSlowFactor = 1.0;
            defensiveAuras.forEach(aura => {
                let dx = m.x - aura.x; let dy = m.y - aura.y;
                let distSq = dx*dx + dy*dy;
                // 체력에 비례해 넓어진 오라 범위 안에 적이 들어오면?
                if (distSq <= aura.auraRadius * aura.auraRadius) {
                    // 💥 가시 딜 (방어력의 50%를 0.5초마다 고정피해로!)
                    if (aura.calcArmor > 0 && frameCount % 30 === 0) {
                        let thornDmg = aura.calcArmor * 0.5; 
                        m.hp -= thornDmg;
                        spawnVFX('hit', m.x, m.y, {color: '#ff9800', radius: 20}); // 주황색 가시 튀는 이펙트
                        if (m.hp <= 0 && !m.isDead) handleKill(m);
                    }
                    // 늪 슬로우 (마법 저항력 비례)
                    if (aura.calcMr > 0 && !m.ccImmune) {
                        let slowReduction = 100 / (100 + aura.calcMr); // 마방 100이면 속도 반토막!
                        if (slowReduction < mrSlowFactor) mrSlowFactor = slowReduction;
                    }
                }
            });

            if (m.poisonTimer > 0) { if (m.poisonTimer % 30 === 0) { m.hp -= m.poisonDmg; if (m.hp <= 0 && !m.isDead) handleKill(m); } m.poisonTimer--; }
            if (m.burnTimer > 0) { 
                if (m.burnTimer % 60 === 0) { 
                    m.hp -= m.burnDmg; 
                    spawnVFX('hit', m.x, m.y - 20, {color: '#ff1744', radius: 25}); 
                    if (m.hp <= 0 && !m.isDead) handleKill(m); 
                } 
                m.burnTimer--; 
            }
            
            if (m.stunTimer > 0) { m.stunTimer--; } else {
                let curSpeed = m.speed; 
                if (hasGlobalSlow && !m.ccImmune) curSpeed *= 0.7; 
                if (!m.ccImmune) curSpeed *= mrSlowFactor; // 👈 마방 오라 슬로우 속도에 적용!
                
                if (m.isEntering) { m.y += curSpeed; if (m.y >= m.targetY) { m.y = m.targetY; m.isEntering = false; } } else {
                    let targetNode = m.path[m.pathIndex + 1];
                    if (targetNode) {
                        let tx = START_X + targetNode.c * TILE_SIZE + TILE_SIZE/2; let ty = START_Y + targetNode.r * TILE_SIZE + TILE_SIZE/2; let dx = tx - m.x; let dy = ty - m.y; let dist = Math.sqrt(dx*dx + dy*dy);
                        if (dist < curSpeed) { m.x = tx; m.y = ty; m.pathIndex++; } else { m.x += (dx/dist)*curSpeed; m.y += (dy/dist)*curSpeed; }
                    } else { if (m.isBoss) nexusHp = 0; else nexusHp -= 1; m.isDead = true; }
                }
            }
        });
        monsters = monsters.filter(m => !m.isDead); if (nexusHp <= 0) handleGameOver(false);
    } 
}

function handleGameOver(isClear) {
    isGameRunning = false; document.getElementById('gameOverOverlay').style.display = 'flex';
    if(isClear) { document.querySelector('.go-title').innerText = "STAGE CLEAR!"; document.querySelector('.go-title').style.color = "#69f0ae"; }
    document.getElementById('goKills').innerText = stats.kills; document.getElementById('goWave').innerText = currentWave; document.getElementById('goGold').innerText = Math.floor(myGold);
    let safeMult = STAGE_DB[currentStage]?.singleRewardMult || 1.0; let baseReward = isClear ? ((currentWave * 2) + (Math.floor(currentWave / 5) * 20) + 100) : (((currentWave - 1) * 2) + (Math.floor((currentWave - 1) / 5) * 20));
    let earnedStones = Math.floor(baseReward * safeMult) || 0; PlayerProfile.soulStones += earnedStones; if (isClear && PlayerProfile.unlockedStage === currentStage && PlayerProfile.unlockedStage < Object.keys(STAGE_DB).length) PlayerProfile.unlockedStage++;
    saveGameData(); document.getElementById('goStones').innerText = earnedStones;
}

function getPointerPos(event) { const rect = canvas.getBoundingClientRect(); const clientX = event.touches ? event.touches[0].clientX : event.clientX; const clientY = event.touches ? event.touches[0].clientY : event.clientY; return { x: (clientX - rect.left) * (logicalWidth / rect.width), y: (clientY - rect.top) * (logicalHeight / rect.height) }; }

canvas.addEventListener('mousedown', (e) => {
    if (audioCtx.state === 'suspended') audioCtx.resume(); if (!isGameRunning) return; 
    const pos = getPointerPos(e);

    // ★ 1. 몬스터 클릭 여부 먼저 확인
    let clickedMonster = null;
    if (typeof monsters !== 'undefined') {
        for (let m of monsters) {
            let dist = Math.hypot(m.x - pos.x, m.y - pos.y);
            if (dist <= m.radius * 1.5) { // 터치하기 쉽게 판정을 살짝 넓게 줌
                clickedMonster = m;
                break;
            }
        }
    }

    if (clickedMonster) {
        window.selectedMonster = clickedMonster; // 몬스터 선택됨!
        selectedUnit = null; // 유닛 선택은 해제 (유닛 정보창 닫기)
        return; // 여기서 클릭 종료
    } else {
        window.selectedMonster = null; // 허공 클릭 시 몬스터 정보창 닫기
    }

    if (pos.x >= 10 && pos.x <= 90 && pos.y >= 100 && pos.y <= 130) { isSynergyOpen = !isSynergyOpen; return; }
    if (selectedUnit && draggingUnit === null) {
        const unitDef = UNIT_DB[selectedUnit.type]; if (!unitDef) return;
        if (pos.x >= 10 && pos.x <= 710 && pos.y >= 850 && pos.y <= 990) {
            // 💡 위치 및 크기가 축소된 버튼 클릭 판정 (Y: 885~950)
            if (pos.y >= 885 && pos.y <= 950) {
                // 판매 버튼 (615~690)
                if (pos.x >= 615 && pos.x <= 690) { Sound.click(); let basePrice = unitDef.sellPrice || 50; let sellBonusMult = RELIC_ENGINE.getSellBonus(PlayerProfile.relics || {}); let finalSellPrice = Math.floor(basePrice * (1 + sellBonusMult)); myGold += finalSellPrice; units = units.filter(u => u.id !== selectedUnit.id); selectedUnit = null; return; }
                
                if (unitDef.next) {
                    const processUpgrade = (nextId) => {
                        let cost = unitDef.upgradeCost; let nextDef = UNIT_DB[nextId]; if (nextDef.isHidden && (!PlayerProfile.unlockedHiddens || !PlayerProfile.unlockedHiddens.includes(nextId))) { addFloatingText("연구소에서 히든 영웅을 해금하세요!", centerX, centerY, "#ff5252"); return; }
                        if (myGold >= cost) { myGold -= cost; let chance = unitDef.upgradeChance || 1.0; if (Math.random() <= chance) { selectedUnit.type = nextId; addFloatingText("강화 성공!!", centerX, centerY, "#69f0ae"); spawnVFX('hit', selectedUnit.x, selectedUnit.y, {color:"#69f0ae", radius:60}); } else { addFloatingText("강화 실패... (유닛 유지)", centerX, centerY, "#ff5252"); spawnVFX('ice', selectedUnit.x, selectedUnit.y, {color:"#ff5252"}); } } else { addFloatingText("골드가 부족합니다!", centerX, centerY, "#ff5252"); }
                    };
                    
                    if (Array.isArray(unitDef.next)) { 
                        // 업그레이드 2번 (우측) 535~610
                        if (pos.x >= 535 && pos.x <= 610) { Sound.click(); processUpgrade(unitDef.next[1]); selectedUnit = null; return; } 
                        // 업그레이드 1번 (좌측) 455~530
                        if (pos.x >= 455 && pos.x <= 530) { Sound.click(); processUpgrade(unitDef.next[0]); selectedUnit = null; return; } 
                    } else { 
                        // 단일 업그레이드 535~610
                        if (pos.x >= 535 && pos.x <= 610) { Sound.click(); processUpgrade(unitDef.next); selectedUnit = null; return; } 
                    }
                }
            }
            return; 
        }
        selectedUnit = null; 
    }
    gameButtons.forEach(b => { if (b.isClicked(pos.x, pos.y)) { Sound.click(); b.onClick(); } });
    for (let i = 0; i < 5; i++) { let ix = 135 + i * 90; let iy = 1030; if (pos.x >= ix && pos.x <= ix + 70 && pos.y >= iy && pos.y <= iy + 70) { if (myInventory[i]) { draggingItem = { index: i, id: myInventory[i], x: pos.x, y: pos.y }; selectedUnit = null; return; } } }
    let hit = null; for (let u of units) { if (Math.hypot(u.x - pos.x, u.y - pos.y) <= 35) { hit = u; break; } } if (hit) { draggingUnit = hit; selectedUnit = hit; } else { selectedUnit = null; }
});

canvas.addEventListener('mousemove', (e) => {
    const pos = getPointerPos(e); mouseX = pos.x; mouseY = pos.y; currentTooltip = "";
    
    // 💡 1. 하단 보관함(인벤토리) 아이템 툴팁 검사
    for (let i = 0; i < 5; i++) { 
        let ix = 135 + i * 90; let iy = 1030; 
        if (mouseX >= ix && mouseX <= ix + 70 && mouseY >= iy && mouseY <= iy + 70) { 
            if (myInventory[i]) { 
                let itm = ITEM_DB[myInventory[i]]; 
                let effStr = "";
                if (itm.desc) effStr = itm.desc; 
                else if (itm.type === 'dmg') effStr = `공격력 +${Math.round((itm.value-1)*100)}%`; 
                else if (itm.type === 'spd') effStr = `공격 속도 +${Math.round((1-itm.value)*100)}%`; 
                else if (itm.type === 'rng') effStr = `사거리 +${itm.value}`; 
                else if (itm.type === 'crit') effStr = `치명타 확률 +${Math.round(itm.value*100)}%`;
                else if (itm.type === 'mana') effStr = `마나 재생 +${itm.value}`;
                else if (itm.type === 'armor') effStr = `방어력 +${itm.value}`;
                else if (itm.type === 'mr') effStr = `마법 저항력 +${itm.value}`;
                else if (itm.type === 'ap') effStr = `주문력 +${Math.round((itm.value-1)*100)}%`;
                else if (itm.type === 'hp') effStr = `체력 +${itm.value}`;
                
                currentTooltip = `[${itm.name}] ${effStr}`; 
            } 
        } 
    }

    // 💡 2. 선택된 영웅의 '장착 아이템' 툴팁 검사 (이름만 깔끔하게!)
    if (selectedUnit && selectedUnit.items) {
        for (let i = 0; i < 3; i++) {
            let slotX = 290 + (i * 45); let slotY = 910;
            // 아이템 슬롯(40x40) 위에 마우스가 있는지 확인
            if (mouseX >= slotX && mouseX <= slotX + 40 && mouseY >= slotY && mouseY <= slotY + 40) {
                if (selectedUnit.items[i]) {
                    let itm = ITEM_DB[selectedUnit.items[i]];
                    if (itm) {
                        currentTooltip = `[${itm.name}]`; // 👈 기획자님 요청대로 이름만 표시!
                    }
                }
            }
        }
    }

    if (draggingItem) { draggingItem.x = pos.x; draggingItem.y = pos.y; } 
    if (draggingUnit) { draggingUnit.x = pos.x; draggingUnit.y = pos.y; }
});



canvas.addEventListener('mouseup', (e) => {
    const pos = getPointerPos(e);
    if (draggingItem) {
        let targetUnit = null;
        for (let u of units) {
            // 마우스를 놓은 위치에 영웅이 있는지 확인
            if (Math.hypot(u.x - draggingItem.x, u.y - draggingItem.y) <= 35) { targetUnit = u; break; }
        }

        if (targetUnit) {
            if (!targetUnit.items) targetUnit.items = [];
            let droppedItemId = myInventory[draggingItem.index];
            let isCombined = false;

            // 💡 1. 롤토체스식 아이템 조합 검사!
            for (let i = 0; i < targetUnit.items.length; i++) {
                let existingItemId = targetUnit.items[i];
                
                // data.js에 있는 레시피 중에 방금 올린 템 + 기존 템 조합이 있는지 확인
                let recipe = ITEM_RECIPES.find(r => 
                    (r.mat1 === droppedItemId && r.mat2 === existingItemId) || 
                    (r.mat1 === existingItemId && r.mat2 === droppedItemId)
                );

                if (recipe) {
                    Sound.click();
                    // 기존 재료 템 삭제
                    targetUnit.items.splice(i, 1); 
                    // 인벤토리에서 드래그한 재료 삭제
                    myInventory.splice(draggingItem.index, 1); 
                    // ✨ 완성된 상위 아이템으로 교체 장착!
                    targetUnit.items.push(recipe.result); 

                    // 조합 성공 뽕맛 이펙트!
                    spawnVFX('hit', targetUnit.x, targetUnit.y, {color: '#ffea00', radius: 80});
                    addFloatingText("✨아이템 진화!✨", targetUnit.x, targetUnit.y - 40, "#ffeb3b");
                    isCombined = true;
                    break; 
                }
            }

            // 💡 2. 조합되는 템이 아니라면? -> 그냥 인벤토리에 빈칸 있을 때만 장착
            if (!isCombined) {
                if (targetUnit.items.length < 3) {
                    Sound.click();
                    targetUnit.items.push(droppedItemId);
                    myInventory.splice(draggingItem.index, 1);
                } else {
                    addFloatingText("아이템 꽉참! (최대 3개)", centerX, centerY, "#ff5252");
                }
            }
        }
        draggingItem = null;
        return;
    }
    if (draggingUnit) {
        const col = Math.floor((pos.x - START_X) / TILE_SIZE); const row = Math.floor((pos.y - START_Y) / TILE_SIZE); let allowedCols = [1, 2, 3, 4, 5]; 
        if (row >= 1 && row <= 5 && allowedCols.includes(col)) {
            let existing = units.find(u => u.gridX === col && u.gridY === row); if(existing) { existing.gridX = draggingUnit.gridX; existing.gridY = draggingUnit.gridY; existing.x = START_X + existing.gridX * TILE_SIZE + TILE_SIZE/2; existing.y = START_Y + existing.gridY * TILE_SIZE + TILE_SIZE/2; }
            draggingUnit.gridX = col; draggingUnit.gridY = row; draggingUnit.x = START_X + col * TILE_SIZE + TILE_SIZE/2; draggingUnit.y = START_Y + row * TILE_SIZE + TILE_SIZE/2;
        } else { draggingUnit.x = START_X + draggingUnit.gridX * TILE_SIZE + TILE_SIZE/2; draggingUnit.y = START_Y + draggingUnit.gridY * TILE_SIZE + TILE_SIZE/2; }
        draggingUnit = null;
    }
});

canvas.addEventListener('touchstart', (e) => { e.preventDefault(); if (e.touches.length > 0) canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY })); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); if (e.touches.length > 0) canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY })); }, { passive: false });
canvas.addEventListener('touchend', (e) => { e.preventDefault(); if (e.changedTouches && e.changedTouches.length > 0) canvas.dispatchEvent(new MouseEvent('mouseup', { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY })); else canvas.dispatchEvent(new MouseEvent('mouseup', {})); }, { passive: false });

document.getElementById('btnGoLobby')?.addEventListener('click', () => { window.location.reload(); });

function gameLoop() {
    if(!isGameRunning) return; updatePhysics(); ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    let speedBtn = gameButtons[2]; if (speedBtn) { speedBtn.text = gameSpeed === 2 ? "▶▶ 2배속" : "▶ 1배속"; speedBtn.color = gameSpeed === 2 ? "#d84315" : "#f57f17"; }

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
    for (let r = 0; r < MAP_ROWS; r++) { for (let c = 0; c < MAP_COLS; c++) { if (r === 0 || r === MAP_ROWS-1 || c === 0 || c === MAP_COLS-1) ctx.fillStyle = "rgba(0, 0, 0, 0.4)"; else ctx.fillStyle = "rgba(255, 255, 255, 0.1)"; ctx.fillRect(START_X + c * TILE_SIZE, START_Y + r * TILE_SIZE, TILE_SIZE, TILE_SIZE); ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1; ctx.strokeRect(START_X + c * TILE_SIZE, START_Y + r * TILE_SIZE, TILE_SIZE, TILE_SIZE); } }
    
    ctx.save(); if (screenShake > 0) { ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake); screenShake *= 0.9; if (screenShake < 0.5) screenShake = 0; }
    
    let nexusX = START_X + 0 * TILE_SIZE + TILE_SIZE / 2; let nexusY = START_Y + 1 * TILE_SIZE + TILE_SIZE / 2;
    ctx.fillStyle = "#0288d1"; ctx.beginPath(); ctx.arc(nexusX, nexusY, 30, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "bold 20px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText(`HP ${nexusHp}`, nexusX, nexusY + 7);
    if (countdown > 0) { ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(0, 0, logicalWidth, logicalHeight); ctx.fillStyle = "#ffdd57"; ctx.font = "bold 65px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText(`전투 시작 ${Math.ceil(countdown / 60)}초 전!`, centerX, centerY - 60); }
    
    monsters.forEach(m => {
        const drawSize = m.isBoss ? 120 : (m.radius * 3.5); ctx.save(); if (m.stunTimer > 0) ctx.filter = 'grayscale(100%)'; else if (m.type === "FIRE" && !m.isBoss) ctx.filter = 'sepia(100%) saturate(300%) hue-rotate(-50deg)';
        
        // ★ 일반 몬스터도 저장된 sheetSrc를 사용하도록 변경!
        let targetSheet = m.sheetSrc || (m.isBoss ? (stageDef.bossSheet || "boss_1.png") : "monster_1.png"); 
        const sheet = SHEET_CACHE[targetSheet];

        if (m.isBoss) { 
            const bossOffsetY = 30;
            if (sheet && sheet.complete && sheet.naturalWidth > 0) { const cols = 4; const rows = 4; const sw = sheet.naturalWidth / cols; const sh = sheet.naturalHeight / rows; let colIdx = Math.floor(frameCount / 15 + (m.animOffset||0)) % cols; let useRow = m.sheetRow !== undefined ? m.sheetRow : 0; ctx.drawImage(sheet, colIdx * sw, useRow * sh, sw, sh, m.x - drawSize / 2, m.y - drawSize / 2 - bossOffsetY, drawSize, drawSize); } 
            else { ctx.beginPath(); ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2); ctx.fillStyle = m.isFinalBoss ? "#ff00ff" : "#ffd700"; ctx.fill(); } 
            ctx.fillStyle = "#fff"; ctx.font = "bold 13px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText(m.isFinalBoss ? "FINAL BOSS" : "BOSS", m.x, m.y - drawSize/2 - 30); 
        } else { 
            if (sheet && sheet.complete && sheet.naturalWidth > 0) { const cols = 4; const rows = (targetSheet === 'monster_1.png') ? 6 : 4; const sw = sheet.naturalWidth / cols; const sh = sheet.naturalHeight / rows; let colIdx = Math.floor(frameCount / 15 + m.animOffset) % cols; ctx.drawImage(sheet, colIdx * sw, m.sheetRow * sh, sw, sh, m.x - drawSize / 2, m.y - drawSize / 2 - 5, drawSize, drawSize); } 
            else { ctx.beginPath(); ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2); ctx.fillStyle = "#d32f2f"; ctx.fill(); } 
        } 
        ctx.restore();
        // 💡 hpBarY 정의는 아래 딱 한 번만!
        let hpBarY = m.y - (m.isBoss ? (drawSize/2 - 10) : 25); 
        ctx.fillStyle = "black"; ctx.fillRect(m.x - 20, hpBarY, 40, 5); 
        ctx.fillStyle = "#00e676"; ctx.fillRect(m.x - 20, hpBarY, 40 * (m.hp / m.maxHp), 5);
        
        // 💡 상태이상 텍스트
        if (m.poisonTimer > 0) { ctx.fillStyle = "#69f0ae"; ctx.font = "12px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText("☠️독", m.x - 15, hpBarY - 10); }
        if (m.burnTimer > 0) { ctx.fillStyle = "#ff5252"; ctx.font = "12px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText("🔥불", m.x + 15, hpBarY - 10); }
    });

    projectiles.forEach(p => {
        ctx.save(); ctx.translate(p.x, p.y); 
        if (p.style === "meteor") { ctx.fillStyle = "rgba(255, 61, 0, 0.5)"; ctx.beginPath(); ctx.arc(0, 0, 35, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#ffdd57"; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill(); } 
        else { ctx.fillStyle = p.color || "#ffea00"; if (p.style === "spin_sword") { ctx.rotate(frameCount * 0.3); ctx.fillRect(-10, -2, 20, 4); ctx.fillRect(-2, -10, 4, 20); } else if (p.style === "blood_slash" || p.style === "light_beam") { ctx.fillRect(-10, -2, 20, 4); } else if (p.style === "heavy_arrow" || p.style === "sniper_bullet") { ctx.fillRect(-15, -2, 30, 4); } else { ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); } } 
        ctx.restore();
    });

    units.forEach(u => {
        const uDef = UNIT_DB[u.type]; if (!uDef) return; const sheet = SHEET_CACHE[uDef.sheetSrc]; 
        if (uDef.skill && uDef.skill.type.startsWith('aura_buff')) { ctx.strokeStyle = "rgba(255, 235, 59, 0.15)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(u.x, u.y, uDef.skill.radius + (Math.sin(frameCount*0.1)*5), 0, Math.PI * 2); ctx.stroke(); }
        if (draggingUnit && draggingUnit.id === u.id) ctx.restore();
        if (sheet && sheet.complete && sheet.naturalWidth > 0) { const cols = 4; const rows = 6; const sw = sheet.naturalWidth / cols; const sh = sheet.naturalHeight / rows; let colIdx = 0; if (u.attackAnimTimer > 13) colIdx = 1; else if (u.attackAnimTimer > 6) colIdx = 2; else if (u.attackAnimTimer > 0) colIdx = 3; ctx.drawImage(sheet, colIdx * sw, uDef.sheetRow * sh, sw, sh, u.x - 40, u.y - 40, 80, 80); } else { ctx.fillStyle = uDef.color || "#fff"; ctx.beginPath(); ctx.arc(u.x, u.y, 25, 0, Math.PI * 2); ctx.fill(); }
        // 아이템 도트 그리기 시작
        
        if (draggingUnit && draggingUnit.id === u.id) ctx.restore(); // 👈 2. 반투명 복구
    }); // 👈 3. 유닛(units) 반복문 종료 괄호

    // ★ 신규: VFX(시각 효과) 렌더링 로직
    vfxList.forEach((v, i) => {
        v.life--; let p = 1 - (v.life / v.maxLife); 
        ctx.save();
        if (v.type === 'explosion') {
            ctx.globalAlpha = 1 - p; ctx.fillStyle = v.color; ctx.beginPath(); ctx.arc(v.x, v.y, v.radius * p, 0, Math.PI*2); ctx.fill();
        } else if (v.type === 'slash') {
            ctx.globalAlpha = 1 - p; ctx.strokeStyle = v.color; ctx.lineWidth = 10 * (1 - p); ctx.beginPath(); ctx.moveTo(v.x - 80, v.y - 80); ctx.lineTo(v.x + 80, v.y + 80); ctx.stroke();
        } else if (v.type === 'execute') {
            ctx.globalAlpha = 1 - p; ctx.strokeStyle = v.color; ctx.lineWidth = 15 * (1 - p); ctx.beginPath(); ctx.moveTo(v.x - 50, v.y - 50); ctx.lineTo(v.x + 50, v.y + 50); ctx.moveTo(v.x + 50, v.y - 50); ctx.lineTo(v.x - 50, v.y + 50); ctx.stroke();
        } else if (v.type === 'ice') {
            ctx.globalAlpha = 1 - p; ctx.fillStyle = v.color || "#40c4ff"; ctx.fillRect(v.x - 30 - p*20, v.y - 30 - p*20, 60 + p*40, 60 + p*40);
        } else if (v.type === 'hit') {
            ctx.globalAlpha = 1 - p; ctx.fillStyle = v.color; ctx.beginPath(); ctx.arc(v.x, v.y, v.radius * Math.sin(p*Math.PI), 0, Math.PI*2); ctx.fill();
        } else if (v.type === 'flash') {
            ctx.globalAlpha = (1 - p) * 0.5; ctx.fillStyle = v.color; ctx.fillRect(0, 0, logicalWidth, logicalHeight);
        }
        ctx.restore();
    });
    vfxList = vfxList.filter(v => v.life > 0);

    ctx.restore(); 
    ctx.fillStyle = "#ffdd57"; ctx.font = "bold 26px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText(`보유 골드: ${Math.floor(myGold)} G  |  싱글 훈련소`, centerX, 80); ctx.fillStyle = "#fff"; ctx.font = "bold 20px Malgun Gothic"; ctx.fillText(`${STAGE_DB[currentStage].name} - 웨이브 ${currentWave} / ${maxWave}`, centerX, 40); ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.fillRect(10, 100, 80, 30); ctx.fillStyle = "#fff"; ctx.font = "bold 14px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText(isSynergyOpen ? "▲ 시너지" : "▼ 시너지", 50, 120);
    if (isSynergyOpen) { ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; ctx.beginPath(); ctx.roundRect(10, 135, 700, 60, 10); ctx.fill(); let sIdx = 0; const sNames = { SWORD: "검사", ARCHER: "궁수", MAGE: "마법사", SHIELD: "방패병", NINJA: "닌자", GUNNER: "총잡이" }; for (const [trait, count] of Object.entries(activeSynergies)) { if (count > 0) { let dx = 30 + (sIdx % 4) * 170; let dy = 160 + (sIdx >= 4 ? 25 : 0); ctx.fillStyle = count >= 3 ? "#ffca28" : "#aaa"; ctx.font = count >= 3 ? "bold 15px Malgun Gothic" : "15px Malgun Gothic"; ctx.textAlign = "left"; ctx.fillText(`${sNames[trait]} (${count}/3)`, dx, dy); sIdx++; } } }
    if (waveState === 'COUNTDOWN') { ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 170, logicalWidth, 60); ctx.fillStyle = "#69f0ae"; ctx.font = "bold 24px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText(`다음 웨이브 정비까지 ${Math.ceil(waveTimer / 60)}초!`, centerX, 208); }
    
    // 💡 선택된 영웅 사거리 표시 복구! (아이템 사거리 증가량까지 계산)
    if (selectedUnit) {
        let uDef = UNIT_DB[selectedUnit.type];
        if (uDef) {
            let buffedRange = uDef.range;
            if (selectedUnit.items) {
                selectedUnit.items.forEach(itemId => {
                    let itemDef = ITEM_DB[itemId];
                    if (itemDef && itemDef.type === "rng") buffedRange += itemDef.value;
                    if (itemDef && itemDef.stat && itemDef.stat.rangeBonus) buffedRange += itemDef.stat.rangeBonus;
                });
            }
            if (typeof RELIC_ENGINE !== 'undefined') buffedRange += RELIC_ENGINE.getStatMods(PlayerProfile.relics).rangeBonus;

            ctx.beginPath();
            ctx.arc(selectedUnit.x, selectedUnit.y, buffedRange, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255, 255, 255, 0.15)"; ctx.fill(); // 반투명 흰색 원
            ctx.strokeStyle = "rgba(255, 255, 255, 0.6)"; ctx.lineWidth = 1; ctx.stroke(); // 테두리 선
        }
    }

    ctx.fillStyle = "#222"; ctx.fillRect(0, 990, logicalWidth, 290); ctx.fillStyle = "#aaa"; ctx.font = "bold 19px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText("📦 아이템함 (보스 처치 시 획득)", centerX, 1010);
    
    for (let i = 0; i < 5; i++) { 
        let ix = 135 + i * 90; let iy = 1030; 
        ctx.fillStyle = "#333"; ctx.fillRect(ix, iy, 70, 70); 
        ctx.strokeStyle = "#555"; ctx.lineWidth = 2; ctx.strokeRect(ix, iy, 70, 70); 
        if (myInventory[i] && (!draggingItem || draggingItem.index !== i)) { 
            let item = ITEM_DB[myInventory[i]]; 
            if (item) { 
                const itemSheet = SHEET_CACHE['items.png'];
                // 💡 에러 방지용 안전장치! (&& itemSheet.naturalWidth > 0)
                if (itemSheet && itemSheet.complete && itemSheet.naturalWidth > 0) {
                    const sw = itemSheet.naturalWidth / 4; const sh = itemSheet.naturalHeight / 4;
                    ctx.drawImage(itemSheet, item.sheetCol * sw, item.sheetRow * sh, sw, sh, ix + 5, iy + 5, 60, 60);
                }
            } 
        } 
    }
    if (draggingItem) { 
        let item = ITEM_DB[draggingItem.id]; 
        if (item) { 
            const itemSheet = SHEET_CACHE['items.png'];
            if (itemSheet && itemSheet.complete) {
                const sw = itemSheet.naturalWidth / 4; const sh = itemSheet.naturalHeight / 4;
                ctx.drawImage(itemSheet, item.sheetCol * sw, item.sheetRow * sh, sw, sh, draggingItem.x - 30, draggingItem.y - 30, 60, 60);
            }
        } 
    }
    // 💡 방금 부활한 영웅 정보창 렌더링 코드!!
    drawFixedUnitPanel(ctx, selectedUnit, UNIT_DB, ITEM_DB, mySide, PlayerProfile, activeSynergies, myGold);
    // ★ 싱글플레이 몬스터 정보 툴팁 UI
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

        if (m.isBoss && STAGE_DB[currentStage] && STAGE_DB[currentStage].ccImmune) {
            ctx.fillStyle = "#ffeb3b"; ctx.fillText(`⚠️ 상태이상(CC기) 완전 면역`, 250, 955);
        }
    }
    gameButtons.forEach(btn => btn.draw(ctx)); drawTooltip(ctx, currentTooltip, mouseX, mouseY); renderFloatingTexts(ctx); requestAnimationFrame(gameLoop);
}

// ==========================================
// 🌟 신규 시스템: 스타팅 영웅 선택 로직 🌟
// ==========================================
let chosenStartingHero = null;

function createHeroSelectModal() {
    const modal = document.createElement('div');
    modal.id = 'heroSelectModal';
    modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:9999; flex-direction:column; align-items:center; justify-content:center; font-family:"Malgun Gothic", sans-serif;';
    
    let html = `<h2 style="color:#ffdd57; margin-bottom:20px; text-shadow: 2px 2px 4px #000;">✨ 주력 스타팅 영웅 선택 ✨</h2>`;
    html += `<div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; max-width: 600px; padding: 20px;">`;
    
    const heroes = [
        { id: 'SWORD_1', name: '⚔️ 훈련병 (검사)', color: '#eeeeee', desc: '안정적인 밸런스의 근접 딜러' },
        { id: 'ARCHER_1', name: '🏹 초보 궁수', color: '#a1887f', desc: '긴 사거리로 안전한 원거리 딜러' },
        { id: 'MAGE_1', name: '🪄 견습 법사', color: '#81d4fa', desc: '강력한 스킬과 군중 제어(CC)' },
        { id: 'SHIELD_1', name: '🛡️ 훈련 방패', color: '#b0bec5', desc: '적을 기절시키는 단단한 탱커' },
        { id: 'GUNNER_1', name: '🔫 초보 총잡이', color: '#ffe082', desc: '빠른 공격속도의 지속 딜러' },
        { id: 'NINJA_1', name: '🥷 초보 도적', color: '#9e9e9e', desc: '독과 크리티컬로 보스를 녹이는 암살자' }
    ];

    heroes.forEach(h => {
        html += `<div onclick="startWithHero('${h.id}')" style="background:#222; border:2px solid ${h.color}; padding:15px; border-radius:10px; cursor:pointer; text-align:center; transition:0.2s;" onmouseover="this.style.background='#444'" onmouseout="this.style.background='#222'">
            <div style="font-size:18px; font-weight:bold; color:${h.color}; margin-bottom:5px;">${h.name}</div>
            <div style="font-size:12px; color:#aaa;">${h.desc}</div>
        </div>`;
    });

    html += `</div>`;
    html += `<button onclick="document.getElementById('heroSelectModal').style.display='none'" style="margin-top:20px; padding:10px 40px; font-size:16px; background:#d32f2f; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold; height:50px; width:150px;">취소</button>`;
    
    modal.innerHTML = html;
    document.body.appendChild(modal);
}

// 창이 로드될 때 팝업창 미리 만들어두기
window.addEventListener('load', createHeroSelectModal);

// 영웅을 클릭하면 실행되는 함수
window.startWithHero = function(heroId) {
    chosenStartingHero = heroId; // 선택한 영웅 기억
    document.getElementById('heroSelectModal').style.display = 'none'; // 창 닫기
    document.getElementById('lobby').style.display = 'none'; // 로비 닫기
    document.getElementById('gameContainer').style.display = 'block'; // 게임 화면 열기
    resizeCanvas();
    if (audioCtx.state === 'suspended') audioCtx.resume(); 
    startGame(); // 게임 진짜 시작!
}

