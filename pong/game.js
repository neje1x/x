const canvas   = document.getElementById('canvas');
const ctx      = canvas.getContext('2d');
const msgEl    = document.getElementById('msg');
const scoreL   = document.getElementById('score-left');
const scoreR   = document.getElementById('score-right');
const overlay  = document.getElementById('win-overlay');
const winText  = document.getElementById('win-text');
const finalSc  = document.getElementById('final-score');
const menuOv   = document.getElementById('menu-overlay');
const stepMode = document.getElementById('step-mode');
const stepDiff = document.getElementById('step-diff');
const playWrap = document.getElementById('play-btn-wrap');
const gemCountEl = document.getElementById('gem-count');

const W = 800, H = 500;
canvas.width  = W;
canvas.height = H;

const PAD_W = 12, PAD_H = 80;
const BALL_SIZE = 10;
const WIN_SCORE = 10;
const BOSS_TARGET = 50;
const COLOR_LEFT  = '#44aaff';
const COLOR_RIGHT = '#ff4444';

// ══════════════════════════════════════════════
// GEM SYSTEM
// ══════════════════════════════════════════════
function getGems() { return parseInt(localStorage.getItem('pong_gems') || '0'); }
function setGems(n) { localStorage.setItem('pong_gems', n); updateGemUI(); }
function addGems(n) { setGems(getGems() + n); }
function updateGemUI() {
    const g = getGems();
    gemCountEl.textContent = g;
    document.getElementById('shop-gem-count').textContent = g;
}

function showGemPopup(text) {
    const el = document.getElementById('gem-popup');
    el.textContent = text;
    el.classList.remove('hidden');
    void el.offsetWidth;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add('hidden'), 1500);
}

// ══════════════════════════════════════════════
// STREAK
// ══════════════════════════════════════════════
let streak = 0;

function showStreakPopup(n) {
    const el = document.getElementById('streak-popup');
    el.textContent = `🔥 ${n}x STREAK! +45 💎`;
    el.classList.remove('hidden');
    void el.offsetWidth;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add('hidden'), 1800);
}

// ══════════════════════════════════════════════
// POWER-UPS DEFINITION
// ══════════════════════════════════════════════
const POWERUPS = [
    {
        id: 'bigpad',
        name: 'Velika Palica',
        icon: '📏',
        desc: 'Poveča tvojo palico za 60% na 10 sekund',
        cost: 80,
        key: '1',
        duration: 10000,
    },
    {
        id: 'turbo',
        name: 'Turbo',
        icon: '⚡',
        desc: 'Podvoji hitrost palice na 8 sekund',
        cost: 60,
        key: '2',
        duration: 8000,
    },
    {
        id: 'freeze',
        name: 'Zamrzni',
        icon: '🧊',
        desc: 'Zamrzne nasprotnikovo palico za 3 sekunde',
        cost: 120,
        key: '3',
        duration: 3000,
    },
    {
        id: 'shrink',
        name: 'Pomanjšaj',
        icon: '🌀',
        desc: 'Zmanjša nasprotnikovo palico za 10 sekund',
        cost: 100,
        key: '4',
        duration: 10000,
    },
    {
        id: 'slowball',
        name: 'Počasna Žoga',
        icon: '🐢',
        desc: 'Upočasni žogico na 6 sekund',
        cost: 70,
        key: '5',
        duration: 6000,
    },
    {
        id: 'ghost',
        name: 'Duh',
        icon: '👻',
        desc: 'Tvoja palica postane nevidna nasprotniku (6s)',
        cost: 90,
        key: '6',
        duration: 6000,
    },
];

function getOwned() {
    const raw = localStorage.getItem('pong_items');
    return raw ? JSON.parse(raw) : {};
}
function setOwned(obj) { localStorage.setItem('pong_items', JSON.stringify(obj)); }
function getOwnedCount(id) { return (getOwned()[id] || 0); }
function addOwned(id, n = 1) {
    const o = getOwned();
    o[id] = (o[id] || 0) + n;
    setOwned(o);
}
function useOwned(id) {
    const o = getOwned();
    if ((o[id] || 0) <= 0) return false;
    o[id]--;
    setOwned(o);
    return true;
}

// Active effects per player: activeEffects[0] = blue, activeEffects[1] = red
const activeEffects = [{}, {}];

// Naključna super moč ob odboju (brez porabe inventarja)
function triggerRandomPowerup(side) {
    if (mode !== '2p') return;
    const pu = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
    applyEffect(pu, side);
    showGemPopup(`${pu.icon} ${pu.name}!`);
    renderPowerupBar();
    updateEffectsUI();
}

