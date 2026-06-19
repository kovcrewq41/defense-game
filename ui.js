class UIButton { 
    constructor(x, y, width, height, text, color, onClick) { 
        this.x = x; this.y = y; this.width = width; this.height = height; this.text = text; this.color = color; this.onClick = onClick; 
    } 
    draw(ctx) { 
        ctx.fillStyle = this.color; ctx.beginPath(); ctx.roundRect(this.x, this.y, this.width, this.height, 15); ctx.fill(); 
        ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 3; ctx.stroke(); 
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 20px Malgun Gothic"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; 
        ctx.fillText(this.text, this.x + this.width / 2, this.y + this.height / 2); 
    } 
    isClicked(mx, my) { return mx >= this.x && mx <= this.x + this.width && my >= this.y && my <= this.y + this.height; } 
}

let floatingTexts = [];
function addFloatingText(text, x, y, color) {
    floatingTexts.push({ text: text, x: x, y: y, color: color, alpha: 1.0, life: 60 });
}

function renderFloatingTexts(ctx) {
    floatingTexts.forEach((ft) => {
        ft.y -= 1; ft.life -= 1; ft.alpha = ft.life / 60; 
        ctx.save(); ctx.globalAlpha = ft.alpha; ctx.fillStyle = ft.color;
        ctx.font = "bold 24px Malgun Gothic"; ctx.textAlign = "center"; ctx.strokeStyle = "black"; ctx.lineWidth = 3;
        ctx.strokeText(ft.text, ft.x, ft.y); ctx.fillText(ft.text, ft.x, ft.y); ctx.restore();
    });
    floatingTexts = floatingTexts.filter(ft => ft.life > 0);
}

function updateDamageMeter(stats) {
    let p1 = stats.p1Damage || 0; let p2 = stats.p2Damage || 0;
    let total = p1 + p2 || 1; let p1Pct = (p1 / total) * 100;
    let bar = document.getElementById('p1DamageBar'); if(bar) bar.style.width = p1Pct + '%';
    let txt1 = document.getElementById('p1DamageText'); if(txt1) txt1.innerText = Math.floor(p1).toLocaleString();
    let txt2 = document.getElementById('p2DamageText'); if(txt2) txt2.innerText = Math.floor(p2).toLocaleString();
}

function drawTooltip(ctx, currentTooltip, mouseX, mouseY) {
    if (currentTooltip !== "") {
        ctx.fillStyle = "rgba(0, 0, 0, 0.9)"; ctx.font = "bold 17px Malgun Gothic";
        let tw = ctx.measureText(currentTooltip).width + 40;
        ctx.fillRect(mouseX - tw/2, mouseY - 50, tw, 38); ctx.strokeStyle = "#ffeb3b"; ctx.lineWidth = 2; ctx.strokeRect(mouseX - tw/2, mouseY - 50, tw, 38);
        ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(currentTooltip, mouseX, mouseY - 25);
    }
}

