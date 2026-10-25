
const fs=require('fs'), vm=require('vm');
const code=fs.readFileSync('pages/school/index.js','utf8');
let page={};
const stub={
 'appearance':{themeClass:()=>'theme-light'},
 'i18n':{pick:(s)=>s},
 'data':{schoolStatus:async()=>({linked:false,studentNo:null,cryptoReady:true}),messageOf:(e)=>String(e&&e.message||e),schoolGrades:async()=>({items:[]}),schoolAttendance:async()=>({items:[],summary:{total:0,late:0,absent:0}})},
 'request':{getToken:()=>'tok'},
 'reporter':{reportError:()=>Promise.resolve(true)}
};
const sandbox={Page:(o)=>{page=o;},wx:{getStorageSync:()=>'',setStorageSync:()=>{},showToast:()=>{},showModal:()=>{},navigateTo:()=>{}},
 require:(p)=>{for(const k of Object.keys(stub)) if(p.includes(k)) return stub[k]; return {};},console};
vm.runInNewContext(code, sandbox);
const pg=Object.assign({},page);
pg.data=JSON.parse(JSON.stringify(page.data));
pg.setData=function(o,cb){Object.assign(this.data,o); if(cb)cb.call(this);};
(async()=>{
  pg.onLoad.call(pg);
  await new Promise(r=>setTimeout(r,50));
  console.log('loading:',pg.data.loading,'| failed:',pg.data.failed,'| needLogin:',pg.data.needLogin,'| errorText:',pg.data.errorText);
  console.log('L 有 title:', !!(pg.data.L&&pg.data.L.title), '| failTitle:', pg.data.L&&pg.data.L.failTitle);
})().catch(e=>{console.error('❌ 執行錯誤:',e.message)});
