const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function generateCodeZipBuffer() {
  const zip = new JSZip();
  const rootDir = process.cwd();
  const excludeFolders = new Set(['node_modules', '.git', 'sessions', 'temp', 'tmp', '.cache']);
  const excludeFiles = new Set(['baileys_store.json', 'yarn.lock']);

  function addDir(currentDir, relativePath = '') {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (excludeFolders.has(entry.name)) continue;
        const subDir = path.join(currentDir, entry.name);
        const subRel = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        addDir(subDir, subRel);
      } else if (entry.isFile()) {
        if (excludeFiles.has(entry.name)) continue;
        const filePath = path.join(currentDir, entry.name);
        const fileRel = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        try {
          const content = fs.readFileSync(filePath);
          zip.file(fileRel, content);
        } catch (e) {
          // ignore unreadable files
        }
      }
    }
  }

  addDir(rootDir, '');
  return await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}

module.exports = { generateCodeZipBuffer };
