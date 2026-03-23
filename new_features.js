// --- NEW BEGINNER COACH FEATURES ---

let beginnerModeEnabled = true;

// 1. Starter Kit Auto-Fill Database
const STARTER_KITS = {
    "incineroar": { item: "Sitrus Berry", moves: ["Flare Blitz", "Knock Off", "Parting Shot", "Fake Out"] },
    "amoonguss": { item: "Rocky Helmet", moves: ["Spore", "Pollen Puff", "Rage Powder", "Protect"] },
    "rillaboom": { item: "Assault Vest", moves: ["Grassy Glide", "Wood Hammer", "U-turn", "Fake Out"] },
    "charizardmegay": { item: "Charizardite Y", moves: ["Heat Wave", "Solar Beam", "Tailwind", "Protect"] },
    "urshifurapidstrike": { item: "Choice Scarf", moves: ["Surging Strikes", "Close Combat", "Aqua Jet", "U-turn"] },
    "pelipper": { item: "Focus Sash", moves: ["Weather Ball", "Hurricane", "Tailwind", "Wide Guard"] },
    "gholdengo": { item: "Choice Specs", moves: ["Make It Rain", "Shadow Ball", "Thunderbolt", "Trick"] },
    "default": { item: "Life Orb", moves: ["Protect"] }
};

function toggleBeginnerMode() {
    beginnerModeEnabled = document.getElementById('coach-toggle').checked;
    renderAllUI();
}

function loadStarterKit(index) {
    let mon = currentTeam[index];
    let baseId = mon.id.replace(/mega[a-z]?$/, '');
    let kit = STARTER_KITS[mon.id] || STARTER_KITS[baseId] || STARTER_KITS["default"];
    
    document.getElementById('edit-item').value = kit.item;
    
    if (kit.moves[0]) document.getElementById('edit-move1').value = kit.moves[0];
    if (kit.moves[1]) document.getElementById('edit-move2').value = kit.moves[1];
    if (kit.moves[2]) document.getElementById('edit-move3').value = kit.moves[2];
    if (kit.moves[3]) document.getElementById('edit-move4').value = kit.moves[3];
    
    alert(`Loaded standard VGC Starter Kit for ${mon.name}!`);
}

// 2 & 3. Role Tags & Turn 1 Flow Indicators
function applyCardDecorations() {
    if (!beginnerModeEnabled) return;
    
    let slots = document.querySelectorAll('.team-slot.filled');
    slots.forEach((slot, i) => {
        let mon = currentTeam[i];
        if (!mon) return;

        let iconsHTML = "";
        if (mon.moves.includes('Fake Out')) iconsHTML += `<span style="pointer-events: auto; cursor: help;" title="Has Fake Out">✋</span>`;
        if (['Protect', 'Detect', 'Spiky Shield', 'Wide Guard'].some(m => mon.moves.includes(m))) iconsHTML += `<span style="pointer-events: auto; cursor: help;" title="Has Protect">🛡️</span>`;
        if (['Follow Me', 'Rage Powder'].some(m => mon.moves.includes(m))) iconsHTML += `<span style="pointer-events: auto; cursor: help;" title="Has Redirection">🧲</span>`;
        if (['Tailwind', 'Trick Room', 'Icy Wind', 'Electroweb'].some(m => mon.moves.includes(m))) iconsHTML += `<span style="pointer-events: auto; cursor: help;" title="Has Speed Control">⏱️</span>`;
        
        if (iconsHTML !== "") {
            slot.insertAdjacentHTML('beforeend', `<div class="flow-icons" style="position: absolute; top: -5px; left: -5px; display: flex; flex-direction: column; gap: 2px; z-index: 20; font-size: 12px;">${iconsHTML}</div>`);
        }

        let tagClass = ""; let tagText = ""; 
        let atk = showdownData[mon.id] ? showdownData[mon.id].baseStats.atk : 50;
        let spa = showdownData[mon.id] ? showdownData[mon.id].baseStats.spa : 50;
        let isSupport = ['Fake Out', 'Parting Shot', 'Spore', 'Tailwind', 'Will-O-Wisp'].filter(m => mon.moves.includes(m)).length >= 2;

        if (isSupport || mon.item === 'Mental Herb') { tagClass = "#10b981"; tagText = "SUPPORT"; }
        else if (mon.item === 'Assault Vest' || mon.item === 'Rocky Helmet' || mon.ability === 'Regenerator') { tagClass = "#8b5cf6"; tagText = "BULKY"; }
        else if (atk > spa) { tagClass = "#ef4444"; tagText = "PHYSICAL"; }
        else { tagClass = "#3b82f6"; tagText = "SPECIAL"; }

        if (mon.moves.length > 0) {
            slot.insertAdjacentHTML('beforeend', `
                <div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); font-size: 8px; padding: 2px 6px; border-radius: 4px; font-weight: bold; background: ${tagClass}; color: white; z-index: 20;">
                    ${tagText}
                </div>
            `);
        }
    });
}

