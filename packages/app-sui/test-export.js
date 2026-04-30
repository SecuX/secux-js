const mod = require('./dist/index.js');
console.log('Export keys:', Object.keys(mod));
console.log('SecuxSUI:', mod.SecuxSUI ? 'FOUND' : 'NOT FOUND');
if (mod.SecuxSUI) {
  console.log('SecuxSUI type:', typeof mod.SecuxSUI);
  console.log('SecuxSUI methods:', Object.getOwnPropertyNames(mod.SecuxSUI).filter(m => typeof mod.SecuxSUI[m] === 'function').slice(0, 5));
}
