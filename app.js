window.exports = window.exports || {};
var exports = window.exports; // Safety net for strict mode

let showdownData = {}; let abilitiesData = {}; let movesData = {}; let learnsetsData = {}; let itemsData = {};
let currentTeam = []; let pendingMon = null; let simYourSelection = []; let simOppTeam = [];

// --- INSTANT OFFLINE BOOT WITH DIAGNOSTICS ---
window.addEventListener('load', () => {
    try {
        if (window.exports && window.exports.BattlePokedex) {
            showdownData = window.exports.BattlePokedex; 
            abilitiesData = window.exports.BattleAbilities;
            movesData = window.exports.BattleMovedex; 
            itemsData = window.exports.BattleItems; 
            learnsetsData = window.exports.BattleLearnsets;
            
            console.log("Vault Engine Online.");
            initApp();
        } else {
            alert("CRITICAL ERROR: Could not find Showdown data. Make sure 'pokedex.js' is inside the 'data' folder!");
        }
    } catch (e) {
        alert("Boot Error: " + e.message);
    }
});

function initApp() {
    // 🚨 Diagnostic Check: Did data.js load properly?
    if (typeof POKEMON_AESTHETICS === 'undefined') {
        alert("CRITICAL ERROR: 'data.js' failed to load! Check your folder to make sure it is named exactly 'data.js' with NO spaces!");
        return;
    }

    // Generate Mega Stats dynamically
    Object.keys(POKEMON_AESTHETICS).forEach(id => {
        if (id.includes('mega') && !showdownData[id]) {
            let baseId = id.replace(/mega[a-z]?$/, '');
            if(showdownData[baseId]) {
                let clone = JSON.parse(JSON.stringify(showdownData[baseId]));
                let letter = id.match(/mega([xyz])$/) ? " " + id.slice(-1).toUpperCase() : "";
                clone.name = clone.name + "-Mega" + letter;
                clone.baseStats.hp += 0; clone.baseStats.atk += 20; clone.baseStats.def += 20; clone.baseStats.spa += 20; clone.baseStats.spd += 20; clone.baseStats.spe += 20;
                showdownData[id] = clone;
            }
        }
    });
    
    renderPokedex();
    loadTeam();
}

// --- NAVIGATION ---
function switchView(viewId, element) {
    // Hide all views
    document.getElementById('view-teams').style.display = 'none';
    document.getElementById('view-pokedex').style.display = 'none';
    document.getElementById('view-sim').style.display = 'none';
    document.getElementById('view-lab').style.display = 'none';
    
    // Show selected view
    document.getElementById(viewId).style.display = 'block';
    
    // Update active class in sidebar
    document.querySelectorAll('.menu-item').forEach(nav => nav.classList.remove('active'));
    if (element) {
        element.classList.add('active');
    }
}

// Add this function to handle mobile menu toggling without breaking desktop
function toggleMenuMobile() {
    if (window.innerWidth < 768) {
        document.getElementById('side-menu').classList.toggle('open');
        document.getElementById('menu-overlay').classList.toggle('active');
    }
}

// --- BANNED MONS FOR REGULATION A (Hidden from Builder) ---
const RESTRICTED_MONS = [
    "calyrexice", "urshifurapidstrike", "ragingbolt", "ogerponhearthflame", 
    "fluttermane", "ironhands", "landorustherian", "chienpao", 
    "calyrexshadow", "thundurus", "zaciancrowned", "groudon", 
    "kyogre", "tapufini", "tapukoko", "kartana", "rayquaza", 
    "hitmontop", "heatran", "cresselia", "pachirisu"
];

