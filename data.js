// ★ 유물에 태그(type, target)가 붙어, 이제 엔진이 알아서 효과를 적용합니다!
const RELIC_DB = {
    "R1": { name: "전사의 장갑", desc: "공격력 {val}% 증가", baseVal: 0.1, color: "#ff5252", grade: "A", weight: 400, type: "stat_boost", target: "damage", calc: "sum" },
    "R2": { name: "신속의 부츠", desc: "공격속도 {val}% 증가", baseVal: 0.1, color: "#ffeb3b", grade: "S", weight: 350, type: "stat_boost", target: "cooldown", calc: "multiply_reduce" },
    "R3": { name: "황금 탐지기", desc: "골드 획득량 {val}% 증가", baseVal: 0.5, color: "#ffeb3b", grade: "S", weight: 150, type: "gold_bonus" },
    "R4": { name: "영웅의 부름", desc: "게임 시작 시 3성 영웅 {val}마리 지급", baseVal: 1, color: "#ff1744", grade: "SSS", weight: 50, type: "start_spawn", targetTier: 3 },
    "R5": { name: "절대자의 검", desc: "공격력 {val}% 추가 증가", baseVal: 1.0, color: "#ff1744", grade: "SSS", weight: 30, type: "stat_boost", target: "damage", calc: "sum" },
    "R6": { name: "매의 눈", desc: "모든 유닛 사거리 +{val}", baseVal: 0.1, color: "#00e5ff", grade: "S", weight: 150, type: "stat_boost", target: "range", calc: "sum_flat" },
    "R7": { name: "자본주의", desc: "유닛 판매 환불액 {val}% 증가", baseVal: 0.1, color: "#90a4ae", grade: "D", weight: 250, type: "sell_bonus" },
    "R8": { name: "도깨비 방망이", desc: "공격속도 {val}% 추가 증가", baseVal: 0.5, color: "#e040fb", grade: "SS", weight: 40, type: "stat_boost", target: "cooldown", calc: "multiply_reduce" },
    "R9": { name: "고급의 부름", desc: "게임 시작 시 2성 영웅 {val}마리 지급", baseVal: 1, color: "#e040fb", grade: "SS", weight: 70, type: "start_spawn", targetTier: 2 }
};

const ITEM_DB = { 
    "SWORD": { name: "B.F대검", color: "#ff5252", symbol: "⚔️", type: "dmg", value: 1.2 }, 
    "BOW": { name: "곡궁", color: "#69f0ae", symbol: "🏹", type: "spd", value: 0.85 }, 
    "STAFF": { name: "지팡이", color: "#40c4ff", symbol: "🪄", type: "rng", value: 30 },
    "AXE": { name: "거인 도끼", color: "#ff9800", symbol: "🪓", type: "dmg", value: 1.4 }, 
    "BOOTS": { name: "광전사의 신발", color: "#e040fb", symbol: "👢", type: "spd", value: 0.7 } 
};

