// [ data.js ] - 유저 데이터 및 유닛 스탯 DB

const PlayerProfile = {
    soulStones: 0, 
    gold: 500, 
    unlockedStage: 1, 
    passives: { startGoldLvl: 0, attackBoostLvl: 0 },
    // ★ PRIEST가 삭제되고 GUNNER(총잡이)로 대체되었습니다.
    mastery: { SWORD: 0, ARCHER: 0, MAGE: 0, SHIELD: 0, ASSASSIN: 0, CANNON: 0, GUNNER: 0 },
    relics: {} 
};

const RELIC_DB = {
    "R1": { id: "R1", name: "낡은 전사의 검", grade: "C", desc: "모든 유닛 데미지 +10%", color: "#9e9e9e", weight: 500 },
    "R2": { id: "R2", name: "신속의 깃털", grade: "B", desc: "모든 유닛 쿨타임 -10%", color: "#4caf50", weight: 300 },
    "R3": { id: "R3", name: "황금 두꺼비", grade: "A", desc: "몬스터 처치 시 골드 +5", color: "#2196f3", weight: 150 },
    "R4": { id: "R4", name: "시작의 나팔", grade: "S", desc: "시작 시 3성 유닛 즉시 스폰!", color: "#ffca28", weight: 45 },
    "R5": { id: "R5", name: "절대자의 왕관", grade: "SS", desc: "★데미지 2배 증폭★", color: "#ff1744", weight: 5 } 
};