// --- POKEDEX RENDERER ---
function renderPokedex() {
    let html = "";
    // Check if the Mega toggle is checked
    let showMegas = document.getElementById('mega-toggle') ? document.getElementById('mega-toggle').checked : false;

    Object.keys(POKEMON_AESTHETICS).forEach(id => {
        let mon = showdownData[id];
        
        if (mon && mon.types && mon.types.length > 0) {
            
            // 🚨 1. Hide Restricted Pro Team Mons completely
            if (RESTRICTED_MONS.includes(id)) return;

            // 🚨 2. Hide Megas unless the toggle is checked
            if (id.includes('mega') && !showMegas) return;
            
            // 🛑 3. Hide "other forms" but keep Regional variants
            if (mon.baseSpecies && mon.name !== mon.baseSpecies) {
                let isMegaOrRegional = id.includes('mega') || id.includes('alola') || id.includes('galar') || id.includes('hisui') || id.includes('paldea');
                if (!isMegaOrRegional) return; 
            }

            let spriteName = id; 
            let type1 = mon.types[0];
            let bgColor = TYPE_COLORS[type1] || '#334155';
            
            html += `
            <div class="dex-card" style="background-color: ${bgColor};" onclick="openMonDetails('${id}')">
                <img src="sprites/${spriteName}.png" class="dex-sprite" onerror="this.style.opacity='0'">
                <div class="dex-name">${mon.name}</div>
                <div class="dex-types">${mon.types.join(' / ')}</div>
            </div>`;
        }
    });
    document.getElementById('pokedex-grid').innerHTML = html;

    // Re-apply search filter if the user typed something before clicking the toggle
    if (typeof filterPokedex === 'function' && document.getElementById('dex-search') && document.getElementById('dex-search').value !== "") {
        filterPokedex();
    }
}

// Optional: Helper function to filter the grid
function filterPokedex() {
    let input = document.getElementById('dex-search').value.toLowerCase();
    let cards = document.getElementsByClassName('dex-card');
    
    for (let i = 0; i < cards.length; i++) {
        let name = cards[i].getElementsByClassName('dex-name')[0].innerText.toLowerCase();
        let types = cards[i].getElementsByClassName('dex-types')[0].innerText.toLowerCase();
        
        if (name.includes(input) || types.includes(input)) {
            cards[i].style.display = "flex";
        } else {
            cards[i].style.display = "none";
        }
    }
}

// --- CORE MATH ---
function calcLv50Stat(baseStat, isHP = false) {
    if (isHP && baseStat === 1) return 1; 
    if (isHP) return Math.floor(0.5 * (2 * baseStat + 31)) + 60;
    return Math.floor(0.5 * (2 * baseStat + 31)) + 5;
}

function getDefensiveMultiplier(defendingTypes, attackingType) {
  let mult = 1;
  defendingTypes.forEach(type => {
    if (!TYPE_DATA[type]) return;
    if (TYPE_DATA[type].weakTo.includes(attackingType)) mult *= 2;
    if (TYPE_DATA[type].resists.includes(attackingType)) mult *= 0.5;
    if (TYPE_DATA[type].immuneTo.includes(attackingType)) mult *= 0;
  });
  return mult;
}

// --- MODALS & TEAM BUILDER ---
function openMonDetails(id) {
    let monData = showdownData[id]; if (!monData) return;
    const content = document.getElementById('modal-info');
    
    let stats = monData.baseStats;
    let bst = stats.hp + stats.atk + stats.def + stats.spa + stats.spd + stats.spe;
    let hp50  = calcLv50Stat(stats.hp, true); let atk50 = calcLv50Stat(stats.atk); let def50 = calcLv50Stat(stats.def);
    let spa50 = calcLv50Stat(stats.spa); let spd50 = calcLv50Stat(stats.spd); let spe50 = calcLv50Stat(stats.spe);

    let abilitiesHtml = `<div style="margin: 15px 0 5px 0; text-align: left; color: #ff9900; font-size:12px;"><strong>Abilities:</strong></div>`;
    let first = true;
    for(let key in monData.abilities) {
        let aName = monData.abilities[key];
        abilitiesHtml += `<label style="display:block; margin:6px 0; font-size:12px; cursor:pointer; text-align: left; color:white;"><input type="radio" name="ability-select" value="${aName}" ${first ? 'checked' : ''}> ${aName} ${key === 'H' ? '<span style="color:#888;">(Hidden)</span>' : ''}</label>`;
        first = false;
    }

    pendingMon = { id: id, name: monData.name, sprite: `sprites/${id}.png`, types: monData.types, moves: [], item: "", ability: "" };

    content.innerHTML = `
      <h2 style="margin-top:0; color:#ffcc00;">${monData.name}</h2>
      <img src="sprites/${id}.png" style="height:80px; image-rendering:pixelated;" onerror="this.style.opacity='0'">
      <p style="margin: 2px 0; color:white;"><strong>Types:</strong> ${monData.types.join(' / ')}</p>
      ${abilitiesHtml}
      <div style="background: var(--bg-card); padding: 10px; border-radius: 8px; margin-top: 15px;">
        <div style="color:var(--text-sub); font-size:12px; margin-bottom:5px;"><strong>Lv. 50 Stats (0 EVs)</strong></div>
        <div class="stat-row" style="color:white;"><span>HP:</span> <span>${hp50}</span></div>
        <div class="stat-row" style="color:white;"><span>Attack:</span> <span>${atk50}</span></div>
        <div class="stat-row" style="color:white;"><span>Defense:</span> <span>${def50}</span></div>
        <div class="stat-row" style="color:white;"><span>Sp. Atk:</span> <span>${spa50}</span></div>
        <div class="stat-row" style="color:white;"><span>Sp. Def:</span> <span>${spd50}</span></div>
        <div class="stat-row" style="color:white;"><span>Speed:</span> <span>${spe50}</span></div>
        <hr style="border-color:#334155; margin: 5px 0;">
        <div class="stat-row" style="color:#38bdf8; font-weight:bold;"><span>BST:</span> <span>${bst}</span></div>
      </div>
      <button class="btn-action btn-add" style="margin-top:15px; width:100%;" onclick='submitToTeam()'>Add to Team</button>
      <button class="btn-action btn-danger" style="margin-top:10px; width:100%;" onclick="document.getElementById('data-modal').style.display='none'">Cancel</button>
    `;
    document.getElementById('data-modal').style.display = 'flex';
}

