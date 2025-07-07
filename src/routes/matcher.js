// matcher.js
const fs = require('fs');
const csv = require('csv-parser');
const Fuse = require('fuse.js');


function extractStoreNumber(text) {
  if (!text) return null;
  const m = text.match(/(\d{2,5})/);
  return m ? String(Number(m[1])) : null; // Remove leading zeros
}

/**
 * matchSignJetToWave
 * @param {string} signjetCsvPath - Path to uploaded SignJet CSV
 * @param {Array} waveDevices - Array of Wave devices from API:
 *   [{ id, alias, siteName, online (boolean) }, ...]
 * @param {Object} [opts] - Optional config:
 *   { scoreThreshold: number (default = 80) }
 * @returns {Promise<Array>} matched array
 */
async function matchSignJetToWave(signjetCsvPath, waveDevices, opts = {}) {
  const scoreThreshold = opts.scoreThreshold || 80;
  const waveByStore = {};

  // Prepare waveDevices map: storeNumber → list of {id, aliasNorm}
  waveDevices
    .filter(w => w.presence && w.presence.connected)
    .forEach(w => {
      const sn = extractStoreNumber(w.site && w.site.name);
    //   console.log('Wave device site.name:', w.site && w.site.name, '-> store:', sn);
      if (!sn) return;
      if (!waveByStore[sn]) waveByStore[sn] = [];
      waveByStore[sn].push({
        id: w.id,
        aliasNorm: w.alias ? w.alias.toLowerCase().trim() : '',
        alias: w.alias,
        siteName: w.site ? w.site.name : '',
        model: w.model || w.deviceModel || w.hardwareModel || '', // Try common model field names
      });
    });

//   console.log('waveByStore keys:', Object.keys(waveByStore));

  // Read SignJet CSV
  const records = [];
  await new Promise((res, rej) => {
    fs.createReadStream(signjetCsvPath)
      .pipe(csv())
      .on('data', row => {
        const loc = row['Location'];
        const dev = row['Device Name'];
        const model = row['Model'] || row['Device Model'] || ''; // Try common model field names
        const status = (row['Status'] || '').toLowerCase().trim();
        const sn = extractStoreNumber(loc);
        if (status === 'offline') {
        //   console.log('SignJet Location:', loc, '-> store:', sn);
          if (sn && dev) {
            records.push({ 
              store: sn, 
              signjetName: dev.trim(), 
              signjetNorm: dev.toLowerCase().trim(),
              signjetModel: model.trim()
            });
          }
        }
      })
      .on('end', () => res())
      .on('error', rej);
  });

  // Perform fuzzy matching
  const matches = [];
  for (const rec of records) {
    const wlist = waveByStore[rec.store];
    if (!wlist) {
      // No Wave devices for this store
      continue;
    }
    const fuse = new Fuse(wlist, {
      keys: ['aliasNorm'],
      threshold: 0.3,
      ignoreLocation: true,
      isCaseSensitive: false,
      includeScore: true,
    });
    const result = fuse.search(rec.signjetNorm);
    if (result.length > 0) {
      const best = result[0];
      const percentScore = Math.round((1 - best.score) * 100);
      // Special handling for Register N
      const regNum = rec.signjetName.match(/^Register\s*(\d+)$/i);
      const waveRegNum = best.item.alias && best.item.alias.match(/^Register\s*(\d+)$/i);
      if (regNum && waveRegNum) {
        if (regNum[1] !== waveRegNum[1]) {
          // Numbers do not match, skip this match
          continue;
        }
      }
      if (percentScore >= scoreThreshold) {
        matches.push({
          store: rec.store,
          signjetName: rec.signjetName,
          signjetModel: rec.signjetModel,
          waveName: best.item.alias,
          waveID: best.item.id,
          waveSite: best.item.siteName,
          waveModel: best.item.model,
          score: percentScore,
        });
      }
    } else {
      // Optionally keep this log for unmatched devices:
      // console.log(`NO MATCH: "${rec.signjetName}" (store ${rec.store})`);
    }
  }

  return matches;
}


module.exports = { matchSignJetToWave };
