const moment = require('moment-timezone');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Parse owner and repository from user input
 */
function parseGitHubUrl(input) {
    if (!input) return null;
    const cleaned = input.trim().replace(/\.git$/i, '').replace(/\/+$/, '');
    const match = cleaned.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/i)
        || cleaned.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
    if (!match) return null;
    return { owner: match[1], repo: match[2] };
}

/**
 * Format bytes to readable string
 */
function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Download repo zip archive
 */
async function downloadRepoZip(owner, repo) {
    const candidateUrls = [
        `https://github.com/${owner}/${repo}/archive/HEAD.zip`,
        `https://github.com/${owner}/${repo}/archive/refs/heads/main.zip`,
        `https://github.com/${owner}/${repo}/archive/refs/heads/master.zip`
    ];

    for (const url of candidateUrls) {
        try {
            const res = await axios.get(url, {
                responseType: 'arraybuffer',
                maxRedirects: 10,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 60000
            });
            if (res.status === 200 && res.data && res.data.length > 100) {
                return Buffer.from(res.data);
            }
        } catch (_) {}
    }

    // Fallback: local git clone --depth 1 and zip
    const tmpDir = path.join(process.cwd(), 'temp', `clone_${Date.now()}`);
    try {
        fs.mkdirSync(tmpDir, { recursive: true });
        const repoCloneUrl = `https://github.com/${owner}/${repo}.git`;
        execSync(`git clone --depth 1 ${repoCloneUrl} "${tmpDir}"`, {
            timeout: 60000,
            stdio: 'pipe'
        });

        // Remove .git directory to keep zip clean
        const dotGit = path.join(tmpDir, '.git');
        if (fs.existsSync(dotGit)) {
            fs.rmSync(dotGit, { recursive: true, force: true });
        }

        const outZip = path.join(process.cwd(), 'temp', `${repo}_${Date.now()}.zip`);
        execSync(`cd "${tmpDir}" && zip -r "${outZip}" .`, { timeout: 30000, stdio: 'pipe' });

        if (fs.existsSync(outZip)) {
            const buf = fs.readFileSync(outZip);
            try { fs.unlinkSync(outZip); } catch (_) {}
            try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
            return buf;
        }
    } catch (cloneErr) {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }

    return null;
}

async function githubCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = rawText.trim().split(/\s+/).slice(1).join(' ').trim();

        // If no repo URL was supplied, show default bot repository card
        if (!args) {
            let json = null;
            try {
                const res = await axios.get('https://api.github.com/repos/mruniquehacker/Knightbot-md', {
                    headers: { 'User-Agent': 'WhatsApp-Bot' },
                    timeout: 5000
                });
                json = res.data;
            } catch (_) {}

            let txt = `*乂  Knight Bot MD Repository  乂*\n\n`;
            if (json) {
                txt += `✩  *Name* : ${json.name || 'Knightbot-md'}\n`;
                txt += `✩  *Watchers* : ${json.watchers_count || 0}\n`;
                txt += `✩  *Size* : ${json.size ? (json.size / 1024).toFixed(2) + ' MB' : 'N/A'}\n`;
                txt += `✩  *Last Updated* : ${json.updated_at ? moment(json.updated_at).format('DD/MM/YY - HH:mm:ss') : 'Recently'}\n`;
                txt += `✩  *URL* : ${json.html_url || 'https://github.com/mruniquehacker/Knightbot-md'}\n`;
                txt += `✩  *Forks* : ${json.forks_count || 0}\n`;
                txt += `✩  *Stars* : ${json.stargazers_count || 0}\n\n`;
            } else {
                txt += `✩  *Official Repo* : https://github.com/mruniquehacker/Knightbot-md\n\n`;
            }

            txt += `💡 *Clone Any Repo Feature:*\n`;
            txt += `You can download any GitHub repo as a ZIP file!\n`;
            txt += `*Usage:* \`.git <github url>\`\n`;
            txt += `*Example:* \`.git https://github.com/whiskeysockets/baileys\``;

            const imgPath = path.join(__dirname, '../assets/bot_image.jpg');
            if (fs.existsSync(imgPath)) {
                const imgBuffer = fs.readFileSync(imgPath);
                await sock.sendMessage(chatId, { image: imgBuffer, caption: txt }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { text: txt }, { quoted: message });
            }
            return;
        }

        // User provided a repo URL to clone
        const parsed = parseGitHubUrl(args);
        if (!parsed) {
            return await sock.sendMessage(chatId, {
                text: `❌ *Invalid GitHub URL!*\n\n*Usage:* \`.git <github url>\`\n*Example:* \`.git https://github.com/whiskeysockets/baileys\``
            }, { quoted: message });
        }

        const { owner, repo } = parsed;

        // Notify user that download started
        await sock.sendMessage(chatId, {
            text: `📦 *Cloning Repository:* \`${owner}/${repo}\`\n⏳ Please wait, packaging ZIP archive...`
        }, { quoted: message });

        const zipBuffer = await downloadRepoZip(owner, repo);
        if (!zipBuffer || zipBuffer.length === 0) {
            return await sock.sendMessage(chatId, {
                text: `❌ *Failed to clone repository!*\nMake sure the repository is public and the URL is correct:\nhttps://github.com/${owner}/${repo}`
            }, { quoted: message });
        }

        const fileSizeStr = formatBytes(zipBuffer.length);
        const fileName = `${repo}-main.zip`;

        // Send ZIP as document
        await sock.sendMessage(chatId, {
            document: zipBuffer,
            mimetype: 'application/zip',
            fileName: fileName,
            caption: `✅ *Repository Cloned Successfully!*\n\n📁 *Repo:* ${owner}/${repo}\n📦 *File:* ${fileName}\n⚖️ *Size:* ${fileSizeStr}\n🔗 *Source:* https://github.com/${owner}/${repo}`
        }, { quoted: message });

    } catch (error) {
        console.error('Error in git/clone command:', error);
        await sock.sendMessage(chatId, {
            text: `❌ *Error cloning repository:* ${error?.message || 'Operation failed.'}`
        }, { quoted: message });
    }
}

module.exports = githubCommand;