function submitToTeam() {
    if (currentTeam.length >= 6) { alert("Team is full!"); return; }
    let selectedAbility = document.querySelector('input[name="ability-select"]:checked').value;
    pendingMon.ability = selectedAbility;
    currentTeam.push(pendingMon);
    saveTeam();
    document.getElementById('data-modal').style.display = 'none';
    switchView('view-teams', document.querySelector('.menu-item.active'));
}

function removeFromTeam(index) { currentTeam.splice(index, 1); saveTeam(); renderAllUI(); }
function saveTeam() { 
    allMyTeams[activeTeamId] = currentTeam;
    saveAllTeams(); 
}
function loadTeam() { 
    // Fallback if needed, but the activeTeam logic handles it
    renderAllUI(); 
}

function renderAllUI() {
    const container = document.getElementById('team-container'); if (container) container.innerHTML = '';
    for (let i = 0; i < 6; i++) {
        const slot = document.createElement('div'); slot.className = 'team-slot';
        if (currentTeam[i]) {
            slot.classList.add('filled');
            slot.onclick = function(e) { if (e.target.classList.contains('remove-x')) return; openEditModal(i); };
            slot.innerHTML = `
                <img src="${currentTeam[i].sprite}" style="height: 50px; image-rendering: pixelated;" onerror="this.style.opacity='0'">
                <span style="font-size: 10px; font-weight: bold; color: #ffcc00; margin-top: 4px; text-align: center; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block;">${currentTeam[i].name}</span>
                <span style="font-size: 8px; color: #ccc;">${currentTeam[i].item ? '@' + currentTeam[i].item : 'No Item'}</span>
                <div class="remove-x" onclick="removeFromTeam(${i}); event.stopPropagation();">X</div>
            `;
        } else {
            slot.innerHTML = `<span style="color:var(--text-sub); font-size:24px;">+</span>`;
            slot.onclick = function() { switchView('view-pokedex', document.querySelectorAll('.menu-item')[1]); };
        }
        if (container) container.appendChild(slot);
    }
    if (typeof renderTypeChart === 'function') renderTypeChart();
    if (typeof renderSpeedTiers === 'function') renderSpeedTiers();
    if (typeof analyzeArchetype === 'function') analyzeArchetype();
    if (typeof runNewFeaturesHook === 'function') runNewFeaturesHook();
}

function getLegalMoves(monId) {
    let moves = new Set(); let currentId = monId;
    while (currentId) {
        let lset = learnsetsData[currentId]?.learnset; let mon = showdownData[currentId];
        if (!lset && mon && mon.baseSpecies) { let baseId = mon.baseSpecies.toLowerCase().replace(/[^a-z0-9]/g, ''); lset = learnsetsData[baseId]?.learnset; }
        if (lset) Object.keys(lset).forEach(m => moves.add(m));
        currentId = mon && mon.prevo ? mon.prevo.toLowerCase().replace(/[^a-z0-9]/g, '') : null;
    }
    let moveArray = Array.from(moves).map(mId => ({ id: mId, name: movesData[mId] ? movesData[mId].name : mId }));
    moveArray.sort((a, b) => a.name.localeCompare(b.name));
    return moveArray;
}

