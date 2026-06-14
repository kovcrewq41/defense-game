// ==========================================
// 유닛 데이터베이스 (UNIT_DB)
// ==========================================
const UNIT_DB = {
    // ------------------------------------------
    // 🛡️ 1. 검사 계열
    // ------------------------------------------
    "SWORD_1": { name: "훈련병", trait: "SWORD", upgradeCost: 200, damage: 25, range: 90, cooldown: 45, sheetSrc: "anim_chars_1.png", sheetRow: 0, projectile: null, next: "SWORD_2", sellPrice: 50 },
    "SWORD_2": { name: "정예병", trait: "SWORD", upgradeCost: 400, damage: 55, range: 90, cooldown: 40, sheetSrc: "anim_chars_1.png", sheetRow: 0, projectile: null, next: ["SWORD_3A", "SWORD_3B"], sellPrice: 150 },
    "SWORD_3A": { name: "성기사", trait: "SWORD", upgradeCost: null, damage: 120, range: 100, cooldown: 50, sheetSrc: "anim_chars_1.png", sheetRow: 0, projectile: { style: "heavy_slash", color: "#ffd700", size: 12, speed: 0 }, sellPrice: 350 },
    "SWORD_3B": { name: "광전사", trait: "SWORD", upgradeCost: null, damage: 90, range: 90, cooldown: 25, sheetSrc: "anim_chars_1.png", sheetRow: 0, projectile: null, sellPrice: 350 },

    // ------------------------------------------
    // 🏹 2. 궁수 계열
    // ------------------------------------------
    "ARCHER_1": { name: "초보 궁수", trait: "ARCHER", upgradeCost: 200, damage: 18, range: 250, cooldown: 50, sheetSrc: "anim_chars_1.png", sheetRow: 1, projectile: { style: "arrow", color: "#ffffff", size: 6, speed: 12 }, next: "ARCHER_2", sellPrice: 50 },
    "ARCHER_2": { name: "숙련 궁수", trait: "ARCHER", upgradeCost: 400, damage: 40, range: 280, cooldown: 45, sheetSrc: "anim_chars_1.png", sheetRow: 1, projectile: { style: "arrow", color: "#e0e0e0", size: 7, speed: 14 }, next: ["ARCHER_3A", "ARCHER_3B"], sellPrice: 150 },
    "ARCHER_3A": { name: "저격수", trait: "ARCHER", upgradeCost: null, damage: 160, range: 400, cooldown: 80, sheetSrc: "anim_chars_1.png", sheetRow: 1, projectile: { style: "pierce_arrow", color: "#ff3333", size: 9, speed: 20 }, sellPrice: 350 },
    "ARCHER_3B": { name: "속사수", trait: "ARCHER", upgradeCost: null, damage: 65, range: 260, cooldown: 20, sheetSrc: "anim_chars_1.png", sheetRow: 1, projectile: { style: "fast_arrow", color: "#33ffff", size: 5, speed: 18 }, sellPrice: 350 },

    // ------------------------------------------
    // 🧱 3. 방패 계열
    // ------------------------------------------
    "SHIELD_1": { name: "초보 방패", trait: "SHIELD", upgradeCost: 200, damage: 12, range: 80, cooldown: 60, sheetSrc: "anim_chars_1.png", sheetRow: 2, projectile: null, next: "SHIELD_2", sellPrice: 50 },
    "SHIELD_2": { name: "중갑 방패", trait: "SHIELD", upgradeCost: 400, damage: 28, range: 80, cooldown: 55, sheetSrc: "anim_chars_1.png", sheetRow: 2, projectile: null, next: ["SHIELD_3A", "SHIELD_3B"], sellPrice: 150 },
    "SHIELD_3A": { name: "수호자", trait: "SHIELD", upgradeCost: null, damage: 60, range: 90, cooldown: 50, sheetSrc: "anim_chars_1.png", sheetRow: 2, projectile: { style: "stun_wave", color: "#ffffff", size: 15, speed: 0 }, sellPrice: 350 },
    "SHIELD_3B": { name: "반사방패", trait: "SHIELD", upgradeCost: null, damage: 85, range: 80, cooldown: 45, sheetSrc: "anim_chars_1.png", sheetRow: 2, projectile: { style: "reflect", color: "#ffaa00", size: 8, speed: 5 }, sellPrice: 350 },

    // ------------------------------------------
    // 🔮 4. 마법사 계열
    // ------------------------------------------
    "MAGE_1": { name: "견습 법사", trait: "MAGE", upgradeCost: 200, damage: 22, range: 220, cooldown: 60, sheetSrc: "anim_chars_1.png", sheetRow: 3, projectile: { style: "magic_ball", color: "#a040ff", size: 8, speed: 8 }, next: "MAGE_2", sellPrice: 50 },
    "MAGE_2": { name: "숙련 법사", trait: "MAGE", upgradeCost: 400, damage: 48, range: 240, cooldown: 55, sheetSrc: "anim_chars_1.png", sheetRow: 3, projectile: { style: "magic_ball", color: "#bc70ff", size: 10, speed: 9 }, next: ["MAGE_3A", "MAGE_3B"], sellPrice: 150 },
    "MAGE_3A": { name: "빙결사", trait: "MAGE", upgradeCost: null, damage: 90, range: 260, cooldown: 50, sheetSrc: "anim_chars_1.png", sheetRow: 3, projectile: { style: "ice_orb", color: "#00bfff", size: 12, speed: 10 }, sellPrice: 350 },
    "MAGE_3B": { name: "화염술사", trait: "MAGE", upgradeCost: null, damage: 180, range: 250, cooldown: 70, sheetSrc: "anim_chars_1.png", sheetRow: 3, projectile: { style: "fire_bomb", color: "#ff4500", size: 16, speed: 7 }, sellPrice: 350 },

    // ------------------------------------------
    // 🔫 5. 포병/총잡이 계열
    // ------------------------------------------
    "GUNNER_1": { name: "초보 총잡이", trait: "GUNNER", upgradeCost: 200, damage: 20, range: 200, cooldown: 40, sheetSrc: "anim_chars_1.png", sheetRow: 4, projectile: { style: "bullet", color: "#ffff00", size: 4, speed: 16 }, next: "GUNNER_2", sellPrice: 50 },
    "GUNNER_2": { name: "베테랑", trait: "GUNNER", upgradeCost: 400, damage: 45, range: 220, cooldown: 35, sheetSrc: "anim_chars_1.png", sheetRow: 4, projectile: { style: "bullet", color: "#ffff55", size: 4, speed: 18 }, next: ["GUNNER_3A", "GUNNER_3B"], sellPrice: 150 },
    "GUNNER_3A": { name: "스나이퍼", trait: "GUNNER", upgradeCost: null, damage: 200, range: 380, cooldown: 75, sheetSrc: "anim_chars_1.png", sheetRow: 4, projectile: { style: "laser_bullet", color: "#ff0055", size: 5, speed: 25 }, sellPrice: 350 },
    "GUNNER_3B": { name: "머신건", trait: "GUNNER", upgradeCost: null, damage: 50, range: 200, cooldown: 12, sheetSrc: "anim_chars_1.png", sheetRow: 4, projectile: { style: "bullet", color: "#ffcc00", size: 3, speed: 20 }, sellPrice: 350 },

    // ------------------------------------------
    // 🥷 6. 닌자 계열
    // ------------------------------------------
    "NINJA_1": { name: "초보 도적", trait: "NINJA", upgradeCost: 200, damage: 22, range: 140, cooldown: 35, sheetSrc: "anim_chars_1.png", sheetRow: 5, projectile: { style: "shuriken", color: "#cccccc", size: 6, speed: 13 }, next: "NINJA_2", sellPrice: 50 },
    "NINJA_2": { name: "닌자", trait: "NINJA", upgradeCost: 400, damage: 46, range: 160, cooldown: 30, sheetSrc: "anim_chars_1.png", sheetRow: 5, projectile: { style: "shuriken", color: "#dddddd", size: 7, speed: 15 }, next: ["NINJA_3A", "NINJA_3B"], sellPrice: 150 },
    "NINJA_3A": { name: "그림자", trait: "NINJA", upgradeCost: null, damage: 105, range: 180, cooldown: 22, sheetSrc: "anim_chars_1.png", sheetRow: 5, projectile: { style: "shadow_blade", color: "#555555", size: 8, speed: 17 }, sellPrice: 350 },
    "NINJA_3B": { name: "맹독", trait: "NINJA", upgradeCost: null, damage: 80, range: 160, cooldown: 28, sheetSrc: "anim_chars_1.png", sheetRow: 5, projectile: { style: "poison_dart", color: "#00ff33", size: 6, speed: 16 }, sellPrice: 350 }
};