const UNIT_DB = {
    // ⚔️ 검사 트리 (검기 / 빛의 파동)
    "SWORD_1": { name: "훈련병 (일반)", trait: "SWORD", upgradeCost: 200, upgradeChance: 0.70, damage: 25, range: 120, cooldown: 45, splashRadius: 40, sheetSrc: "anim_chars_1.png", sheetRow: 0, next: "SWORD_2", sellPrice: 50, damageType: "PHYSICAL",
        projectile: { style: "blood_slash", color: "#eeeeee" } },
    "SWORD_2": { name: "정예 검사 (고급)", trait: "SWORD", upgradeCost: 400, upgradeChance: 0.60, damage: 60, range: 120, cooldown: 40, splashRadius: 50, sheetSrc: "anim_chars_2.png", sheetRow: 0, next: "SWORD_3", sellPrice: 150, damageType: "PHYSICAL",
        projectile: { style: "blood_slash", color: "#cfd8dc" } },
    "SWORD_3": { name: "마검사 (희귀)", trait: "SWORD", upgradeCost: 800, upgradeChance: 0.25, damage: 130, range: 130, cooldown: 35, splashRadius: 60, sheetSrc: "anim_chars_3.png", sheetRow: 0, next: "SWORD_4", sellPrice: 350, damageType: "PHYSICAL",
        skillName: "🔥 폭발 베기", skillDesc: "15% 확률로 3배의 데미지를 주는 거대 스플래쉬 공격을 합니다.", skill: { type: "proc_splash", chance: 0.15, mult: 3.0, radiusMult: 2.0 },
        projectile: { style: "blood_slash", color: "#ff5252" } },
    "SWORD_4": { name: "소드마스터 (전설)", trait: "SWORD", upgradeCost: 1500, upgradeChance: 0.10, damage: 300, range: 140, cooldown: 25, splashRadius: 70, sheetSrc: "anim_chars_4.png", sheetRow: 0, next: "SWORD_5", sellPrice: 800, damageType: "PHYSICAL",
        skillName: "⚡ 진공참", skillDesc: "20% 확률로 일직선상의 모든 적을 관통하는 검기를 날립니다.", skill: { type: "proc_pierce", chance: 0.20, mult: 2.5 },
        projectile: { style: "light_beam", color: "#00e5ff" } },
    "SWORD_5": { name: "빛의 심판관 [히든]", trait: "SWORD", upgradeCost: null, damage: 800, range: 160, cooldown: 20, splashRadius: 100, sheetSrc: "anim_chars_5.png", sheetRow: 0, sellPrice: 1500, isHidden: true, damageType: "PHYSICAL",
        skillName: "✨ 심판의 일격", skillDesc: "5% 확률로 타격한 일반 몬스터를 즉사시킵니다. (보스에겐 10배 피해)", skill: { type: "proc_execute", chance: 0.05, bossMult: 10.0 },
        projectile: { style: "light_beam", color: "#ffea00" } },
    
    // 🏹 궁수 트리 (나무 화살 -> 정령의 화살)
    "ARCHER_1": { name: "초보 궁수 (일반)", trait: "ARCHER", upgradeCost: 200, upgradeChance: 0.70, damage: 28, range: 250, cooldown: 40, sheetSrc: "anim_chars_1.png", sheetRow: 1, next: "ARCHER_2", sellPrice: 50, damageType: "PHYSICAL",
        projectile: { style: "heavy_arrow", color: "#a1887f" } },
    "ARCHER_2": { name: "숙련 궁수 (고급)", trait: "ARCHER", upgradeCost: 400, upgradeChance: 0.60, damage: 65, range: 280, cooldown: 35, sheetSrc: "anim_chars_2.png", sheetRow: 1, next: "ARCHER_3", sellPrice: 150, damageType: "PHYSICAL",
        projectile: { style: "heavy_arrow", color: "#8d6e63" } },
    "ARCHER_3": { name: "정찰대원 (희귀)", trait: "ARCHER", upgradeCost: 800, upgradeChance: 0.25, damage: 130, range: 320, cooldown: 35, sheetSrc: "anim_chars_3.png", sheetRow: 1, next: "ARCHER_4", sellPrice: 350, damageType: "PHYSICAL",
        skillName: "🏹 멀티 샷", skillDesc: "공격 시 3명의 적을 동시에 타격합니다.", skill: { type: "passive_multishot", targets: 3 },
        projectile: { style: "heavy_arrow", color: "#ffca28" } },
    "ARCHER_4": { name: "폭풍 궁수 (전설)", trait: "ARCHER", upgradeCost: 1500, upgradeChance: 0.10, damage: 260, range: 350, cooldown: 30, sheetSrc: "anim_chars_4.png", sheetRow: 1, next: "ARCHER_5", sellPrice: 800, damageType: "PHYSICAL",
        skillName: "🌪️ 넉백 화살", skillDesc: "20% 확률로 적을 뒤로 밀쳐내며(넉백) 스턴시킵니다.", skill: { type: "proc_knockback", chance: 0.20, pushDist: 50 },
        projectile: { style: "heavy_arrow", color: "#69f0ae" } },
    "ARCHER_5": { name: "엘프 왕 [히든]", trait: "ARCHER", upgradeCost: null, damage: 600, range: 500, cooldown: 20, sheetSrc: "anim_chars_5.png", sheetRow: 1, sellPrice: 1500, isHidden: true, damageType: "PHYSICAL",
        skillName: "🌟 헤드샷", skillDesc: "15% 확률로 10배의 크리티컬 피해를 입힙니다.", skill: { type: "proc_crit", chance: 0.15, mult: 10.0 },
        projectile: { style: "heavy_arrow", color: "#00e676" } },
    
    // 🪄 마법사 트리 (푸른 마법구 -> 불/얼음/보라빛 마법구)
    "MAGE_1": { name: "견습 법사 (일반)", trait: "MAGE", upgradeCost: 200, upgradeChance: 0.70, damage: 35, range: 220, cooldown: 55, sheetSrc: "anim_chars_1.png", sheetRow: 3, next: "MAGE_2", sellPrice: 50, damageType: "MAGIC",
        projectile: { style: "default", color: "#81d4fa" } },
    "MAGE_2": { name: "화염술사 (고급)", trait: "MAGE", upgradeCost: 400, upgradeChance: 0.60, damage: 75, range: 240, cooldown: 50, sheetSrc: "anim_chars_2.png", sheetRow: 3, next: "MAGE_3", sellPrice: 150, damageType: "MAGIC",
        projectile: { style: "default", color: "#ff8a65" } },
    "MAGE_3": { name: "빙결사 (희귀)", trait: "MAGE", upgradeCost: 800, upgradeChance: 0.25, damage: 150, range: 260, cooldown: 45, sheetSrc: "anim_chars_3.png", sheetRow: 3, next: "MAGE_4", sellPrice: 350, damageType: "MAGIC",
        skillName: "❄️ 빙결", skillDesc: "20% 확률로 적을 1.5초간 꽁꽁 얼려 기절시킵니다.", skill: { type: "proc_stun", chance: 0.20, duration: 90 },
        projectile: { style: "default", color: "#40c4ff" } },
    "MAGE_4": { name: "아크메이지 (전설)", trait: "MAGE", upgradeCost: 1500, upgradeChance: 0.10, damage: 320, range: 280, cooldown: 45, sheetSrc: "anim_chars_4.png", sheetRow: 3, next: "MAGE_5", sellPrice: 800, damageType: "MAGIC",
        skillName: "☄️ 메테오", skillDesc: "10% 확률로 거대한 운석을 떨어뜨려 화면 절반에 폭딜을 넣습니다.", skill: { type: "proc_meteor", chance: 0.10, mult: 5.0, radius: 250 },
        projectile: { style: "default", color: "#ea80fc" } },
    "MAGE_5": { name: "절대자 [히든]", trait: "MAGE", upgradeCost: null, damage: 800, range: 350, cooldown: 40, splashRadius: 150, sheetSrc: "anim_chars_5.png", sheetRow: 3, sellPrice: 1500, isHidden: true, damageType: "MAGIC",
        skillName: "🌌 중력장 (오라)", skillDesc: "이 유닛이 필드에 있으면 모든 몬스터의 이동속도가 30% 영구 감소합니다.", skill: { type: "aura_global_slow", value: 0.7 },
        projectile: { style: "default", color: "#d500f9" } },
    
    // 🛡️ 방패병 트리 (철퇴/둔기 느낌의 무거운 은빛 구체)
    "SHIELD_1": { name: "훈련 방패 (일반)", trait: "SHIELD", upgradeCost: 200, upgradeChance: 0.70, damage: 15, range: 110, cooldown: 60, sheetSrc: "anim_chars_1.png", sheetRow: 2, next: "SHIELD_2", sellPrice: 50, damageType: "MAGIC",
        skillName: "🛡️ 밀치기", skillDesc: "공격 시 10% 확률로 적을 0.5초간 기절시킵니다.", skill: { type: "proc_stun", chance: 0.10, duration: 30 },
        projectile: { style: "default", color: "#b0bec5" } },
    "SHIELD_2": { name: "중갑 방패 (고급)", trait: "SHIELD", upgradeCost: 400, upgradeChance: 0.60, damage: 35, range: 110, cooldown: 55, sheetSrc: "anim_chars_2.png", sheetRow: 2, next: "SHIELD_3", sellPrice: 150, damageType: "MAGIC",
        skillName: "🛡️ 견제 타격", skillDesc: "공격 시 15% 확률로 적을 0.8초간 기절시킵니다.", skill: { type: "proc_stun", chance: 0.15, duration: 48 },
        projectile: { style: "default", color: "#90a4ae" } },
    "SHIELD_3": { name: "수호기사 (희귀)", trait: "SHIELD", upgradeCost: 800, upgradeChance: 0.25, damage: 80, range: 120, cooldown: 50, sheetSrc: "anim_chars_3.png", sheetRow: 2, next: "SHIELD_4", sellPrice: 350, damageType: "MAGIC",
        skillName: "🛡️ 쉴드 배쉬", skillDesc: "공격 시 30% 확률로 적의 방어력을 부수고 1초간 기절시킵니다.", skill: { type: "proc_stun", chance: 0.30, duration: 60 },
        projectile: { style: "default", color: "#ffcc80" } },
    "SHIELD_4": { name: "팔라딘 (전설)", trait: "SHIELD", upgradeCost: 1500, upgradeChance: 0.10, damage: 180, range: 130, cooldown: 45, sheetSrc: "anim_chars_4.png", sheetRow: 2, next: "SHIELD_5", sellPrice: 800, damageType: "MAGIC",
        skillName: "🎺 용기의 함성 (오라)", skillDesc: "주변(반경 200) 아군들의 공격력을 30% 증가시킵니다.", skill: { type: "aura_buff_dmg", radius: 200, value: 1.3 },
        projectile: { style: "default", color: "#ffb300" } },
    "SHIELD_5": { name: "아이기스 [히든]", trait: "SHIELD", upgradeCost: null, damage: 400, range: 150, cooldown: 30, sheetSrc: "anim_chars_5.png", sheetRow: 2, sellPrice: 1500, isHidden: true, damageType: "MAGIC",
        skillName: "신의 가호 (오라)", skillDesc: "주변 아군들의 공격력과 공격속도를 무려 50%나 폭증시킵니다.", skill: { type: "aura_buff_all", radius: 250, value: 1.5 },
        projectile: { style: "default", color: "#ffea00" } },
    
    // 🔫 총잡이 트리 (노란 총알 -> 붉은 레이저 총알)
    "GUNNER_1": { name: "초보 총잡이 (일반)", trait: "GUNNER", upgradeCost: 200, upgradeChance: 0.70, damage: 30, range: 200, cooldown: 35, sheetSrc: "anim_chars_1.png", sheetRow: 4, next: "GUNNER_2", sellPrice: 50, damageType: "PHYSICAL",
        projectile: { style: "sniper_bullet", color: "#ffe082" } },
    "GUNNER_2": { name: "베테랑 (고급)", trait: "GUNNER", upgradeCost: 400, upgradeChance: 0.60, damage: 70, range: 220, cooldown: 30, sheetSrc: "anim_chars_2.png", sheetRow: 4, next: "GUNNER_3", sellPrice: 150, damageType: "PHYSICAL",
        projectile: { style: "sniper_bullet", color: "#ffca28" } },
    "GUNNER_3": { name: "스나이퍼 (희귀)", trait: "GUNNER", upgradeCost: 800, upgradeChance: 0.25, damage: 160, range: 380, cooldown: 55, sheetSrc: "anim_chars_3.png", sheetRow: 4, next: "GUNNER_4", sellPrice: 350, damageType: "PHYSICAL",
        skillName: "🎯 약점 사격", skillDesc: "20% 확률로 적의 방어력을 뚫고 2.5배의 고정 피해를 입힙니다.", skill: { type: "proc_crit", chance: 0.20, mult: 2.5 },
        projectile: { style: "sniper_bullet", color: "#29b6f6" } },
    "GUNNER_4": { name: "머신건 (전설)", trait: "GUNNER", upgradeCost: 1500, upgradeChance: 0.10, damage: 90, range: 250, cooldown: 10, sheetSrc: "anim_chars_4.png", sheetRow: 4, next: "GUNNER_5", sellPrice: 800, damageType: "PHYSICAL",
        skillName: "🔥 광폭화", skillDesc: "10% 확률로 3초 동안 공격 속도가 3배로 미친듯이 빨라집니다.", skill: { type: "proc_hyper_spd", chance: 0.10, duration: 180, mult: 0.33 },
        projectile: { style: "sniper_bullet", color: "#ff7043" } },
    "GUNNER_5": { name: "헤비 디스트로이어 [히든]", trait: "GUNNER", upgradeCost: null, damage: 450, range: 400, cooldown: 18, sheetSrc: "anim_chars_5.png", sheetRow: 4, sellPrice: 1500, isHidden: true, damageType: "PHYSICAL",
        skillName: "🚀 융단 폭격", skillDesc: "10% 확률로 화면 안의 모든 몬스터에게 미사일을 떨어뜨립니다.", skill: { type: "proc_global_dmg", chance: 0.10, mult: 2.0 },
        projectile: { style: "sniper_bullet", color: "#d84315" } },
    
    // 🥷 닌자 트리 (회전하는 흑색/적색 표창)
    "NINJA_1": { name: "초보 도적 (일반)", trait: "NINJA", upgradeCost: 200, upgradeChance: 0.70, damage: 25, range: 150, cooldown: 30, sheetSrc: "anim_chars_1.png", sheetRow: 5, next: "NINJA_2", sellPrice: 50, damageType: "PHYSICAL",
        projectile: { style: "spin_sword", color: "#9e9e9e" } },
    "NINJA_2": { name: "암살자 (고급)", trait: "NINJA", upgradeCost: 400, upgradeChance: 0.60, damage: 60, range: 170, cooldown: 25, sheetSrc: "anim_chars_2.png", sheetRow: 5, next: "NINJA_3", sellPrice: 150, damageType: "PHYSICAL",
        projectile: { style: "spin_sword", color: "#616161" } },
    "NINJA_3": { name: "그림자 닌자 (희귀)", trait: "NINJA", upgradeCost: 800, upgradeChance: 0.25, damage: 140, range: 190, cooldown: 22, sheetSrc: "anim_chars_3.png", sheetRow: 5, next: "NINJA_4", sellPrice: 350, damageType: "PHYSICAL",
        skillName: "🐍 맹독 부여", skillDesc: "공격 시 100% 확률로 적에게 맹독을 걸어 지속 피해를 입힙니다.", skill: { type: "passive_poison" },
        projectile: { style: "spin_sword", color: "#ab47bc" } },
    "NINJA_4": { name: "마스터 닌자 (전설)", trait: "NINJA", upgradeCost: 1500, upgradeChance: 0.10, damage: 320, range: 200, cooldown: 18, sheetSrc: "anim_chars_4.png", sheetRow: 5, next: "NINJA_5", sellPrice: 800, damageType: "PHYSICAL",
        skillName: "🗡️ 급소 찌르기", skillDesc: "보스를 때릴 때는 항상 데미지가 3배로 들어갑니다.", skill: { type: "passive_boss_killer", mult: 3.0 },
        projectile: { style: "spin_sword", color: "#e53935" } },
    "NINJA_5": { name: "아수라 [히든]", trait: "NINJA", upgradeCost: null, damage: 750, range: 220, cooldown: 15, sheetSrc: "anim_chars_5.png", sheetRow: 5, sellPrice: 1500, isHidden: true, damageType: "PHYSICAL",
        skillName: "🩸 사신 강림", skillDesc: "10% 확률로 적의 현재 체력을 단번에 20% 깎아버립니다. (보스 극카운터)", skill: { type: "proc_percent_dmg", chance: 0.10, percent: 0.20 },
        projectile: { style: "spin_sword", color: "#b71c1c" } }
};

