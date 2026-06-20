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
    
    let itemCritBonus = 0;
    if (selectedUnit.items) {
        selectedUnit.items.forEach(itemId => {
            let itemDef = ITEM_DB[itemId];
            if (itemDef) {
                if (itemDef.type === "dmg") buffedDamage = Math.floor(buffedDamage * itemDef.value);
                if (itemDef.type === "spd") buffedCooldown = Math.floor(buffedCooldown * itemDef.value);
                if (itemDef.type === "rng") buffedRange += itemDef.value;
                if (itemDef.type === "crit") itemCritBonus += itemDef.value;
                
                if (itemDef.stat) {
                    if (itemDef.stat.type === "dmg") buffedDamage = Math.floor(buffedDamage * itemDef.stat.value);
                    if (itemDef.stat.type === "spd") buffedCooldown = Math.floor(buffedCooldown * itemDef.stat.value);
                    if (itemDef.stat.type === "rng") buffedRange += itemDef.stat.value;
                    if (itemDef.stat.critRateBonus) itemCritBonus += itemDef.stat.critRateBonus;
                }
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
    
    // 💡 치명타 스탯 계산 (기본 + 아이템)
    let totalCritRate = ((selectedUnit.critRate || unitDef.critRate || 0) + itemCritBonus) * 100;
    let totalCritDmg = (selectedUnit.critDamage || unitDef.critDamage || 1.5) * 100;

    // 전체 배경판
    ctx.fillStyle = "rgba(20, 20, 25, 0.95)"; ctx.beginPath(); ctx.roundRect(10, 850, 700, 140, 10); ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"; ctx.lineWidth = 2; ctx.stroke();
    
    // ✨ 마법의 그림자 효과 시작 (텍스트를 엄청 선명하게 만들어줌!)
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.9)"; ctx.shadowBlur = 3; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1;

    // 1. 이름 표기
    ctx.fillStyle = unitDef.color || "#fff"; ctx.font = "bold 20px Malgun Gothic"; ctx.textAlign = "left"; 
    ctx.fillText(`[${unitDef.name}]`, 25, 880);
    
    // 2. 💧 마나(Mana) 게이지바 (그림자 끄고 그리기)
    ctx.shadowColor = "transparent"; 
    let curMana = selectedUnit.mana || 0;
    let maxMana = selectedUnit.maxMana || unitDef.maxMana || 100;
    ctx.fillStyle = "#222"; ctx.fillRect(25, 892, 130, 12);
    ctx.fillStyle = "#40c4ff"; ctx.fillRect(25, 892, 130 * Math.min(curMana / maxMana, 1), 12);
    ctx.strokeStyle = "#111"; ctx.lineWidth = 1; ctx.strokeRect(25, 892, 130, 12);
    
    // 마나 텍스트 (그림자 다시 켜기)
    ctx.shadowColor = "rgba(0, 0, 0, 0.9)"; 
    ctx.fillStyle = "#fff"; ctx.font = "bold 11px Tahoma"; ctx.textAlign = "center";
    ctx.fillText(`${Math.floor(curMana)} / ${maxMana}`, 25 + 65, 902);

    // 3. 기본 스탯 (좌측 열) - 전부 bold 및 흰색(#fff)으로 변경!
    ctx.textAlign = "left"; let baseAps = (60 / unitDef.cooldown).toFixed(1);
    ctx.font = "bold 14px Malgun Gothic"; 
    ctx.fillStyle = finalDamage > unitDef.damage ? "#69f0ae" : "#fff";
    ctx.fillText(`공격력: ${finalDamage}`, 25, 930);
    ctx.fillStyle = parseFloat(finalAps) > parseFloat(baseAps) ? "#69f0ae" : "#fff";
    ctx.fillText(`공속: ${finalAps}회`, 25, 950);
    ctx.fillStyle = buffedRange > unitDef.range ? "#69f0ae" : "#fff";
    ctx.fillText(`사거리: ${Math.floor(buffedRange)}`, 25, 970);
    
    // 4. 치명타 및 속성 (중앙 열)
    let typeText = unitDef.damageType === "MAGIC" ? "[🔮 마법 피해]" : "[⚔️ 물리 피해]";
    let typeColor = unitDef.damageType === "MAGIC" ? "#b388ff" : "#ff8a65";
    ctx.fillStyle = typeColor; ctx.font = "bold 14px Malgun Gothic";
    ctx.fillText(typeText, 150, 930);
    ctx.font = "bold 14px Malgun Gothic"; ctx.fillStyle = itemCritBonus > 0 ? "#ffeb3b" : "#fff";
    ctx.fillText(`치명타 확률: ${Math.round(totalCritRate)}%`, 150, 950);
    ctx.fillStyle = "#fff";
    ctx.fillText(`치명타 피해: ${Math.round(totalCritDmg)}%`, 150, 970);

    // 장착 아이템 타이틀
    ctx.fillStyle = "#eee"; ctx.font = "bold 13px Malgun Gothic"; ctx.fillText("📦 장착 아이템", 290, 895);
    
    ctx.restore(); // ✨ 그림자 효과 끝 (UI 박스 등에는 영향 안 주도록 원상복구)
    for (let i = 0; i < 3; i++) {
        let slotX = 290 + (i * 45); let slotY = 910;
        ctx.fillStyle = "#111"; ctx.fillRect(slotX, slotY, 40, 40);
        ctx.strokeStyle = "#444"; ctx.lineWidth = 2; ctx.strokeRect(slotX, slotY, 40, 40);
        
        if (selectedUnit.items && selectedUnit.items[i]) {
            let item = ITEM_DB[selectedUnit.items[i]];
            if (item && typeof SHEET_CACHE !== 'undefined' && SHEET_CACHE['items.png'] && SHEET_CACHE['items.png'].complete && SHEET_CACHE['items.png'].naturalWidth > 0) {
                const itemSheet = SHEET_CACHE['items.png'];
                const sw = itemSheet.naturalWidth / 4; const sh = itemSheet.naturalHeight / 4;
                ctx.drawImage(itemSheet, item.sheetCol * sw, item.sheetRow * sh, sw, sh, slotX + 4, slotY + 4, 32, 32);
            }
        }
    }
    
    // 6. 버튼 크기 축소 및 재배치
    if (selectedUnit.side === mySide) {
        ctx.fillStyle = "#c62828"; ctx.fillRect(615, 885, 75, 65); 
        ctx.fillStyle = "#fff"; ctx.font = "bold 13px Malgun Gothic"; ctx.textAlign = "center"; ctx.fillText("💰 판매", 652, 908);
        let sellBonusMult = RELIC_ENGINE.getSellBonus(PlayerProfile.relics || {});
        let dispPrice = Math.floor(unitDef.sellPrice * (1 + sellBonusMult));
        ctx.fillStyle = "#ffdd57"; ctx.font = "bold 13px Arial"; ctx.fillText(`+${dispPrice}`, 652, 933);
        
        if (unitDef.next) {
            let nextArr = Array.isArray(unitDef.next) ? unitDef.next : [unitDef.next]; 
            let btnX = nextArr.length > 1 ? [455, 535] : [535];
            
            for (let i = 0; i < nextArr.length; i++) {
                let nextId = nextArr[i]; let nextDef = UNIT_DB[nextId]; if (!nextDef) continue;
                let isHiddenAndLocked = nextDef.isHidden && (!PlayerProfile.unlockedHiddens || !PlayerProfile.unlockedHiddens.includes(nextId));
                let chanceStr = unitDef.upgradeChance ? Math.floor(unitDef.upgradeChance * 100) + "%" : "100%";
                let btnColor = isHiddenAndLocked ? "#444" : (myGold >= unitDef.upgradeCost ? (i===0 ? "#2e7d32" : "#1565c0") : "#555");
                
                ctx.fillStyle = btnColor; ctx.fillRect(btnX[i], 885, 75, 65); 
                ctx.fillStyle = "#fff"; ctx.font = "bold 12px Malgun Gothic"; 
                if (isHiddenAndLocked) {
                    ctx.fillText(`🔒해금필요`, btnX[i] + 37, 908); ctx.fillStyle = "#ff5252"; ctx.font = "bold 11px Arial"; ctx.fillText(`(연구소)`, btnX[i] + 37, 933);
                } else {
                    let shortName = nextDef.name.substring(0, 6);
                    ctx.fillText(`▶${shortName}`, btnX[i] + 37, 905); 
                    ctx.fillStyle = "#ea80fc"; ctx.font = "bold 10px Malgun Gothic"; ctx.fillText(`확률 ${chanceStr}`, btnX[i] + 37, 925);
                    ctx.fillStyle = (myGold >= unitDef.upgradeCost) ? "#ffea00" : "#ff5252"; ctx.font = "bold 13px Arial"; ctx.fillText(`${unitDef.upgradeCost} G`, btnX[i] + 37, 942);
                }
            }
        } else { 
            ctx.fillStyle = "#333"; ctx.fillRect(535, 885, 75, 65); ctx.fillStyle = "#888"; ctx.font = "bold 16px Arial"; ctx.fillText("MAX", 572, 922); 
        }
    }
}