function openEditModal(index) {
    let mon = currentTeam[index]; 
    let legalMoves = getLegalMoves(mon.id);
    let moveOptions = `<option value="">(Select Move)</option>` + legalMoves.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
    
    let dynamicItems = [];
    if (typeof itemsData !== 'undefined') {
        Object.values(itemsData).forEach(item => {
            let isTMTR = /^(TM|TR|HM)\d+/.test(item.name); 
            if (item.name && !item.zMove && !isTMTR && !item.isNonstandard && !item.isPokeball) dynamicItems.push(item.name);
        });
        dynamicItems.sort();
    }
    let itemOptions = `<option value="">(No Item)</option>` + dynamicItems.map(name => `<option value="${name}">${name}</option>`).join('');

    let html = `
        <h2 style="color:#ffcc00; font-size:16px;">Edit ${mon.name}</h2>
        <img src="${mon.sprite}" style="height:60px; image-rendering:pixelated; margin-bottom:10px;">
        
        <p style="font-size:10px; margin-bottom:5px; text-align:left; color:#ff9900;"><strong>Held Item:</strong></p>
        <select id="edit-item" style="width:100%; margin-bottom:15px; padding:8px; background:#222; color:#fff; border:1px solid #555; border-radius:4px; font-size:12px;">${itemOptions}</select>
        
        <p style="font-size:10px; margin-bottom:5px; text-align:left; color:#ff9900;"><strong>Moveset:</strong></p>
        <select id="edit-move1" style="width:100%; margin-bottom:8px; padding:8px; background:#222; color:#fff; border:1px solid #555; border-radius:4px; font-size:12px;">${moveOptions}</select>
        <select id="edit-move2" style="width:100%; margin-bottom:8px; padding:8px; background:#222; color:#fff; border:1px solid #555; border-radius:4px; font-size:12px;">${moveOptions}</select>
        <select id="edit-move3" style="width:100%; margin-bottom:8px; padding:8px; background:#222; color:#fff; border:1px solid #555; border-radius:4px; font-size:12px;">${moveOptions}</select>
        <select id="edit-move4" style="width:100%; margin-bottom:8px; padding:8px; background:#222; color:#fff; border:1px solid #555; border-radius:4px; font-size:12px;">${moveOptions}</select>
        
        <button class="btn-action btn-add" style="margin-top:15px; width:100%;" onclick="saveMoves(${index})">Save Changes</button>
        <button class="btn-action btn-danger" style="margin-top:10px; width:100%;" onclick="document.getElementById('edit-modal').style.display='none'">Cancel</button>
    `;
    
    document.getElementById('edit-modal-info').innerHTML = html;
    if (mon.item) document.getElementById('edit-item').value = mon.item;
    if (mon.moves) {
        if (mon.moves[0]) document.getElementById('edit-move1').value = mon.moves[0];
        if (mon.moves[1]) document.getElementById('edit-move2').value = mon.moves[1];
        if (mon.moves[2]) document.getElementById('edit-move3').value = mon.moves[2];
        if (mon.moves[3]) document.getElementById('edit-move4').value = mon.moves[3];
    }
    document.getElementById('edit-modal').style.display = 'flex';
}

function saveMoves(index) {
    currentTeam[index].moves = [document.getElementById('edit-move1').value, document.getElementById('edit-move2').value, document.getElementById('edit-move3').value, document.getElementById('edit-move4').value].filter(m => m !== "");
    currentTeam[index].item = document.getElementById('edit-item').value;
    saveTeam(); document.getElementById('edit-modal').style.display = 'none';
}