// side = 0 (blue/left), 1 (red/right)
function activatePowerup(id, side) {
    if (!state.running) return;
    if (!useOwned(id)) return;
    const pu = POWERUPS.find(p => p.id === id);
    if (!pu) return;

    applyEffect(pu, side);
    updateEffectsUI();
    renderPowerupBar();
}

function applyEffect(pu, side) {
    const ef = activeEffects[side];
    if (ef[pu.id]) clearTimeout(ef[pu.id].timer);
    ef[pu.id] = {
        timer: setTimeout(() => {
            delete activeEffects[side][pu.id];
            updateEffectsUI();
            renderPowerupBar();
        }, pu.duration),
        endsAt: Date.now() + pu.duration,
    };
}

// Self-buff: id active for own side
function isActiveSelf(id, side) { return !!activeEffects[side][id]; }
// Opponent debuff: activated by opponent
function isActiveOpp(id, side)  { return !!activeEffects[1 - side][id]; }

// Convenience for draw/update (always from perspective of each paddle)
// side 0 = left/blue, side 1 = right/red
function padH(side) {
    const base = (mode === 'boss' && side === 1) ? PAD_H * 2.5 : PAD_H;
    if (isActiveSelf('bigpad', side)) return base * 1.6;
    if (isActiveOpp('shrink', side))  return base * 0.5;
    return base;
}
function padSpeed(side) {
    return isActiveSelf('turbo', side) ? 10 : 5;
}
function isFrozen(side) {
    return isActiveOpp('freeze', side);
}
function isGhost(side) {
    return isActiveSelf('ghost', side);
}
function isSlow() {
    return activeEffects[0].slowball || activeEffects[1].slowball;
}

function updateEffectsUI() {
    let el = document.getElementById('active-effects');
    if (!el) {
        el = document.createElement('div');
        el.id = 'active-effects';
        document.getElementById('canvas-wrap').appendChild(el);
    }
    const badges = [];
    [0, 1].forEach(side => {
        Object.keys(activeEffects[side]).forEach(id => {
            const pu  = POWERUPS.find(p => p.id === id);
            const rem = Math.ceil((activeEffects[side][id].endsAt - Date.now()) / 1000);
            const who = side === 0 ? '🔵' : '🔴';
            badges.push(`<div class="effect-badge">${who}${pu.icon} ${rem}s</div>`);
        });
    });
    el.innerHTML = badges.join('');
}

function renderPowerupBar() {
    const bar   = document.getElementById('powerup-bar');
    const owned = getOwned();
    const twoP  = mode === '2p';

    bar.innerHTML = POWERUPS.map(pu => {
        const cnt  = owned[pu.id] || 0;
        const act0 = isActiveSelf(pu.id, 0);
        const act1 = isActiveSelf(pu.id, 1);
        return `<div class="pu-slot${cnt === 0 ? ' empty' : ''}${act0 ? ' active' : ''}" data-id="${pu.id}" data-side="0">
            <div class="pu-icon">${pu.icon}</div>
            <div class="pu-count">${cnt}x</div>
            <div class="pu-key">${twoP ? `[${pu.key}]🔵` : `[${pu.key}]`}</div>
        </div>
        ${twoP ? `<div class="pu-slot${cnt === 0 ? ' empty' : ''}${act1 ? ' active red-act' : ''}" data-id="${pu.id}" data-side="1">
            <div class="pu-icon">${pu.icon}</div>
            <div class="pu-count">${cnt}x</div>
            <div class="pu-key">[N${pu.key}]🔴</div>
        </div>` : ''}`;
    }).join('');

    bar.querySelectorAll('.pu-slot:not(.empty)').forEach(slot => {
        slot.addEventListener('click', () =>
            activatePowerup(slot.dataset.id, parseInt(slot.dataset.side))
        );
    });
}

function clearAllEffects() {
    [0, 1].forEach(side => {
        Object.keys(activeEffects[side]).forEach(id => {
            clearTimeout(activeEffects[side][id].timer);
            delete activeEffects[side][id];
        });
    });
    updateEffectsUI();
}

// ══════════════════════════════════════════════
// SKINS
// ══════════════════════════════════════════════
const SKINS = [
    { id: 'default',  name: 'Modra',      color: '#44aaff', cost: 0    },
    { id: 'cyan',     name: 'Cyan',       color: '#00ffee', cost: 300  },
    { id: 'green',    name: 'Zelena',     color: '#44ff88', cost: 200  },
    { id: 'purple',   name: 'Vijolična',  color: '#aa44ff', cost: 500  },
    { id: 'pink',     name: 'Roza',       color: '#ff44aa', cost: 600  },
    { id: 'white',    name: 'Bela',       color: '#ffffff', cost: 400  },
    { id: 'fire',     name: 'Ognjena',    color: '#ff6600', cost: 800  },
    { id: 'gold',     name: 'Zlata',      color: '#ffcc00', cost: 1000 },
];

