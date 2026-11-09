const fs = require('fs');
const path = require('path');

const STATUS_FILE = path.join(__dirname, '../data/botStatus.json');

// Memory cache for maximum performance
let cachedActive = null;

function isBotActive() {
    if (cachedActive !== null) {
        return cachedActive;
    }
    try {
        if (fs.existsSync(STATUS_FILE)) {
            const data = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
            if (typeof data.active === 'boolean') {
                cachedActive = data.active;
                return cachedActive;
            }
        }
    } catch (_) {}
    cachedActive = true; // Default to ON
    return cachedActive;
}

function setBotActive(active) {
    cachedActive = Boolean(active);
    try {
        const payload = {
            active: cachedActive,
            updatedAt: new Date().toISOString()
        };
        fs.writeFileSync(STATUS_FILE, JSON.stringify(payload, null, 2));
    } catch (e) {
        console.error('[botState] Error writing botStatus.json:', e);
    }
    return cachedActive;
}

module.exports = {
    isBotActive,
    setBotActive
};