// --- IMPORTER ---
function processImport() {
    let text = document.getElementById('import-text').value; 
    let blocks = text.trim().split(/\n\s*\n/); 
    let importedTeam = [];
    
    blocks.forEach(block => {
        let lines = block.split('\n'); if (lines.length === 0 || lines[0] === '') return;
        let firstLine = lines[0].trim(); let item = "";
        
        if (firstLine.includes('@')) { 
            let parts = firstLine.split('@'); 
            item = parts[1].trim(); 
            firstLine = parts[0].trim(); 
        }
        firstLine = firstLine.replace(/\s*\([MFN]\)$/i, '').trim();
        
        let species = firstLine; 
        let match = firstLine.match(/.*\(([^)]+)\)$/); 
        if (match) species = match[1].trim();
        
        let jsonId = species.toLowerCase().replace(/[^a-z0-9]/g, ''); 
        
        if (jsonId === 'indeedeef' || jsonId === 'indeedee-f') jsonId = 'indeedeef';
        if (jsonId === 'gastrodoneast') jsonId = 'gastrodoneast';
        
        let formattedItemId = item.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (formattedItemId.includes('ite') && !formattedItemId.includes('eviolite')) {
            let possibleMegaId = jsonId + "mega";
            if (showdownData[possibleMegaId] || jsonId === 'gengar' || jsonId === 'metagross') {
                 jsonId = jsonId + "mega"; 
            }
        }

        let ability = ""; let moves = [];
        for (let i = 1; i < lines.length; i++) {
            let line = lines[i].trim();
            if (line.startsWith('Ability:')) ability = line.replace('Ability:', '').trim();
            if (line.startsWith('-')) moves.push(line.replace('-', '').trim());
        }
        
        let monData = showdownData[jsonId] || Object.values(showdownData).find(d => d.name === species);
        if (monData) {
            importedTeam.push({ id: jsonId, name: monData.name, sprite: `sprites/${jsonId}.png`, types: monData.types, ability: ability, item: item, moves: moves.slice(0, 4) });
        }
    });
    
    if (importedTeam.length > 0) { 
        currentTeam = importedTeam.slice(0, 6); 
        saveTeam(); 
        document.getElementById('import-modal').style.display = 'none'; 
        document.getElementById('import-text').value = ""; 
    } else { 
        alert("Could not parse team. Check format!"); 
    }
}
function exportTeam() {
  if (currentTeam.length === 0) { alert("Team is empty!"); return; }
  let exportText = "";
  currentTeam.forEach(mon => {
    let exportName = mon.id.includes('mega') && !mon.name.includes('-Mega') ? mon.name.replace(' (Mega)', '-Mega') : mon.name;
    exportText += mon.item ? `${exportName} @ ${mon.item}\n` : `${exportName}\n`;
    exportText += `Level: 50\nAbility: ${mon.ability}\n`;
    if (mon.moves && mon.moves.length > 0) { mon.moves.forEach(move => { exportText += `- ${move}\n`; }); }
    exportText += `\n`; 
  });
  navigator.clipboard.writeText(exportText.trim()).then(() => { alert("Copied to clipboard!"); });
}

// --- LAB ANALYTICS ---
function renderSpeedTiers() {
    let container = document.getElementById('speed-tier-container');
    if (currentTeam.length === 0) { container.innerHTML = '<p style="color:#888; font-size:12px; margin:0; text-align:center;">Add Pokémon to see speed tiers.</p>'; return; }
    
    let isTailwind = document.getElementById('speed-tailwind').checked;
    let isTrickRoom = document.getElementById('speed-trickroom').checked;
    let isDrop = document.getElementById('speed-drop').checked;

    let speeds = currentTeam.map(mon => {
        let baseSpe = showdownData[mon.id] ? showdownData[mon.id].baseStats.spe : 50;
        let spe50 = calcLv50Stat(baseSpe);
        if (mon.item === 'Choice Scarf') spe50 = Math.floor(spe50 * 1.5);
        if (mon.item === 'Iron Ball' || mon.item === 'Macho Brace') spe50 = Math.floor(spe50 * 0.5);
        if (isDrop) spe50 = Math.floor(spe50 * 0.66);
        if (isTailwind) spe50 = spe50 * 2;
        return { name: mon.name, sprite: mon.sprite, speed: spe50, item: mon.item };
    });
    
    if (isTrickRoom) speeds.sort((a, b) => a.speed - b.speed);
    else speeds.sort((a, b) => b.speed - a.speed);

    container.innerHTML = speeds.map(s => `
        <div class="speed-tier-row">
            <span class="speed-tier-value">${s.speed}</span>
            <img src="${s.sprite}" class="speed-tier-sprite" onerror="this.style.opacity='0'">
            <span class="speed-tier-name">${s.name} ${s.item ? `<span style="color:#888;">(@${s.item})</span>` : ''}</span>
        </div>
    `).join('');
}