function getOwnedSkins() {
    const raw = localStorage.getItem('pong_skins');
    return raw ? JSON.parse(raw) : ['default'];
}
function setOwnedSkins(arr) { localStorage.setItem('pong_skins', JSON.stringify(arr)); }
function getActiveSkin() { return localStorage.getItem('pong_skin_active') || 'default'; }
function setActiveSkin(id) { localStorage.setItem('pong_skin_active', id); }
function getActiveSkinColor() {
    const s = SKINS.find(s => s.id === getActiveSkin());
    return s ? s.color : '#44aaff';
}

function renderSkinShop() {
    updateGemUI();
    const gems     = getGems();
    const owned    = getOwnedSkins();
    const active   = getActiveSkin();
    document.getElementById('shop-skins').innerHTML = `
        <div class="skin-grid">
        ${SKINS.map(sk => {
            const isOwned  = owned.includes(sk.id);
            const isActive = sk.id === active;
            return `<div class="skin-card${isActive ? ' skin-active' : ''}">
                <div class="skin-preview" style="background:${sk.color};box-shadow:0 0 16px ${sk.color}88"></div>
                <div class="skin-name">${sk.name}</div>
                ${isOwned
                    ? `<button class="skin-btn${isActive ? ' skin-btn-on' : ''}" data-id="${sk.id}" data-action="equip">
                           ${isActive ? '✔ Opremljeno' : 'Opremiti'}
                       </button>`
                    : `<button class="skin-btn skin-btn-buy" data-id="${sk.id}" data-action="buy" ${gems < sk.cost ? 'disabled' : ''}>
                           ${sk.cost} 💎
                       </button>`
                }
            </div>`;
        }).join('')}
        </div>`;

    document.querySelectorAll('[data-action="buy"]:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', () => {
            const sk = SKINS.find(s => s.id === btn.dataset.id);
            if (getGems() < sk.cost) return;
            addGems(-sk.cost);
            const owned2 = getOwnedSkins();
            owned2.push(sk.id);
            setOwnedSkins(owned2);
            renderSkinShop();
        });
    });
    document.querySelectorAll('[data-action="equip"]').forEach(btn => {
        btn.addEventListener('click', () => {
            setActiveSkin(btn.dataset.id);
            renderSkinShop();
        });
    });
}

