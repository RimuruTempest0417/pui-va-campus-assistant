
const lines=[];
const fs=require('fs'), vm=require('vm');
const code=fs.readFileSync('pages/help/index.js','utf8');
let page={};
const sandbox={Page:(o)=>{page=o;}, wx:{getStorageSync:()=>global.__role?{role:global.__role}:{}, setStorageSync:()=>{}},
  require:(p)=>p.includes('appearance')?{themeClass:()=>'theme-light'}:p.includes('i18n')?{pick:(s)=>s}:p.includes('role')?{label:(r)=>r}:{STORAGE_KEYS:{user:'pv_user'}},
  console, module:{exports:{}}, exports:{}};
vm.runInNewContext(code, sandbox);
for (const role of ['GUEST','STUDENT','PARENT','TEACHER','STAFF','ADMIN','SUPER_ADMIN']) {
  global.__role = role==='GUEST'?null:role;
  const pg=Object.assign({}, page);
  pg.data=JSON.parse(JSON.stringify(page.data));
  pg.setData=function(o,cb){Object.assign(this.data,o); if(cb)cb.call(this);};
  pg.onShow.call(pg);
  const tabs=pg.data.tabs.map(t=>t.key).join(',');
  lines.push(role.padEnd(12), '分頁:', tabs, '| 當前:', pg.data.active, '| Q&A:', (pg.data.list||[]).length);
}

const bad = lines.filter((l) => /Q&A: 0/.test(l));
if (bad.length) { console.error('❌ 有身分的使用說明是空的：\n' + bad.join('\n')); process.exit(1); }
lines.forEach((l) => console.log(l));
console.log('✅ 使用說明守門通過（每個身分都有分頁與內容）');