function renderTypeChart() {
  const container = document.getElementById('type-summary-container'); container.innerHTML = '';
  if (currentTeam.length === 0) { container.innerHTML = '<p style="color: #888; font-size: 12px; text-align:center;">Add Pokémon to your team to see analysis.</p>'; return; }

  let weaknesses = {}; let resistances = {}; let immunities = {};
  Object.keys(TYPE_DATA).forEach(t => { weaknesses[t] = []; resistances[t] = []; immunities[t] = []; });

  Object.keys(TYPE_DATA).forEach(targetType => {
    currentTeam.forEach(mon => {
      let defMult = getDefensiveMultiplier(mon.types, targetType);
      if (defMult >= 2) weaknesses[targetType].push(mon); else if (defMult > 0 && defMult <= 0.5) resistances[targetType].push(mon); else if (defMult === 0) immunities[targetType].push(mon);
    });
  });

  const buildSection = (title, color, dataObj) => {
    let activeTypes = Object.keys(dataObj).filter(t => dataObj[t].length > 0).sort((a, b) => dataObj[b].length - dataObj[a].length);
    let contentHtml = activeTypes.length === 0 ? `<div style="color: #888; font-size: 10px;">None</div>` : activeTypes.map(t => `<div class="summary-row"><div class="type-label" style="background-color: ${TYPE_COLORS[t]}; width: 60px;">${t.substring(0,3).toUpperCase()}</div><div class="summary-sprites">${dataObj[t].map(m => `<img src="${m.sprite}" title="${m.name}">`).join('')}</div></div>`).join('');
    return `<details><summary style="color: ${color};"><strong>${title}</strong></summary><div class="summary-content">${contentHtml}</div></details>`;
  };

  container.innerHTML = `
    <h3 style="color:#ffcc00; font-size:14px; margin-bottom:10px;">Defensive Profile</h3>
    ${buildSection('🔻 Weaknesses', '#ff4444', weaknesses)}
    ${buildSection('🛡️ Resistances', '#4CAF50', resistances)}
    ${buildSection('🚫 Immunities', '#4a90e2', immunities)}
  `;
}

// --- SIMULATOR ---
function loadSimOpponent() {
    let text = document.getElementById('sim-opp-paste').value; let blocks = text.trim().split(/\n\s*\n/); simOppTeam = [];
    blocks.forEach(block => {
        let lines = block.split('\n'); if (lines.length === 0 || lines[0] === '') return;
        let firstLine = lines[0].trim(); if (firstLine.includes('@')) firstLine = firstLine.split('@')[0].trim();
        firstLine = firstLine.replace(/\s*\([MFN]\)$/i, '').trim();
        let species = firstLine; let match = firstLine.match(/.*\(([^)]+)\)$/); if (match) species = match[1].trim();
        let jsonId = species.toLowerCase().replace(/[^a-z0-9]/g, ''); let monData = showdownData[jsonId] || Object.values(showdownData).find(d => d.name === species);
        if (monData) {
            simOppTeam.push({ id: jsonId, name: monData.name, sprite: `sprites/${jsonId}.png`, types: monData.types });
        }
    });
    document.getElementById('sim-opp-team').innerHTML = simOppTeam.map(mon => `<div class="sim-slot"><img src="${mon.sprite}" onerror="this.style.opacity='0'"></div>`).join('');
}

function get1v1Score(myMon, oppMon) {
    let myBaseSpe = showdownData[myMon.id] ? showdownData[myMon.id].baseStats.spe : 50; let mySpd = calcLv50Stat(myBaseSpe);
    if(myMon.item === 'Choice Scarf') mySpd = Math.floor(mySpd * 1.5); 
    let oppBaseSpe = showdownData[oppMon.id] ? showdownData[oppMon.id].baseStats.spe : 50; let oppSpd = calcLv50Stat(oppBaseSpe);
    
    let myMaxOffense = 0; myMon.types.forEach(t => { let mult = getDefensiveMultiplier(oppMon.types, t); if (mult > myMaxOffense) myMaxOffense = mult; });
    let theirMaxOffense = 0; oppMon.types.forEach(t => { let mult = getDefensiveMultiplier(myMon.types, t); if (mult > theirMaxOffense) theirMaxOffense = mult; });

    let score = 0;
    if (myMaxOffense > theirMaxOffense) score += 1; else if (myMaxOffense < theirMaxOffense) score -= 1;
    if (mySpd > oppSpd) score += 0.5; else if (mySpd < oppSpd) score -= 0.5;
    return score;
}