// ══════════════════════════════════════════════
// SHOP
// ══════════════════════════════════════════════
function renderShop() {
    updateGemUI();
    const gems = getGems();
    const owned = getOwned();
    document.getElementById('shop-items').innerHTML = POWERUPS.map(pu => `
        <div class="shop-card">
            <div class="shop-card-top">
                <div class="shop-card-icon">${pu.icon}</div>
                <div>
                    <div class="shop-card-name">${pu.name}</div>
                </div>
            </div>
            <div class="shop-card-desc">${pu.desc}</div>
            <div class="shop-card-bottom">
                <div class="shop-card-owned">Imaš: ${owned[pu.id] || 0}x</div>
                <button class="shop-buy-btn" data-id="${pu.id}" ${gems < pu.cost ? 'disabled' : ''}>
                    Kupi <span class="cost">${pu.cost} 💎</span>
                </button>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.shop-buy-btn:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', () => {
            const pu = POWERUPS.find(p => p.id === btn.dataset.id);
            if (getGems() < pu.cost) return;
            addGems(-pu.cost);
            addOwned(pu.id);
            renderShop();
            renderPowerupBar();
        });
    });
}

document.getElementById('btn-shop').addEventListener('click', () => {
    renderShop();
    document.getElementById('shop-overlay').classList.remove('hidden');
    // reset na Power tab
    document.getElementById('tab-power').classList.add('active');
    document.getElementById('tab-skin').classList.remove('active');
    document.getElementById('shop-items').classList.remove('hidden');
    document.getElementById('shop-skins').classList.add('hidden');
});
document.getElementById('tab-power').addEventListener('click', () => {
    document.getElementById('tab-power').classList.add('active');
    document.getElementById('tab-skin').classList.remove('active');
    document.getElementById('shop-items').classList.remove('hidden');
    document.getElementById('shop-skins').classList.add('hidden');
    renderShop();
});
document.getElementById('tab-skin').addEventListener('click', () => {
    document.getElementById('tab-skin').classList.add('active');
    document.getElementById('tab-power').classList.remove('active');
    document.getElementById('shop-skins').classList.remove('hidden');
    document.getElementById('shop-items').classList.add('hidden');
    renderSkinShop();
});
document.getElementById('btn-shop-back').addEventListener('click', () => {
    document.getElementById('shop-overlay').classList.add('hidden');
});

// ══════════════════════════════════════════════
// AI
// ══════════════════════════════════════════════
const AI_CFG = {
    easy:   { speed: 1.8, errorY: 90, updateChance: 0.02 },
    medium: { speed: 3.0, errorY: 45, updateChance: 0.07 },
    hard:   { speed: 5.0, errorY: 18, updateChance: 0.5  },
    boss:   { speed: 8.0, errorY: 3,  updateChance: 1.0  },
};

let mode = '2p';
let diff = 'medium';
let aiTargetY = H / 2;
let redAutoPilot = false;
let bossHits = 0;
let bossLives = 3;

function predictBallY(targetX) {
    const b = state.ball;
    if (b.dx <= 0) return H / 2;
    let x = b.x, y = b.y, dy = b.dy;
    let steps = 0;
    while (x < targetX && steps < 500) {
        x += b.dx; y += dy; steps++;
        if (y - BALL_SIZE / 2 <= 0) { y = BALL_SIZE / 2; dy = Math.abs(dy); }
        if (y + BALL_SIZE / 2 >= H) { y = H - BALL_SIZE / 2; dy = -Math.abs(dy); }
    }
    return y;
}

function refreshAiTarget() {
    const cfg = AI_CFG[diff];
    if (Math.random() > cfg.updateChance) return;
    if (state.ball.dx > 0) {
        const py = predictBallY(W - 10 - PAD_W - BALL_SIZE / 2);
        aiTargetY = py + (Math.random() - 0.5) * 2 * cfg.errorY;
    } else {
        aiTargetY = H / 2;
    }
}

function updateAI() {
    if (isFrozen(1)) return;
    const cfg    = AI_CFG[diff];
    const rPadH  = padH(1);
    const padMid = state.right.y + rPadH / 2;
    const delta  = aiTargetY - padMid;
    if (Math.abs(delta) > 1)
        state.right.y += Math.sign(delta) * Math.min(cfg.speed, Math.abs(delta));
    state.right.y = Math.max(0, Math.min(H - rPadH, state.right.y));
}

// ══════════════════════════════════════════════
// GAME STATE
// ══════════════════════════════════════════════
const state = {
    running: false, over: false,
    score: [0, 0],
    left:  { y: H / 2 - PAD_H / 2 },
    right: { y: H / 2 - PAD_H / 2 },
    ball:  { x: W / 2, y: H / 2, dx: 0, dy: 0 },
    trail: [],
};

// ══════════════════════════════════════════════
// MENU BUTTONS
// ══════════════════════════════════════════════
document.getElementById('btn-2p').addEventListener('click', () => { mode = '2p'; startGame(); });
document.getElementById('btn-boss').addEventListener('click', () => { mode = 'boss'; diff = 'boss'; startGame(); });
document.getElementById('btn-vs-ai').addEventListener('click', () => {
    stepMode.classList.add('hidden');
    stepDiff.classList.remove('hidden');
});
document.getElementById('btn-back').addEventListener('click', () => {
    stepDiff.classList.add('hidden');
    stepMode.classList.remove('hidden');
});
document.querySelectorAll('.diff-card').forEach(btn => {
    btn.addEventListener('click', () => { diff = btn.dataset.diff; mode = 'ai'; startGame(); });
});
document.getElementById('btn-again').addEventListener('click', restartSameMode);
document.getElementById('btn-menu').addEventListener('click', goToMenu);
document.getElementById('btn-play').addEventListener('click', () => {
    if (!state.running && !state.over) startBall();
});

// ── Leaderboard ──
const lbOverlay = document.getElementById('lb-overlay');
document.getElementById('btn-lb').addEventListener('click', () => { renderLb(); lbOverlay.classList.remove('hidden'); });
document.getElementById('btn-lb-back').addEventListener('click', () => lbOverlay.classList.add('hidden'));
document.getElementById('btn-lb-reset').addEventListener('click', () => {
    if (confirm('Pobriši vso statistiko?')) { localStorage.removeItem('pong_lb'); renderLb(); }
});

// ── Keyboard ──
const keys = {};
document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') {
        e.preventDefault();
        if (!state.running && !state.over && menuOv.classList.contains('hidden')) startBall();
    }
    // Cheat: L = rdeči nepremagljiv auto-pilot (samo 2p)
    if (e.code === 'KeyL' && mode === '2p') {
        redAutoPilot = !redAutoPilot;
        showGemPopup(redAutoPilot ? '🤖 AUTO-PILOT ON' : '🤖 AUTO-PILOT OFF');
    }
    // Powerup keys — P1: 1-6, P2: Numpad1-6
    POWERUPS.forEach((pu, i) => {
        if (e.key === pu.key)                          activatePowerup(pu.id, 0);
        if (e.code === `Numpad${i + 1}`)               activatePowerup(pu.id, 1);
    });
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

// ══════════════════════════════════════════════
// GAME FLOW
// ══════════════════════════════════════════════
function showPlayBtn() { playWrap.classList.remove('hidden'); }
function hidePlayBtn() { playWrap.classList.add('hidden'); }

function startGame() {
    menuOv.classList.add('hidden');
    overlay.classList.add('hidden');
    resetState();
    msgEl.textContent = '';
    showPlayBtn();
    renderPowerupBar();
}

function restartSameMode() {
    overlay.classList.add('hidden');
    resetState();
    msgEl.textContent = '';
    showPlayBtn();
    renderPowerupBar();
}

function goToMenu() {
    overlay.classList.add('hidden');
    stepMode.classList.remove('hidden');
    stepDiff.classList.add('hidden');
    menuOv.classList.remove('hidden');
    resetState();
    msgEl.textContent = '';
    hidePlayBtn();
}

function resetState() {
    state.score = [0, 0]; state.over = false; state.running = false; state.trail = [];
    streak = 0;
    redAutoPilot = false;
    bossHits = 0;
    bossLives = 3;
    if (mode === 'boss') {
        document.getElementById('label-left').textContent  = 'ODBOJI';
        document.getElementById('label-right').textContent = 'ŽIVL.';
        scoreL.textContent = '0';
        scoreR.textContent = '❤️❤️❤️';
    } else {
        document.getElementById('label-left').textContent  = 'MODER';
        document.getElementById('label-right').textContent = 'RDEČ';
        scoreL.textContent = '0';
        scoreR.textContent = '0';
    }
    clearAllEffects();
    resetBall();
}

function resetBall() {
    state.ball.x = W / 2; state.ball.y = H / 2;
    state.ball.dx = 0; state.ball.dy = 0;
    state.trail = [];
    state.left.y  = H / 2 - PAD_H / 2;
    state.right.y = H / 2 - PAD_H / 2;
    aiTargetY = H / 2;
}

function startBall() {
    state.running = true;
    msgEl.textContent = '';
    hidePlayBtn();
    const angle = (Math.random() * 60 - 30) * Math.PI / 180;
    const dir = Math.random() < 0.5 ? 1 : -1;
    state.ball.dx = dir * 5 * Math.cos(angle);
    state.ball.dy = 5 * Math.sin(angle);
}

// ══════════════════════════════════════════════
// SCORING + GEMS
// ══════════════════════════════════════════════
function checkBossWin() {
    if (bossHits < BOSS_TARGET) return;
    state.running = false; state.over = true;
    resetBall();
    addGems(5000);
    showGemPopup('+5000 💎 Boss poražen!');
    document.getElementById('win-icon').textContent = '💀';
    winText.style.color = '#ff8c00';
    winText.textContent = 'BOSS PORAŽEN!';
    finalSc.textContent = `${bossHits} odbojev doseženih!`;
    overlay.classList.remove('hidden');
}

function onPlayerScores(side) {
    if (mode === 'boss') {
        if (side === 1) {  // boss je dosegel točko = igralec je zgrešil
            bossLives--;
            scoreR.textContent = '❤️'.repeat(bossLives);
            if (bossLives <= 0) {
                state.running = false; state.over = true;
                resetBall();
                document.getElementById('win-icon').textContent = '💀';
                winText.style.color = '#ff4444';
                winText.textContent = 'GAME OVER';
                finalSc.textContent = `Odboji: ${bossHits} / ${BOSS_TARGET}`;
                overlay.classList.remove('hidden');
            } else {
                state.running = false;
                resetBall();
                msgEl.textContent = '';
                showPlayBtn();
            }
        } else {
            // Igralec je dosegel točko proti bossu (redko) — ignoriraj, samo reset
            state.running = false;
            resetBall();
            showPlayBtn();
        }
        return;
    }

    state.score[side]++;
    (side === 0 ? scoreL : scoreR).textContent = state.score[side];

    // Gems samo za modrega (side 0) ali v AI načinu ko zmaga igralec
    const playerScored = (mode === '2p' && side === 0) || (mode === 'ai' && side === 0);

    if (playerScored) {
        addGems(10);
        showGemPopup('+10 💎');
        streak++;
        if (streak % 5 === 0) {
            addGems(45);
            showStreakPopup(streak);
        }
    } else {
        streak = 0;
    }

    checkWin(side);
}

function checkWin(side) {
    if (state.score[side] >= WIN_SCORE) {
        state.running = false; state.over = true;
        resetBall();

        // Gem bonus for winning
        addGems(100);
        showGemPopup('+100 💎 Zmaga!');

        recordWin(side);
        const color = side === 0 ? COLOR_LEFT : COLOR_RIGHT;
        let label, icon;
        if (mode === 'ai') {
            if (side === 0) { label = 'ZMAGAL SI!'; icon = '🏆'; }
            else             { label = 'ROBOT ZMAGA!'; icon = '🤖'; }
        } else {
            label = (side === 0 ? 'MODER' : 'RDEČ') + ' ZMAGA!';
            icon = '🏆';
        }
        document.getElementById('win-icon').textContent = icon;
        winText.style.color = color;
        winText.textContent = label;
        finalSc.textContent = state.score[0] + ' : ' + state.score[1];
        overlay.classList.remove('hidden');
        msgEl.textContent = '';
    } else {
        state.running = false;
        resetBall();
        msgEl.textContent = '';
        showPlayBtn();
    }
}

// ══════════════════════════════════════════════
// UPDATE
// ══════════════════════════════════════════════
function update() {
    if (state.over) return;

    const lPadH = padH(0);
    const rPadH = padH(1);

    if (!isFrozen(0)) {
        const spd = padSpeed(0);
        if (keys['KeyW']) state.left.y -= spd;
        if (keys['KeyS']) state.left.y += spd;
        state.left.y = Math.max(0, Math.min(H - lPadH, state.left.y));
    }

    if (mode === '2p') {
        if (redAutoPilot) {
            // Nepremagljiv auto-pilot: palica se teleportira na žogico
            state.right.y = state.ball.y - rPadH / 2;
            state.right.y = Math.max(0, Math.min(H - rPadH, state.right.y));
        } else if (!isFrozen(1)) {
            const spd = padSpeed(1);
            if (keys['ArrowUp'])   state.right.y -= spd;
            if (keys['ArrowDown']) state.right.y += spd;
            state.right.y = Math.max(0, Math.min(H - rPadH, state.right.y));
        }
    } else {
        refreshAiTarget();
        updateAI();
    }

    if (!state.running) return;

    const b = state.ball;
    const speedMult = isSlow() ? 0.5 : 1;

    state.trail.push({ x: b.x, y: b.y });
    if (state.trail.length > 10) state.trail.shift();

    b.x += b.dx * speedMult;
    b.y += b.dy * speedMult;

    if (b.y - BALL_SIZE / 2 <= 0) { b.y = BALL_SIZE / 2; b.dy = Math.abs(b.dy); }
    if (b.y + BALL_SIZE / 2 >= H) { b.y = H - BALL_SIZE / 2; b.dy = -Math.abs(b.dy); }

    const lx = 10 + PAD_W;
    if (b.dx < 0 && b.x - BALL_SIZE / 2 <= lx &&
        b.y >= state.left.y && b.y <= state.left.y + lPadH) {
        b.x = lx + BALL_SIZE / 2;
        bounce(b, state.left.y, lPadH, 1);
        if (mode === 'boss') {
            bossHits++;
            scoreL.textContent = bossHits;
            checkBossWin();
            if (state.over) return;
        }
        triggerRandomPowerup(0);
    }

    const rx = W - 10 - PAD_W;
    if (b.dx > 0 && b.x + BALL_SIZE / 2 >= rx &&
        b.y >= state.right.y && b.y <= state.right.y + rPadH) {
        b.x = rx - BALL_SIZE / 2;
        bounce(b, state.right.y, rPadH, -1);
        if (mode === 'boss') {
            bossHits++;
            scoreL.textContent = bossHits;
            checkBossWin();
            if (state.over) return;
        }
        triggerRandomPowerup(1);
    }

    if (b.x < 0) onPlayerScores(1);
    else if (b.x > W) onPlayerScores(0);
}

function bounce(b, padY, padH, dirX) {
    const hit = (b.y - (padY + padH / 2)) / (padH / 2);
    const spd = Math.min(Math.sqrt(b.dx * b.dx + b.dy * b.dy) + 0.3, 15);
    const ang = hit * 65 * Math.PI / 180;
    b.dx = dirX < 0 ? -Math.abs(spd * Math.cos(ang)) : Math.abs(spd * Math.cos(ang));
    b.dy = spd * Math.sin(ang);
}

// ══════════════════════════════════════════════
// DRAW
// ══════════════════════════════════════════════
function drawGlow(color, fn, blur = 18) {
    ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur; fn(); ctx.restore();
}

function draw() {
    ctx.fillStyle = '#08081a';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 60, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.setLineDash([8, 12]); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();

    if (state.running) {
        state.trail.forEach((pt, i) => {
            const alpha = (i / state.trail.length) * 0.3;
            const size  = BALL_SIZE * (i / state.trail.length);
            ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            ctx.fillRect(pt.x - size / 2, pt.y - size / 2, size, size);
        });
    }

    // Left paddle
    const lPadH   = padH(0);
    const rPadH   = padH(1);
    const skinColor  = getActiveSkinColor();
    const leftColor  = isActiveSelf('turbo', 0) ? '#88ffff' : skinColor;
    const bossGlow   = mode === 'boss' ? 22 + Math.sin(Date.now() / 280) * 8 : 18;
    const rightColor = mode === 'boss' ? '#ff8c00'
                     : redAutoPilot    ? '#ffdd00'
                     : isActiveSelf('turbo', 1) ? '#ff9999' : COLOR_RIGHT;

    drawGlow(leftColor, () => {
        ctx.fillStyle = leftColor;
        ctx.beginPath();
        ctx.roundRect(10, state.left.y, PAD_W, lPadH, 4);
        ctx.fill();
    });

    // Right paddle (boss = orange pulsing glow; ghost = partially invisible)
    const rightAlpha = isGhost(1) ? 0.15 : 1;
    ctx.save();
    ctx.globalAlpha = rightAlpha;
    drawGlow(rightColor, () => {
        ctx.fillStyle = rightColor;
        ctx.beginPath();
        ctx.roundRect(W - 10 - PAD_W, state.right.y, PAD_W, rPadH, 4);
        ctx.fill();
    }, bossGlow);
    ctx.restore();

    // Boss progress bar
    if (mode === 'boss') {
        const prog = Math.min(bossHits / BOSS_TARGET, 1);
        const bx = 20, by = 10, bw = W - 40, bh = 5;
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3); ctx.fill();
        if (prog > 0) {
            const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
            grad.addColorStop(0, '#ff5500');
            grad.addColorStop(1, '#ffdd00');
            ctx.fillStyle = grad;
            ctx.shadowColor = '#ff8c00'; ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.roundRect(bx, by, bw * prog, bh, 3); ctx.fill();
        }
        ctx.restore();
    }

    // Frozen indicator
    if (isFrozen(0)) { ctx.save(); ctx.fillStyle='rgba(100,200,255,0.18)'; ctx.fillRect(0,0,W/2,H); ctx.restore(); }
    if (isFrozen(1)) { ctx.save(); ctx.fillStyle='rgba(100,200,255,0.18)'; ctx.fillRect(W/2,0,W/2,H); ctx.restore(); }

    // Ball
    if (!state.over) {
        const ballColor = isSlow() ? '#88aaff' : '#fff';
        drawGlow(ballColor, () => {
            ctx.fillStyle = ballColor;
            const b = state.ball;
            ctx.beginPath();
            ctx.roundRect(b.x - BALL_SIZE / 2, b.y - BALL_SIZE / 2, BALL_SIZE, BALL_SIZE, 3);
            ctx.fill();
        });
    }
}

// ══════════════════════════════════════════════
// LEADERBOARD
// ══════════════════════════════════════════════
function loadLb() {
    const raw = localStorage.getItem('pong_lb');
    return raw ? JSON.parse(raw) : {
        '2p': { blue: { w: 0, l: 0 }, red: { w: 0, l: 0 } },
        'easy': { w: 0, l: 0 }, 'medium': { w: 0, l: 0 }, 'hard': { w: 0, l: 0 },
    };
}
function saveLb(lb) { localStorage.setItem('pong_lb', JSON.stringify(lb)); }
function recordWin(side) {
    if (mode === 'boss') return;
    const lb = loadLb();
    if (mode === '2p') {
        if (side === 0) { lb['2p'].blue.w++; lb['2p'].red.l++; }
        else             { lb['2p'].red.w++;  lb['2p'].blue.l++; }
    } else {
        if (side === 0) lb[diff].w++;
        else             lb[diff].l++;
    }
    saveLb(lb);
}
function pct(w, l) { const t = w + l; return t === 0 ? '—' : Math.round(w / t * 100) + '%'; }
function renderLb() {
    const lb = loadLb();
    const s = lb['2p'];
    document.getElementById('lb-2p-blue-w').textContent   = s.blue.w;
    document.getElementById('lb-2p-blue-l').textContent   = s.blue.l;
    document.getElementById('lb-2p-blue-pct').textContent = pct(s.blue.w, s.blue.l);
    document.getElementById('lb-2p-red-w').textContent    = s.red.w;
    document.getElementById('lb-2p-red-l').textContent    = s.red.l;
    document.getElementById('lb-2p-red-pct').textContent  = pct(s.red.w, s.red.l);
    ['easy','medium','hard'].forEach(d => {
        const id = d === 'medium' ? 'med' : d;
        document.getElementById(`lb-ai-${id}-w`).textContent   = lb[d].w;
        document.getElementById(`lb-ai-${id}-l`).textContent   = lb[d].l;
        document.getElementById(`lb-ai-${id}-pct`).textContent = pct(lb[d].w, lb[d].l);
    });
}

// ══════════════════════════════════════════════
// MAIN LOOP
// ══════════════════════════════════════════════
function loop() { update(); draw(); requestAnimationFrame(loop); }

hidePlayBtn();
updateGemUI();
loop();

// ══════════════════════════════════════════════
// BACKGROUND ANIMATION
// ══════════════════════════════════════════════
const bgCanvas = document.getElementById('bg-canvas');
const bgCtx    = bgCanvas.getContext('2d');
function resizeBg() { bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight; }
resizeBg();
window.addEventListener('resize', resizeBg);

const BG_DURATION = 2200;
const BG_INTERVAL = 1500;
const BG_PAD      = 60;

const BG_POSITIONS = [
    c => ({ x: BG_PAD,       y: c.cy,       color: '#44aaff' }),
    c => ({ x: c.w - BG_PAD, y: c.cy,       color: '#ff4444' }),
    c => ({ x: c.cx,         y: BG_PAD,     color: '#44aaff' }),
    c => ({ x: c.cx,         y: c.h-BG_PAD, color: '#ff4444' }),
    c => ({ x: BG_PAD,       y: BG_PAD,     color: '#44aaff' }),
    c => ({ x: c.w-BG_PAD,   y: BG_PAD,     color: '#ff4444' }),
    c => ({ x: BG_PAD,       y: c.h-BG_PAD, color: '#44aaff' }),
    c => ({ x: c.w-BG_PAD,   y: c.h-BG_PAD, color: '#ff4444' }),
];

const bgWaves = [];
let lastWaveTime = -BG_INTERVAL;

function spawnWave(ts) {
    const c = { w: bgCanvas.width, h: bgCanvas.height, cx: bgCanvas.width/2, cy: bgCanvas.height/2 };
    bgWaves.push({ startedAt: ts, balls: BG_POSITIONS.map(fn => fn(c)) });
}

function easeInOut(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2; }

function drawBg(ts) {
    if (ts - lastWaveTime >= BG_INTERVAL) { spawnWave(ts); lastWaveTime = ts; }
    for (let i = bgWaves.length - 1; i >= 0; i--)
        if (ts - bgWaves[i].startedAt > BG_DURATION + 400) bgWaves.splice(i, 1);

    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    const cx = bgCanvas.width/2, cy = bgCanvas.height/2;

    bgWaves.forEach(wave => {
        const t = Math.min((ts - wave.startedAt) / BG_DURATION, 1);
        const ease = easeInOut(t);
        let alpha = t < 0.08 ? t/0.08 : t < 0.7 ? 1 : 1-(t-0.7)/0.3;
        alpha *= 0.5;

        wave.balls.forEach(ball => {
            const bx = ball.x + (cx - ball.x) * ease;
            const by = ball.y + (cy - ball.y) * ease;
            const r  = 8 + ease * 4;

            bgCtx.save();
            bgCtx.globalAlpha = alpha;
            const grad = bgCtx.createRadialGradient(bx, by, 0, bx, by, r*3.5);
            grad.addColorStop(0,   ball.color + 'bb');
            grad.addColorStop(0.4, ball.color + '44');
            grad.addColorStop(1,   ball.color + '00');
            bgCtx.fillStyle = grad;
            bgCtx.beginPath(); bgCtx.arc(bx, by, r*3.5, 0, Math.PI*2); bgCtx.fill();
            bgCtx.fillStyle = ball.color;
            bgCtx.shadowColor = ball.color; bgCtx.shadowBlur = 18;
            bgCtx.beginPath(); bgCtx.arc(bx, by, r, 0, Math.PI*2); bgCtx.fill();
            bgCtx.restore();
        });
    });
    requestAnimationFrame(drawBg);
}
requestAnimationFrame(drawBg);