const STAGE_DB = {
    1: { 
        name: "1. 평화로운 초원", desc: "가장 기초적인 방어 훈련을 진행하는 초원입니다.", monster: "👾 등장 몬스터: 핑크 젤리, 거대 젤리 (보스)", 
        maxWave: 20, hpMultiplier: 2.0, singleRewardMult: 1.0, multiRewardMult: 1.5, 
        mobSheetRow: 0, bossRadius: 23, bossSheet: "boss_1.png", ccImmune: false, castSkill: false 
    },
    2: { 
        name: "2. 고블린 둥지", desc: "고블린들이 매복해 있는 둥지입니다.", monster: "👾 등장 몬스터: 고블린, 돌연변이, 보스 고블린", 
        maxWave: 20, hpMultiplier: 6.0, singleRewardMult: 2.5, multiRewardMult: 3.5, 
        mobSheetRow: 1, bossRadius: 30, bossSheet: "boss_1.png", ccImmune: false, castSkill: false 
    },
    3: { 
        name: "3. 붉은 화산", desc: "뜨거운 열기가 가득한 화산 지대입니다.", monster: "👾 등장 몬스터: 붉은 늑대, 돌연변이, 화산 보스", 
        maxWave: 20, hpMultiplier: 16.0, singleRewardMult: 5.0, multiRewardMult: 7.0, 
        mobSheetRow: 3, bossRadius: 30, bossSheet: "boss_1.png", ccImmune: false, castSkill: false 
    },
    4: { 
        name: "4. 메마른 사막", desc: "극한의 환경을 자랑하는 사막입니다.", monster: "👾 등장 몬스터: 사막 선인장, 돌연변이, 사막 보스", 
        maxWave: 20, hpMultiplier: 35.0, singleRewardMult: 12.0, multiRewardMult: 15.0, 
        mobSheetRow: 5, bossRadius: 30, bossSheet: "boss_1.png", ccImmune: false, castSkill: false 
    },
    5: { 
        name: "[HARD] 5. 심연의 사원", desc: "보스가 상태이상에 면역이며, 아군을 주기적으로 기절시킵니다.", 
        monster: "👾 몬스터: 다크슬라임, 유령 (일반) / 박쥐 (빠름) / 해골 (탱커)", 
        maxWave: 20, hpMultiplier: 120.0, singleRewardMult: 25.0, multiRewardMult: 35.0, 
        // ★ 하드모드 전용 에셋 매핑
        bgSrc: "bg_hard_1.png",
        mobSheetSrc: "monster_hard_1.png", 
        bossSheet: "boss_hard_1.png", bossRadius: 35, 
        ccImmune: true, castSkill: true 
    }
};

