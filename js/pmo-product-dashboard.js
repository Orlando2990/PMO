(function(){
const S={systems:[],products:[],followups:[],charts:{}};
const q=id=>document.getElementById(id), client=()=>window.PMOAuth?.client;
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const closed=f=>!!f.cat_portafolio_estatus?.es_cierre;
const today=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
function fmt(v){if(!v)return 'Sin fecha';return new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(v+'T00:00:00Z'))}
function productOf(f){return S.products.find(p=>String(p.id)===String(f.producto_id))}
function health(p){
 const fs=S.followups.filter(f=>String(f.producto_id)===String(p.id)&&!closed(f)),now=today();
 if(!fs.length)return 'Saludable';
 if(fs.some(f=>Number(f.cat_portafolio_prioridades?.nivel||0)>=3&&f.fecha_compromiso&&new Date(f.fecha_compromiso+'T00:00:00')<now))return 'Crítico';
 if(fs.some(f=>Number(f.cat_portafolio_prioridades?.nivel||0)>=3||(f.fecha_compromiso&&((new Date(f.fecha_compromiso+'T00:00:00')-now)/86400000)<=7)))return 'Atención';
 return 'Saludable';
}
function filteredProducts(){
 const sid=q('dp-system').value,pid=q('dp-product').value;
 return S.products.filter(p=>(!sid||String(p.sistema_id)===sid)&&(!pid||String(p.id)===pid));
}
function filteredFollowups(){
 const ids=new Set(filteredProducts().map(p=>String(p.id)));
 return S.followups.filter(f=>ids.has(String(f.producto_id)));
}
async function load(){
 const c=client(); if(!c)return;
 const [sy,pr,fo]=await Promise.all([
  c.from('cat_sistemas').select('id,nombre').order('nombre'),
  c.from('cat_portafolio_productos').select('id,sistema_id,nombre,responsable,activo,cat_sistemas(nombre)').eq('activo',true).order('orden',{ascending:true,nullsFirst:false}),
  c.from('pmo_portafolio_seguimientos').select('id,producto_id,titulo,descripcion,responsable,fecha_compromiso,created_at,cerrado_at,rqm_project_id,cat_portafolio_tipos(nombre),cat_portafolio_estatus(nombre,es_cierre),cat_portafolio_prioridades(nombre,nivel),pmo_projects(id_req,nombre_rqm)').order('created_at',{ascending:false})
 ]);
 const er=[sy,pr,fo].find(x=>x.error)?.error;if(er){q('dp-error').classList.remove('hidden');q('dp-error').textContent=er.message;return}
 S.systems=sy.data||[];S.products=pr.data||[];S.followups=fo.data||[];
 fillFilters();render();
}
function fillFilters(){
 q('dp-system').innerHTML='<option value="">Todos los sistemas</option>'+S.systems.map(x=>`<option value="${x.id}">${esc(x.nombre)}</option>`).join('');
 refreshProducts();
 q('dp-system').addEventListener('change',()=>{refreshProducts();render()});
 q('dp-product').addEventListener('change',render);
}
function refreshProducts(){
 const sid=q('dp-system').value,old=q('dp-product').value;
 const ps=S.products.filter(p=>!sid||String(p.sistema_id)===sid);
 q('dp-product').innerHTML='<option value="">Todos los productos</option>'+ps.map(p=>`<option value="${p.id}">${esc(p.nombre)}</option>`).join('');
 q('dp-product').value=ps.some(p=>String(p.id)===old)?old:'';
}
function kpiCard(label,value,detail,icon,klass,action){
 return `<button ${action?`onclick="${action}"`:''} class="dp-card dp-kpi p-5 text-left ${action?'':'cursor-default'}"><div class="flex justify-between gap-3"><div><p class="text-[10px] uppercase tracking-wide font-black text-slate-400">${label}</p><p class="text-3xl font-black text-slate-950 mt-2">${value}</p><p class="text-[11px] text-slate-500 mt-1">${detail}</p></div><span class="${klass} w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"><i data-lucide="${icon}" class="w-5 h-5"></i></span></div></button>`;
}
function renderKPIs(){
 const ps=filteredProducts(),fs=filteredFollowups(),open=fs.filter(f=>!closed(f)),resolved=fs.filter(closed),now=today();
 const overdue=open.filter(f=>f.fecha_compromiso&&new Date(f.fecha_compromiso+'T00:00:00')<now);
 const critical=open.filter(f=>Number(f.cat_portafolio_prioridades?.nivel||0)>=3);
 q('dp-kpis').innerHTML=[
  kpiCard('Productos',ps.length,'En la vista actual','boxes','bg-blue-50 text-blue-600',"PMOProductDashboard.detail('products')"),
  kpiCard('Seguimientos',fs.length,'Total registrados','list-checks','bg-slate-100 text-slate-700',"PMOProductDashboard.detail('all')"),
  kpiCard('Abiertos',open.length,'Requieren seguimiento','circle-dot','bg-amber-50 text-amber-700',"PMOProductDashboard.detail('open')"),
  kpiCard('Resueltos',resolved.length,'Con estatus de cierre','circle-check-big','bg-emerald-50 text-emerald-700',"PMOProductDashboard.detail('resolved')"),
  kpiCard('Críticos',critical.length,'Prioridad alta abierta','triangle-alert','bg-rose-50 text-rose-700',"PMOProductDashboard.detail('critical')"),
  kpiCard('Vencidos',overdue.length,'Compromiso incumplido','calendar-clock','bg-orange-50 text-orange-700',"PMOProductDashboard.detail('overdue')")
 ].join('');
}
function group(fs,get){const m={};fs.forEach(f=>{const k=get(f)||'Sin definir';m[k]=(m[k]||0)+1});return m}
function chart(id,type,labels,data,colors,onClick,indexAxis){
 if(S.charts[id])S.charts[id].destroy();
 const ctx=q(id); if(!ctx)return;
 S.charts[id]=new Chart(ctx,{type,data:{labels,datasets:[{data,backgroundColor:colors,borderWidth:type==='doughnut'?3:1,borderColor:type==='doughnut'?'#fff':colors,borderRadius:type==='bar'?8:0,maxBarThickness:42}]},
 options:{responsive:true,maintainAspectRatio:false,indexAxis:indexAxis||'x',plugins:{legend:{display:type==='doughnut',position:'right',labels:{usePointStyle:true,boxWidth:8,font:{size:11,weight:'600'}}}},scales:type==='bar'?{x:{grid:{display:indexAxis==='y'?true:false},ticks:{font:{size:10,weight:'600'}}},y:{beginAtZero:true,grid:{color:'#eef2f7'},ticks:{precision:0,font:{size:10}}}}:undefined,onClick(e,els){if(!els?.length)return;onClick?.(labels[els[0].index])},onHover(e,els){e.native.target.style.cursor=els?.length?'pointer':'default'}}});
}
function renderCharts(){
 const fs=filteredFollowups(),ps=filteredProducts();
 const byStatus=group(fs,f=>f.cat_portafolio_estatus?.nombre),sl=Object.keys(byStatus);
 chart('dp-status-chart','doughnut',sl,sl.map(x=>byStatus[x]),['#3656a3','#3b82f6','#f59e0b','#10b981','#8b5cf6','#f97316','#ef4444'],label=>detailBy('status',label));
 const prodCounts=ps.map(p=>({p,n:fs.filter(f=>String(f.producto_id)===String(p.id)).length})).sort((a,b)=>b.n-a.n).slice(0,10);
 chart('dp-product-chart','bar',prodCounts.map(x=>x.p.nombre),prodCounts.map(x=>x.n),'#4f7df3',label=>detailBy('product',label),'y');
 const byType=group(fs,f=>f.cat_portafolio_tipos?.nombre),tl=Object.keys(byType);
 chart('dp-type-chart','bar',tl,tl.map(x=>byType[x]),'#22a6b3',label=>detailBy('type',label));
 const hg={Saludable:0,Atención:0,Crítico:0};ps.forEach(p=>hg[health(p)]++);
 chart('dp-health-chart','doughnut',Object.keys(hg),Object.values(hg),['#10b981','#f59e0b','#ef4444'],label=>detailBy('health',label));
}
function renderAttention(){
 const now=today(),rows=filteredFollowups().filter(f=>!closed(f)&&f.fecha_compromiso).map(f=>({...f,days:Math.ceil((new Date(f.fecha_compromiso+'T00:00:00')-now)/86400000)})).filter(f=>f.days<=7).sort((a,b)=>a.days-b.days).slice(0,8);
 q('dp-attention').innerHTML=rows.length?rows.map(f=>{const p=productOf(f),bad=f.days<0;return `<button onclick="PMOProductDashboard.showRows([${JSON.stringify(String(f.id))}],'Seguimiento')" class="w-full text-left p-5 hover:bg-slate-50 flex items-center justify-between gap-4"><div><p class="text-sm font-black text-slate-800">${esc(f.titulo)}</p><p class="text-[11px] text-slate-500 mt-1">${esc(p?.cat_sistemas?.nombre||'')} · ${esc(p?.nombre||'')} · ${fmt(f.fecha_compromiso)}</p></div><span class="shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black ${bad?'bg-rose-50 text-rose-700':'bg-amber-50 text-amber-700'}">${bad?`${Math.abs(f.days)} d vencido${Math.abs(f.days)===1?'':'s'}`:`${f.days} d`}</span></button>`}).join(''):'<div class="p-8 text-center text-sm text-slate-400">Sin compromisos vencidos o próximos a vencer.</div>';
}
function renderOwners(){
 const open=filteredFollowups().filter(f=>!closed(f)),m=group(open,f=>f.responsable||'Sin responsable'),arr=Object.entries(m).sort((a,b)=>b[1]-a[1]);
 const max=Math.max(1,...arr.map(x=>x[1]));
 q('dp-owners').innerHTML=arr.length?arr.slice(0,10).map(([name,n])=>`<button onclick="PMOProductDashboard.detailBy('owner',${JSON.stringify(name)})" class="w-full text-left"><div class="flex justify-between text-xs font-bold"><span>${esc(name)}</span><span>${n}</span></div><div class="h-2 bg-slate-100 rounded-full mt-2 overflow-hidden"><div class="h-full bg-blue-500 rounded-full" style="width:${Math.max(5,n/max*100)}%"></div></div></button>`).join(''):'<p class="text-sm text-slate-400">Sin seguimientos abiertos.</p>';
}
function render(){renderKPIs();renderCharts();renderAttention();renderOwners();lucide.createIcons()}
function rowsHtml(rows){
 return `<div class="overflow-x-auto rounded-2xl border border-slate-200"><table class="w-full text-sm"><thead class="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th class="text-left px-4 py-3">Seguimiento</th><th class="text-left px-4 py-3">Sistema / Producto</th><th class="text-left px-4 py-3">Tipo</th><th class="text-left px-4 py-3">Prioridad</th><th class="text-left px-4 py-3">Responsable</th><th class="text-left px-4 py-3">Compromiso</th><th class="text-left px-4 py-3">Estatus</th></tr></thead><tbody>${rows.map(f=>{const p=productOf(f);return `<tr class="border-b border-slate-100 last:border-0"><td class="px-4 py-3"><b class="text-slate-900">${esc(f.titulo)}</b>${f.pmo_projects?.id_req?`<div class="text-[10px] text-blue-600 font-bold mt-1">🔗 ${esc(f.pmo_projects.id_req)}</div>`:''}</td><td class="px-4 py-3 text-slate-600">${esc(p?.cat_sistemas?.nombre||'')}<br><b>${esc(p?.nombre||'')}</b></td><td class="px-4 py-3">${esc(f.cat_portafolio_tipos?.nombre||'—')}</td><td class="px-4 py-3">${esc(f.cat_portafolio_prioridades?.nombre||'—')}</td><td class="px-4 py-3">${esc(f.responsable||'—')}</td><td class="px-4 py-3 whitespace-nowrap">${fmt(f.fecha_compromiso)}</td><td class="px-4 py-3"><span class="px-2.5 py-1 rounded-full bg-slate-100 text-xs font-black">${esc(f.cat_portafolio_estatus?.nombre||'—')}</span></td></tr>`}).join('')}</tbody></table></div>`;
}
function openDetail(title,subtitle,rows){
 q('dp-modal-title').textContent=title;q('dp-modal-subtitle').textContent=subtitle;q('dp-modal-body').innerHTML=rows.length?rowsHtml(rows):'<div class="p-8 text-center text-slate-400">Sin registros.</div>';q('dp-modal').classList.remove('hidden');lucide.createIcons();
}
function detail(kind){
 const fs=filteredFollowups(),now=today();let rows=fs,title='';
 if(kind==='all'){title='Todos los seguimientos'}
 if(kind==='open'){title='Seguimientos abiertos';rows=fs.filter(f=>!closed(f))}
 if(kind==='resolved'){title='Seguimientos resueltos';rows=fs.filter(closed)}
 if(kind==='critical'){title='Seguimientos críticos';rows=fs.filter(f=>!closed(f)&&Number(f.cat_portafolio_prioridades?.nivel||0)>=3)}
 if(kind==='overdue'){title='Seguimientos vencidos';rows=fs.filter(f=>!closed(f)&&f.fecha_compromiso&&new Date(f.fecha_compromiso+'T00:00:00')<now)}
 if(kind==='products'){const ps=filteredProducts();q('dp-modal-title').textContent='Productos';q('dp-modal-subtitle').textContent=`${ps.length} producto${ps.length===1?'':'s'} en la vista actual`;q('dp-modal-body').innerHTML=`<div class="grid md:grid-cols-2 gap-3">${ps.map(p=>`<div class="rounded-2xl border border-slate-200 p-4"><p class="text-[10px] uppercase font-black text-slate-400">${esc(p.cat_sistemas?.nombre||'')}</p><h4 class="font-black mt-1">${esc(p.nombre)}</h4><p class="text-xs text-slate-500 mt-1">${esc(p.responsable||'Sin responsable definido')}</p><span class="inline-flex mt-3 px-2.5 py-1 rounded-full text-[10px] font-black ${health(p)==='Crítico'?'bg-rose-50 text-rose-700':health(p)==='Atención'?'bg-amber-50 text-amber-700':'bg-emerald-50 text-emerald-700'}">${health(p)}</span></div>`).join('')}</div>`;q('dp-modal').classList.remove('hidden');return}
 openDetail(title,`${rows.length} registro${rows.length===1?'':'s'}`,rows);
}
function detailBy(kind,label){
 let rows=filteredFollowups(),title=label;
 if(kind==='status')rows=rows.filter(f=>(f.cat_portafolio_estatus?.nombre||'Sin definir')===label);
 if(kind==='type')rows=rows.filter(f=>(f.cat_portafolio_tipos?.nombre||'Sin definir')===label);
 if(kind==='product'){const p=filteredProducts().find(p=>p.nombre===label);rows=rows.filter(f=>String(f.producto_id)===String(p?.id));title=`Producto · ${label}`}
 if(kind==='owner'){rows=rows.filter(f=>!closed(f)&&(f.responsable||'Sin responsable')===label);title=`Responsable · ${label}`}
 if(kind==='health'){const ids=new Set(filteredProducts().filter(p=>health(p)===label).map(p=>String(p.id)));rows=rows.filter(f=>ids.has(String(f.producto_id)));title=`Salud · ${label}`}
 openDetail(title,`${rows.length} seguimiento${rows.length===1?'':'s'}`,rows);
}
function showRows(ids,title){const set=new Set(ids.map(String));const rows=S.followups.filter(f=>set.has(String(f.id)));openDetail(title,`${rows.length} seguimiento${rows.length===1?'':'s'}`,rows)}
function closeDetail(){q('dp-modal').classList.add('hidden')}
function init(){window.addEventListener('pmo:profile-ready',load,{once:true});setTimeout(()=>{if(window.PMOAuth?.profile)load()},200)}
window.PMOProductDashboard={load,render,detail,detailBy,showRows,closeDetail};document.addEventListener('DOMContentLoaded',init);
})();