// 4. The Rookie Mistake Checker
function runRookieMistakeChecker() {
    let container = document.getElementById('rookie-mistake-container');
    if (!container) {
        document.getElementById('type-summary-container').insertAdjacentHTML('beforebegin', `<div id="rookie-mistake-container" style="margin-bottom: 15px;"></div>`);
        container = document.getElementById('rookie-mistake-container');
    }
    
    if (!beginnerModeEnabled || currentTeam.length === 0) {
        container.innerHTML = ""; return;
    }

    let mistakes = [];
    let protectCount = 0; let speedControl = false; let weatherSetters = 0;

    currentTeam.forEach(mon => {
        let damagingMoveCount = 0; let totalMovesEquipped = 0; let hasStatus = false;
        mon.moves.forEach(m => {
            if (m) {
                totalMovesEquipped++;
                let moveId = m.toLowerCase().replace(/[^a-z0-9]/g, '');
                let moveData = movesData[moveId] || Object.values(movesData).find(d => d.name === m);
                if (moveData) {
                    if (moveData.category === "Status") hasStatus = true;
                    else damagingMoveCount++;
                }
            }
        });

        if (mon.item === 'Assault Vest' && hasStatus) mistakes.push(`<strong>Assault Vest Error:</strong> ${mon.name} holds an Assault Vest but has a Status move!`);
        if (totalMovesEquipped > 0 && damagingMoveCount === 0) mistakes.push(`<strong>Taunt Bait:</strong> ${mon.name} has zero attacking moves!`);
        
        if (['Protect', 'Detect', 'Spiky Shield'].some(m => mon.moves.includes(m))) protectCount++;
        if (['Tailwind', 'Trick Room', 'Icy Wind', 'Electroweb'].some(m => mon.moves.includes(m))) speedControl = true;
        if (['Drizzle', 'Drought', 'Sand Stream', 'Snow Warning'].includes(mon.ability)) weatherSetters++;
    });

    if (currentTeam.length >= 4 && protectCount < 2) mistakes.push(`<strong>Vulnerable Team:</strong> You only have ${protectCount} Protect users. 3-4 is recommended.`);
    if (currentTeam.length >= 4 && !speedControl) mistakes.push(`<strong>No Speed Control:</strong> Your team has no Tailwind or Trick Room.`);
    if (weatherSetters > 1) mistakes.push(`<strong>Weather Clash:</strong> You have multiple auto-weather setters. They will override each other!`);

    if (mistakes.length > 0) {
        let html = `<h4 style="margin:0 0 5px 0; color:#ef4444; font-size:12px;">🚨 Rookie Coach Alerts</h4>`;
        mistakes.forEach(m => html += `<div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 8px; margin-bottom: 5px; border-radius: 4px; font-size: 11px; color: #fca5a5;">⚠️ ${m}</div>`);
        container.innerHTML = html;
    } else {
        container.innerHTML = `<div style="background:#14532d; border-left:4px solid #4ade80; padding:10px; margin-bottom:8px; border-radius:4px; font-size:11px; color:#a7f3d0;">✅ <strong>Coach Says:</strong> Your team fundamentals look solid! No major rookie mistakes detected.</div>`;
    }
}

// Master Hook
function runNewFeaturesHook() {
    applyCardDecorations();
    runRookieMistakeChecker();
}

// 7. Quick Add Autocomplete Search
function handleQuickAddSearch() {
    let input = document.getElementById('quick-add-input').value.toLowerCase().trim();
    let resultsBox = document.getElementById('quick-add-results');
    
    if (input.length < 1) { resultsBox.style.display = 'none'; return; }

    // Banned Mons list for Regulation A constraints
    const RESTRICTED = [
        "calyrexice", "urshifurapidstrike", "ragingbolt", "ogerponhearthflame", 
        "fluttermane", "ironhands", "landorustherian", "chienpao", 
        "calyrexshadow", "thundurus", "zaciancrowned", "groudon", 
        "kyogre", "tapufini", "tapukoko", "kartana", "rayquaza", 
        "hitmontop", "heatran", "cresselia", "pachirisu"
    ];

    let matches = [];
    Object.keys(showdownData).forEach(id => {
        let monData = showdownData[id];
        
        // 🚨 Block restricted mons and Megas from quick search results
        if (RESTRICTED.includes(id) || id.includes('mega')) return;

        if (!monData.isNonstandard && (monData.name.toLowerCase().includes(input) || id.includes(input))) {
            matches.push({ id: id, name: monData.name });
        }
    });

    matches.sort((a, b) => {
        let aStarts = a.name.toLowerCase().startsWith(input) ? -1 : 1;
        let bStarts = b.name.toLowerCase().startsWith(input) ? -1 : 1;
        return aStarts - bStarts || a.name.localeCompare(b.name);
    });

    matches = matches.slice(0, 8);

    if (matches.length > 0) {
        let html = "";
        matches.forEach(match => {
            html += `
                <div style="display:flex; align-items:center; padding: 8px 15px; cursor: pointer; border-bottom: 1px solid #334155;" 
                     onmouseover="this.style.background='#1e293b'" onmouseout="this.style.background='transparent'"
                     onclick="selectQuickAdd('${match.id}', '${match.name.replace(/'/g, "\\'")}', 'sprites/${match.id}.png')">
                    <img src="sprites/${match.id}.png" style="height:35px; image-rendering:pixelated; margin-right: 15px;" onerror="this.style.opacity='0'">
                    <span style="color:#fff; font-weight:bold; font-size: 13px;">${match.name}</span>
                </div>
            `;
        });
        resultsBox.innerHTML = html;
        resultsBox.style.display = 'block';
    } else {
        resultsBox.innerHTML = `<div style="padding: 10px; color: #888; font-size: 12px; text-align: center;">No Pokémon found.</div>`;
        resultsBox.style.display = 'block';
    }
}

function selectQuickAdd(id, name, spriteUrl) {
    document.getElementById('quick-add-input').value = "";
    document.getElementById('quick-add-results').style.display = 'none';
    openMonDetails(id);
}

document.addEventListener('click', function(e) {
    let searchBox = document.getElementById('quick-add-input');
    let resultsBox = document.getElementById('quick-add-results');
    if (searchBox && resultsBox && e.target !== searchBox && !resultsBox.contains(e.target)) {
        resultsBox.style.display = 'none';
    }
});