const UNIT_DB = {
    // --- 1. 검사 트리 ---
    "SWORD_1": { name: "훈련병", trait: "SWORD", color: "#ffffff", cost: 0, upgradeCost: 150, sellPrice: 50, next: "SWORD_2", damage: 15, range: 130, cooldown: 60, imgSrc: "common_swordsman_bear.png" },
    "SWORD_2": { name: "정예병", trait: "SWORD", color: "#64b5f6", cost: 0, upgradeCost: 400, sellPrice: 120, next: ["SWORD_3A", "SWORD_3B"], damage: 40, range: 150, cooldown: 50, imgSrc: "common_swordsman_bear.png" },
    "SWORD_3A": { name: "성기사(한방)", trait: "SWORD", color: "#ffca28", cost: 0, upgradeCost: null, sellPrice: 300, next: null, damage: 180, range: 160, cooldown: 60, imgSrc: "common_swordsman_bear.png" },
    "SWORD_3B": { name: "광전사(공속)", trait: "SWORD", color: "#e53935", cost: 0, upgradeCost: null, sellPrice: 300, next: null, damage: 45, range: 140, cooldown: 15, imgSrc: "common_swordsman_bear.png" },

    // --- 2. 궁수 트리 ---
    "ARCHER_1": { name: "초보 궁수", trait: "ARCHER", color: "#81c784", cost: 0, upgradeCost: 150, sellPrice: 50, next: "ARCHER_2", damage: 8, range: 200, cooldown: 30, imgSrc: "common_archer_fox.png" },
    "ARCHER_2": { name: "숙련 궁수", trait: "ARCHER", color: "#4caf50", cost: 0, upgradeCost: 400, sellPrice: 120, next: ["ARCHER_3A", "ARCHER_3B"], damage: 20, range: 220, cooldown: 25, imgSrc: "common_archer_fox.png" },
    "ARCHER_3A": { name: "저격수(사거리)", trait: "ARCHER", color: "#1b5e20", cost: 0, upgradeCost: null, sellPrice: 300, next: null, damage: 100, range: 450, cooldown: 40, imgSrc: "common_archer_fox.png" },
    "ARCHER_3B": { name: "속사수(연사)", trait: "ARCHER", color: "#b2ff59", cost: 0, upgradeCost: null, sellPrice: 300, next: null, damage: 25, range: 220, cooldown: 8, imgSrc: "common_archer_fox.png" },

    // --- 3. 마법사 트리 ---
    "MAGE_1": { name: "견습 법사", trait: "MAGE", color: "#4fc3f7", cost: 0, upgradeCost: 200, sellPrice: 50, next: "MAGE_2", damage: 30, range: 150, cooldown: 90, effect: "slow", imgSrc: "common_mage_rabbit.png" },
    "MAGE_2": { name: "숙련 법사", trait: "MAGE", color: "#039be5", cost: 0, upgradeCost: 450, sellPrice: 120, next: ["MAGE_3A", "MAGE_3B"], damage: 80, range: 160, cooldown: 80, effect: "slow", imgSrc: "common_mage_rabbit.png" },
    "MAGE_3A": { name: "빙결사(홀딩)", trait: "MAGE", color: "#01579b", cost: 0, upgradeCost: null, sellPrice: 300, next: null, damage: 120, range: 180, cooldown: 70, effect: "deep_slow", imgSrc: "common_mage_rabbit.png" },
    "MAGE_3B": { name: "화염술사(폭딜)", trait: "MAGE", color: "#ff5722", cost: 0, upgradeCost: null, sellPrice: 300, next: null, damage: 350, range: 170, cooldown: 75, effect: null, imgSrc: "common_mage_rabbit.png" },

    // --- 4. 방패병 트리 ---
    "SHIELD_1": { name: "초보 방패", trait: "SHIELD", color: "#b0bec5", cost: 0, upgradeCost: 150, sellPrice: 50, next: "SHIELD_2", damage: 5, range: 110, cooldown: 70, effect: "stun", imgSrc: "common_shield_mole.png" },
    "SHIELD_2": { name: "중갑 방패", trait: "SHIELD", color: "#78909c", cost: 0, upgradeCost: 350, sellPrice: 120, next: ["SHIELD_3A", "SHIELD_3B"], damage: 15, range: 120, cooldown: 65, effect: "stun", imgSrc: "common_shield_mole.png" },
    "SHIELD_3A": { name: "수호자(기절)", trait: "SHIELD", color: "#455a64", cost: 0, upgradeCost: null, sellPrice: 300, next: null, damage: 30, range: 130, cooldown: 60, effect: "deep_stun", imgSrc: "common_shield_mole.png" },
    "SHIELD_3B": { name: "반사방패(딜링)", trait: "SHIELD", color: "#b71c1c", cost: 0, upgradeCost: null, sellPrice: 300, next: null, damage: 150, range: 110, cooldown: 50, effect: null, imgSrc: "common_shield_mole.png" },

    // --- 5. 암살자 트리 ---
    "ASSASSIN_1": { name: "초보 도적", trait: "ASSASSIN", color: "#ce93d8", cost: 0, upgradeCost: 200, sellPrice: 50, next: "ASSASSIN_2", damage: 25, range: 120, cooldown: 45, imgSrc: "common_assassin_cat.png" },
    "ASSASSIN_2": { name: "닌자", trait: "ASSASSIN", color: "#ab47bc", cost: 0, upgradeCost: 400, sellPrice: 120, next: ["ASSASSIN_3A", "ASSASSIN_3B"], damage: 60, range: 130, cooldown: 35, imgSrc: "common_assassin_cat.png" },
    "ASSASSIN_3A": { name: "그림자(크리)", trait: "ASSASSIN", color: "#6a1b9a", cost: 0, upgradeCost: null, sellPrice: 300, next: null, damage: 120, range: 140, cooldown: 30, imgSrc: "common_assassin_cat.png" },
    "ASSASSIN_3B": { name: "맹독(초연사)", trait: "ASSASSIN", color: "#00c853", cost: 0, upgradeCost: null, sellPrice: 300, next: null, damage: 30, range: 130, cooldown: 12, imgSrc: "common_assassin_cat.png" },

    // --- 6. 포병 트리 ---
    "CANNON_1": { name: "해적", trait: "CANNON", color: "#ffab91", cost: 0, upgradeCost: 250, sellPrice: 50, next: "CANNON_2", damage: 20, range: 160, cooldown: 100, effect: "splash", imgSrc: "common_cannon_penguin.png" },
    "CANNON_2": { name: "포병", trait: "CANNON", color: "#ff7043", cost: 0, upgradeCost: 450, sellPrice: 120, next: ["CANNON_3A", "CANNON_3B"], damage: 50, range: 170, cooldown: 90, effect: "splash", imgSrc: "common_cannon_penguin.png" },
    "CANNON_3A": { name: "대포(대형폭발)", trait: "CANNON", color: "#d84315", cost: 0, upgradeCost: null, sellPrice: 300, next: null, damage: 180, range: 190, cooldown: 110, effect: "deep_splash", imgSrc: "common_cannon_penguin.png" },
    "CANNON_3B": { name: "개틀링(소형연사)", trait: "CANNON", color: "#ff9800", cost: 0, upgradeCost: null, sellPrice: 300, next: null, damage: 40, range: 160, cooldown: 25, effect: "splash", imgSrc: "common_cannon_penguin.png" },

    // --- 7. ★신규 추가: 총잡이 트리 (힐러 삭제) ---
    "GUNNER_1": { name: "초보 총잡이", trait: "GUNNER", color: "#8d6e63", cost: 0, upgradeCost: 150, sellPrice: 50, next: "GUNNER_2", damage: 12, range: 180, cooldown: 35, imgSrc: null },
    "GUNNER_2": { name: "베테랑", trait: "GUNNER", color: "#5d4037", cost: 0, upgradeCost: 350, sellPrice: 120, next: ["GUNNER_3A", "GUNNER_3B"], damage: 30, range: 200, cooldown: 30, imgSrc: null },
    "GUNNER_3A": { name: "스나이퍼", trait: "GUNNER", color: "#3e2723", cost: 0, upgradeCost: null, sellPrice: 300, next: null, damage: 150, range: 500, cooldown: 60, imgSrc: null },
    "GUNNER_3B": { name: "머신건", trait: "GUNNER", color: "#dd2c00", cost: 0, upgradeCost: null, sellPrice: 300, next: null, damage: 20, range: 220, cooldown: 10, imgSrc: null }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PlayerProfile, RELIC_DB, UNIT_DB };
}