function generate1v1LeadMatrix() {
    let matrixDiv = document.getElementById('sim-matrix-results');
    if (currentTeam.length === 0 || simOppTeam.length === 0) { alert("Load both teams first!"); return; }

    let html = '<h3 style="color:#9c27b0; font-size:14px; margin-top:0;">Turn 1 Lead Matrix (1v1)</h3><div style="overflow-x: auto;"><table class="matrix-table"><tr><th style="min-width: 60px;">VS</th>';
    simOppTeam.forEach(opp => { html += `<th><img src="${opp.sprite}" class="matrix-sprite" onerror="this.style.opacity='0'"><br>${opp.name.substring(0, 8)}</th>`; }); html += '</tr>';
    
    currentTeam.forEach(myMon => {
        html += `<tr><th><img src="${myMon.sprite}" class="matrix-sprite" onerror="this.style.opacity='0'"><br>${myMon.name.substring(0, 8)}</th>`;
        simOppTeam.forEach(oppMon => {
            let score = get1v1Score(myMon, oppMon);
            let cellClass = "matrix-neutral"; let cellText = "Neutral";
            if (score >= 1) { cellClass = "matrix-great"; cellText = "Favorable"; } else if (score <= -1) { cellClass = "matrix-terrible"; cellText = "Poor"; }
            else if (score > 0) { cellClass = "matrix-good"; cellText = "Slight Adv"; } else if (score < 0) { cellClass = "matrix-bad"; cellText = "Slight Dis"; }
            html += `<td class="${cellClass}">${cellText}</td>`;
        });
        html += '</tr>';
    });
    html += '</table></div>'; matrixDiv.innerHTML = html;
}

function generate2v2LeadMatrix() {
    let matrixDiv = document.getElementById('sim-matrix-results');
    if (currentTeam.length < 2 || simOppTeam.length < 2) { alert("Need at least 2 Pokémon on both teams!"); return; }

    let html = '<h3 style="color:#2196F3; font-size:14px; margin-top:0;">Turn 1 Duo Lead Matrix (2v2)</h3><div style="overflow-x: auto;"><table class="matrix-table"><tr><th style="min-width: 60px;">VS</th>';
    let oppPairs = []; for(let i=0; i<simOppTeam.length; i++) { for(let j=i+1; j<simOppTeam.length; j++) { oppPairs.push([simOppTeam[i], simOppTeam[j]]); } }
    let myPairs = []; for(let i=0; i<currentTeam.length; i++) { for(let j=i+1; j<currentTeam.length; j++) { myPairs.push([currentTeam[i], currentTeam[j]]); } }

    oppPairs.forEach(opp => { html += `<th><img src="${opp[0].sprite}" style="height:24px; image-rendering:pixelated; margin-right:-5px;" onerror="this.style.opacity='0'"><img src="${opp[1].sprite}" style="height:24px; image-rendering:pixelated;" onerror="this.style.opacity='0'"></th>`; }); html += '</tr>';
    myPairs.forEach(myPair => {
        html += `<tr><th><img src="${myPair[0].sprite}" style="height:24px; image-rendering:pixelated; margin-right:-5px;" onerror="this.style.opacity='0'"><img src="${myPair[1].sprite}" style="height:24px; image-rendering:pixelated;" onerror="this.style.opacity='0'"></th>`;
        oppPairs.forEach(oppPair => {
            let score = get1v1Score(myPair[0], oppPair[0]) + get1v1Score(myPair[0], oppPair[1]) + get1v1Score(myPair[1], oppPair[0]) + get1v1Score(myPair[1], oppPair[1]);
            let cellClass = "matrix-neutral"; let cellText = "Neutral";
            if (score >= 2) { cellClass = "matrix-great"; cellText = "Favorable"; } else if (score <= -2) { cellClass = "matrix-terrible"; cellText = "Poor"; }
            else if (score > 0) { cellClass = "matrix-good"; cellText = "Adv"; } else if (score < 0) { cellClass = "matrix-bad"; cellText = "Dis"; }
            html += `<td class="${cellClass}">${cellText}</td>`;
        });
        html += '</tr>';
    });
    html += '</table></div>'; matrixDiv.innerHTML = html;
}

// Side Menu Logic
document.getElementById('menu-btn').addEventListener('click', toggleMenuMobile);

// Infinite Teams System
let allMyTeams = JSON.parse(localStorage.getItem('vgc_vault_all_teams')) || { "default": [] };
let activeTeamId = "default";

function createNewTeam() {
    let name = prompt("Enter a name for your new team:");
    if (!name) return;
    let newId = 'team_' + Date.now();
    allMyTeams[newId] = [];
    activeTeamId = newId;
    currentTeam = [];
    
    // Update Dropdown
    let selector = document.getElementById('team-selector');
    let option = document.createElement("option");
    option.value = newId; option.text = name;
    selector.add(option);
    selector.value = newId;
    
    saveAllTeams();
}

function loadSelectedTeam() {
    activeTeamId = document.getElementById('team-selector').value;
    currentTeam = allMyTeams[activeTeamId] || [];
    renderAllUI();
}