// ★ 핵심: 엔진이 유물 번호를 외우지 않도록 연산을 묶어둔 만능 도구!
const RELIC_ENGINE = {
    getSpawnTiers: function(relics) {
        let spawns = [];
        for (let rId in relics) {
            let lvl = relics[rId];
            if (lvl > 0 && RELIC_DB[rId] && RELIC_DB[rId].type === "start_spawn") {
                let count = lvl * RELIC_DB[rId].baseVal;
                for(let i = 0; i < count; i++) spawns.push(RELIC_DB[rId].targetTier);
            }
        }
        return spawns; 
    },
    getGoldBonus: function(relics) {
        let mult = 0;
        for (let rId in relics) {
            let lvl = relics[rId];
            if (lvl > 0 && RELIC_DB[rId] && RELIC_DB[rId].type === "gold_bonus") {
                mult += lvl * (RELIC_DB[rId].baseVal / 100);
            }
        }
        return mult;
    },
    getSellBonus: function(relics) {
        let mult = 0;
        for (let rId in relics) {
            let lvl = relics[rId];
            if (lvl > 0 && RELIC_DB[rId] && RELIC_DB[rId].type === "sell_bonus") {
                mult += lvl * (RELIC_DB[rId].baseVal / 100);
            }
        }
        return mult;
    },
    getStatMods: function(relics) {
        let mods = { dmgMult: 1, spdFactor: 1, rangeBonus: 0 };
        for (let rId in relics) {
            let lvl = relics[rId];
            if (lvl > 0 && RELIC_DB[rId] && RELIC_DB[rId].type === "stat_boost") {
                let r = RELIC_DB[rId];
                let actualVal = r.calc === "sum_flat" ? r.baseVal : (r.baseVal / 100);
                if (r.target === "damage") mods.dmgMult += lvl * actualVal;
                if (r.target === "cooldown") mods.spdFactor *= Math.pow(1 - actualVal, lvl);
                if (r.target === "range") mods.rangeBonus += lvl * actualVal;
            }
        }
        return mods;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UNIT_DB, RELIC_DB, ITEM_DB, STAGE_DB, RELIC_ENGINE };
}