function drawFixedUnitPanel(ctx, selectedUnit, UNIT_DB, ITEM_DB, mySide, PlayerProfile, activeSynergies, myGold) {
    if (!selectedUnit) return;
    const unitDef = UNIT_DB[selectedUnit.type]; if (!unitDef) return;
    
    let buffedDamage = unitDef.damage; let buffedCooldown = unitDef.cooldown; let buffedRange = unitDef.range;
    let syn = activeSynergies[unitDef.trait] || 0;

    if (unitDef.trait === "SWORD" && syn >= 3) buffedCooldown = Math.floor(unitDef.cooldown * 0.4); 
    if (unitDef.trait === "ARCHER" && syn >= 3) { buffedDamage = Math.floor(unitDef.damage * 1.5); buffedRange += 80; } 
    if (unitDef.trait === "NINJA") { buffedDamage *= (syn >= 3 ? 3 : 2); } 
    if (unitDef.trait === "GUNNER" && syn >= 3) { buffedDamage = Math.floor(unitDef.damage * 1.3); buffedCooldown = Math.floor(unitDef.cooldown * 0.7); }
    
    if (selectedUnit.items) {
        selectedUnit.items.forEach(itemId => {
            let itemDef = ITEM_DB[itemId];
            if (itemDef) {
                if (itemDef.type === "dmg") buffedDamage = Math.floor(buffedDamage * itemDef.value);
                if (itemDef.type === "spd") buffedCooldown = Math.floor(buffedCooldown * itemDef.value);
                if (itemDef.type === "rng") buffedRange += itemDef.value;
            }
        });
    }

    let pProfile = selectedUnit.side === mySide ? PlayerProfile : { passives: {}, mastery: {}, relics: {} }; 
    let statMods = RELIC_ENGINE.getStatMods(pProfile.relics);
    let relicDmgMult = statMods.dmgMult;
    buffedCooldown = Math.floor(buffedCooldown * statMods.spdFactor);
    if (buffedCooldown < 10) buffedCooldown = 10;
    buffedRange += statMods.rangeBonus;

    const passiveMultiplier = 1 + ((pProfile.passives?.attackBoostLvl || 0) * 0.05);
    const masteryMultiplier = 1 + ((pProfile.mastery?.[unitDef.trait] || 0) * 0.1);
    let finalDamage = Math.floor(buffedDamage * passiveMultiplier * masteryMultiplier * relicDmgMult);
    let finalAps = (60 / buffedCooldown).toFixed(1);

    ctx.fillStyle = "rgba(20, 20, 25, 0.95)"; ctx.beginPath(); ctx.roundRect(10, 850, 700, 140, 10); ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"; ctx.lineWidth = 2; ctx.stroke();
    
    ctx.fillStyle = unitDef.color || "#fff"; ctx.font = "bold 24px Malgun Gothic"; ctx.textAlign = "left"; 
    ctx.fillText(`[${unitDef.name}]`, 25, 885);
    
    let typeText = unitDef.damageType === "MAGIC" ? "[🪄 마법 피해]" : "[⚔️ 물리 피해]";
    let typeColor = unitDef.damageType === "MAGIC" ? "#b388ff" : "#ff8a65";
    ctx.font = "bold 16px Malgun Gothic"; ctx.fillStyle = typeColor;
    ctx.fillText(typeText, 25, 920);
    
    ctx.font = "16px Malgun Gothic"; ctx.fillStyle = finalDamage > unitDef.damage ? "#69f0ae" : "#ddd";
    ctx.fillText(`공격력: ${finalDamage} (기본 ${unitDef.damage})`, 140, 920);
    
    let baseAps = (60 / unitDef.cooldown).toFixed(1);
    ctx.fillStyle = parseFloat(finalAps) > parseFloat(baseAps) ? "#69f0ae" : "#ddd";
    ctx.fillText(`공속: 초당 ${finalAps}회 (기본 ${baseAps}회)`, 25, 945);
    
    ctx.fillStyle = buffedRange > unitDef.range ? "#69f0ae" : "#ddd";
    ctx.fillText(`사거리: ${buffedRange} (기본 ${unitDef.range})`, 25, 970);
    
    if (selectedUnit.side === mySide) {
        ctx.fillStyle = "#c62828"; ctx.fillRect(590, 875, 100, 90); 
        ctx.fillStyle = "#fff"; ctx.font = "bold 16px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText("💰 판매", 640, 910);
        
        let sellBonusMult = RELIC_ENGINE.getSellBonus(PlayerProfile.relics || {});
        let dispPrice = Math.floor(unitDef.sellPrice * (1 + sellBonusMult));
        ctx.fillStyle = "#ffdd57"; ctx.font = "bold 18px Arial"; ctx.fillText(`+${dispPrice} G`, 640, 940);
        
        if (unitDef.next) {
            let nextArr = Array.isArray(unitDef.next) ? unitDef.next : [unitDef.next]; let btnX = [450, 310]; 
            for (let i = 0; i < nextArr.length; i++) {
                let nextId = nextArr[i]; let nextDef = UNIT_DB[nextId]; if (!nextDef) continue;
                let isHiddenAndLocked = nextDef.isHidden && (!PlayerProfile.unlockedHiddens || !PlayerProfile.unlockedHiddens.includes(nextId));
                let chanceStr = unitDef.upgradeChance ? Math.floor(unitDef.upgradeChance * 100) + "%" : "100%";
                let btnColor = isHiddenAndLocked ? "#444" : (myGold >= unitDef.upgradeCost ? (i===0 ? "#2e7d32" : "#1565c0") : "#555");
                
                ctx.fillStyle = btnColor; ctx.fillRect(btnX[i], 875, 130, 90); ctx.fillStyle = "#fff"; ctx.font = "bold 15px Malgun Gothic"; 
                if (isHiddenAndLocked) {
                    ctx.fillText(`🔒 해금 필요`, btnX[i] + 65, 910); ctx.fillStyle = "#ff5252"; ctx.font = "bold 14px Arial"; ctx.fillText(`(연구소)`, btnX[i] + 65, 940);
                } else {
                    ctx.fillText(`▶ ${nextDef.name}`, btnX[i] + 65, 900); ctx.fillStyle = "#ea80fc"; ctx.font = "bold 13px Malgun Gothic"; ctx.fillText(`성공률: ${chanceStr}`, btnX[i] + 65, 925);
                    ctx.fillStyle = (myGold >= unitDef.upgradeCost) ? "#ffea00" : "#ff5252"; ctx.font = "bold 18px Arial"; ctx.fillText(`${unitDef.upgradeCost} G`, btnX[i] + 65, 950);
                }
            }
        } else { ctx.fillStyle = "#333"; ctx.fillRect(450, 875, 130, 90); ctx.fillStyle = "#888"; ctx.font = "bold 20px Arial"; ctx.fillText("MAX", 515, 925); }
    }
}