function saveAllTeams() {
    localStorage.setItem('vgc_vault_all_teams', JSON.stringify(allMyTeams));
    renderAllUI();
}

// Modals Setup
window.onclick = function(event) {
  if (event.target == document.getElementById('data-modal')) document.getElementById('data-modal').style.display = 'none';
  if (event.target == document.getElementById('edit-modal')) document.getElementById('edit-modal').style.display = 'none';
  if (event.target == document.getElementById('import-modal')) document.getElementById('import-modal').style.display = 'none';
  if (event.target == document.getElementById('pro-gallery-modal')) document.getElementById('pro-gallery-modal').style.display = 'none';
}

// --- PRO TEAM VISUAL GALLERY LOGIC ---
let proGalleryTarget = 'builder'; // Tracks if we opened it from Builder or Sim

function openProTeamGallery(target) {
    proGalleryTarget = target;
    let galleryGrid = document.getElementById('pro-gallery-grid');
    galleryGrid.innerHTML = "";

    // Helper to extract Pokemon IDs and turn them into Sprites
    const extractSprites = (showdownText) => {
        let spritesHTML = "";
        let blocks = showdownText.trim().split(/\n\s*\n/);
        
        blocks.forEach(block => {
            let firstLine = block.split('\n')[0].trim();
            if(!firstLine) return;
            
            // Strip items and genders
            if (firstLine.includes('@')) firstLine = firstLine.split('@')[0].trim();
            firstLine = firstLine.replace(/\s*\([MFN]\)$/i, '').trim();
            
            let species = firstLine;
            let match = firstLine.match(/.*\(([^)]+)\)$/); // Get real species if nicknamed
            if (match) species = match[1].trim();
            
            let jsonId = species.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            // Handle edge cases
            if (jsonId === 'indeedeef' || jsonId === 'indeedee-f') jsonId = 'indeedeef';
            if (jsonId === 'gastrodoneast') jsonId = 'gastrodoneast';
            if (block.toLowerCase().includes('ite') && !block.toLowerCase().includes('eviolite') && !jsonId.includes('mega')) {
                jsonId = jsonId + "mega"; // Force megas to show their mega sprite
            }

            spritesHTML += `<img src="sprites/${jsonId}.png" style="width: 45px; height: 45px; image-rendering: pixelated; margin-right: -10px;" onerror="this.src='sprites/substitute.png'; this.style.opacity='0'">`;
        });
        return spritesHTML;
    };

    // Nice Titles for the UI
    const teamTitles = {
        "worlds2024": "Worlds 2024 (Luca Ceribelli)",
        "naic2024": "NAIC 2024 (Patrick Connors)",
        "worlds2023": "Worlds 2023 (Shohei Kimura)",
        "worlds2022": "Worlds 2022 (Eduardo Cunha)",
        "worlds2019": "Worlds 2019 (Naoto Mizobuchi)",
        "worlds2018": "Worlds 2018 (Paul Ruiz)",
        "worlds2016": "Worlds 2016 (Wolfe Glick)",
        "worlds2015": "Worlds 2015 (Shoma Honami)",
        "worlds2014": "Worlds 2014 (Se Jun Park)"
    };

    // Build the visual cards
    for (let key in TOP_CUT_TEAMS) {
        let title = teamTitles[key] || key;
        let text = TOP_CUT_TEAMS[key];
        let sprites = extractSprites(text);
        
        galleryGrid.innerHTML += `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: 0.2s;" onmouseover="this.style.borderColor='#38bdf8'; this.style.background='#0f172a';" onmouseout="this.style.borderColor='#334155'; this.style.background='#1e293b';" onclick="selectProTeam('${key}')">
                <div>
                    <div style="color: #ffcc00; font-size: 14px; font-weight: bold; margin-bottom: 8px; text-align: left;">${title}</div>
                    <div style="display: flex;">${sprites}</div>
                </div>
                <div style="font-size: 24px;">📥</div>
            </div>
        `;
    }

    document.getElementById('pro-gallery-modal').style.display = 'flex';
}

function selectProTeam(key) {
    document.getElementById('pro-gallery-modal').style.display = 'none';
    
    if (proGalleryTarget === 'builder') {
        document.getElementById('import-text').value = TOP_CUT_TEAMS[key];
        processImport();
        alert("Pro Team loaded into the Builder!");
    } else {
        document.getElementById('sim-opp-paste').value = TOP_CUT_TEAMS[key];
        loadSimOpponent();
    }
}