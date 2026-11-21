import { $, on, toast } from './util.js';
import { processRecurring } from './recurring.js';
import { lockNow, autoLock } from './lock.js';
import { openDB } from './db.js';
import { ensureDefaults, loadRefs, loadUsage } from './state.js';
import { openAdd } from './views/add.js';
import { bindTxList } from './views/common.js';
import { renderHome } from './views/home.js';
import { renderList } from './views/list.js';
import { renderStatement } from './views/statement.js';
import { renderMore } from './views/more.js';

const views = { home: renderHome, list: renderList, statement: renderStatement, more: renderMore };
let lastHash = null, routing = Promise.resolve();

function route() {
  routing = routing.then(async () => {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const tab = views[parts[0]] ? parts[0] : 'home';
    document.querySelectorAll('#tabbar [data-tab]').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
    const m = $('#modal'); m.hidden = true; m.innerHTML = '';
    const main = $('#view');
    const keep = location.hash === lastHash ? main.scrollTop : 0;
    main.onclick = null; main.ontouchstart = null; main.ontouchend = null;
    await views[tab](main, parts.slice(1));
    main.scrollTop = keep;
    lastHash = location.hash;
  }).catch((e) => { console.error(e); $('#view').innerHTML = `<div class="empty">Something went wrong:<br>${e.message}</div>`; });
}

async function init() {
  await openDB();
  await ensureDefaults();
  await loadRefs();
  const locking = lockNow(); // shows the PIN screen first if a PIN is set
  const added = await processRecurring();
  await loadUsage();
  bindTxList($('#view'));
  $('#fab').onclick = () => openAdd();
  window.addEventListener('hashchange', route);
  on('changed', route);
  on('refs', () => {});
  route();
  await locking;
  if (added) toast(`Added ${added} recurring entr${added === 1 ? 'y' : 'ies'}`);
  autoLock();
  // the app may stay open in the background for days: catch up recurring items on return
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) return;
    const n = await processRecurring();
    if (n) { await loadUsage(); route(); toast(`Added ${n} recurring entr${n === 1 ? 'y' : 'ies'}`); }
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
init();
