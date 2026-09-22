(() => {
  const C = window.BUILDPILOT_CONFIG || {};
  const client = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_PUBLISHABLE_KEY);
  const app = document.getElementById('app');
  const state = {
    session: null,
    profile: null,
    projectTypes: [],
    selectedProjectType: null,
    workspace: { name: '', plan: null, projectId: null, files: [], activeFile: null }
  };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const notice = (id, cls, text) => { const el = document.getElementById(id); if (el) { el.className = `notice ${cls}`; el.textContent = text; } };

  async function ensureProfile(user) {
    if (!user) return null;
    const { data: existing } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (existing) return existing;
    const { data: created } = await client.from('profiles').insert({ id: user.id, full_name: user.email?.split('@')[0] || 'User' }).select('*').single();
    return created || null;
  }

  async function refreshAuth() {
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      state.session = data?.session || null;
      state.profile = state.session?.user ? await ensureProfile(state.session.user) : null;
      return state.session;
    } catch (e) { console.error(e); state.session = null; state.profile = null; return null; }
  }

  async function getActiveSession() {
    let s = await refreshAuth();
    if (s?.access_token) return s;
    const { data, error } = await client.auth.refreshSession();
    if (error) return null;
    state.session = data?.session || null;
    state.profile = state.session?.user ? await ensureProfile(state.session.user) : null;
    return state.session;
  }

  async function loadProjectTypes() {
    const { data, error } = await client.from('project_types').select('id,name,code,description').order('name');
    if (error) { console.error(error); state.projectTypes = []; return []; }
    state.projectTypes = data || [];
    if (!state.selectedProjectType && state.projectTypes.length) state.selectedProjectType = state.projectTypes.find(x => x.code === 'website') || state.projectTypes[0];
    return state.projectTypes;
  }

  function nav() {
    return `<header class="topbar"><div class="brandmark" onclick="location.hash=''">BuildPilot <span>AI</span></div><div class="top-actions">
      ${state.session ? `<span class="user-chip">${esc(state.session.user.email)}</span><button class="btn ghost" id="projectsBtn">Projects</button><button class="btn ghost" id="logout">Logout</button>` : `<button class="btn ghost" id="loginBtn">Login</button><button class="btn primary" id="signupBtn">Start Building</button>`}
    </div></header>`;
  }
  function bindNav() {
    document.getElementById('logout')?.addEventListener('click', async () => { await client.auth.signOut(); state.session=null; state.profile=null; location.hash=''; });
    document.getElementById('loginBtn')?.addEventListener('click', () => location.hash='#login');
    document.getElementById('signupBtn')?.addEventListener('click', () => location.hash='#signup');
    document.getElementById('projectsBtn')?.addEventListener('click', () => location.hash='#projects');
  }

  function typeCards() {
    return state.projectTypes.map(t => {
      const selected = state.selectedProjectType?.id === t.id;
      const complete = t.code === 'complete_system';
      return `<button class="type-card ${selected?'selected':''}" data-type="${esc(t.id)}"><div class="type-icon">${complete?'⚙':'✦'}</div><div><strong>${esc(t.name)}</strong><p>${esc(t.description || '')}</p><small>${complete?'Auth · Database · RLS · Admin':'Responsive frontend · No backend required'}</small></div></button>`;
    }).join('');
  }

  function bindTypes() {
    document.querySelectorAll('[data-type]').forEach(b => b.onclick = () => { state.selectedProjectType = state.projectTypes.find(t => t.id === b.dataset.type) || null; renderHome(); });
  }

  async function renderHome() {
    await loadProjectTypes();
    const selected = state.selectedProjectType;
    app.innerHTML = `<div class="site">${nav()}<main class="landing">
      <section class="hero2"><div class="eyebrow">AI SOFTWARE BUILDER</div><h1>Describe it. <span>Build it.</span> Ship it.</h1><p>Turn an idea into a real website or complete application with AI.</p></section>
      <section class="builder-card">
        <div class="builder-head"><div><span class="tiny-label">NEW PROJECT</span><h2>What do you want to build?</h2></div><span class="status-dot">● AI Ready</span></div>
        <div class="type-grid">${typeCards()}</div>
        <div class="builder-fields">
          <label>Project name<input id="projectName" class="input" placeholder="My Coaching App"></label>
          <label>Frontend<select id="frontend" class="input"><option value="html">HTML / CSS / JavaScript</option><option value="react">React</option><option value="nextjs">Next.js</option></select></label>
        </div>
        <label class="req-label">Describe your idea<textarea id="prompt" class="textarea promptbox" placeholder="Example: Build a coaching institute website with student login, teacher dashboard, courses, admission form and admin panel..."></textarea></label>
        <div class="quick-row"><button class="quick" data-q="Create a modern business website with Home, About, Services, Contact and WhatsApp button.">Business website</button><button class="quick" data-q="Create a coaching management system with student login, teacher login, admin panel, courses and attendance.">Coaching system</button><button class="quick" data-q="Create a responsive portfolio website with projects, skills, contact form and dark modern design.">Portfolio</button></div>
        <div class="builder-bottom"><div class="selected-stack">${selected ? `<span class="stack-pill">${selected.code==='complete_system'?'⚙ Complete System':'✦ Website Only'}</span>` : ''}<span class="muted">Supabase powers Complete System projects</span></div><button id="startBuild" class="btn primary big">✦ Build with AI</button></div>
        <div id="homeNotice" class="notice hidden"></div>
      </section>
      <section class="support-grid"><div class="mini-card"><b>AI Builder</b><span>Chat with your project and keep improving it.</span></div><div class="mini-card"><b>Live Workspace</b><span>Files, code, preview and project architecture in one place.</span></div><div class="mini-card"><b>Secure Backend</b><span>Supabase Auth, PostgreSQL and RLS for complete systems.</span></div></section>
      <section class="help-card"><div><b>Need help?</b><p>Website नहीं बन रही है या BuildPilot में problem है?</p></div><div class="row"><a class="btn" href="tel:9006977016">📞 9006977016</a><a class="btn" target="_blank" rel="noopener" href="https://wa.me/919006977016">WhatsApp</a><button class="btn" id="adminOpen">Admin Login</button></div></section>
    </main></div>`;
    bindNav(); bindTypes();
    document.querySelectorAll('[data-q]').forEach(b => b.onclick=()=>{document.getElementById('prompt').value=b.dataset.q; document.getElementById('prompt').focus();});
    document.getElementById('adminOpen').onclick=()=>location.hash='#admin-login';
    document.getElementById('startBuild').onclick=generate;
  }

  async function readFunctionError(error) {
    try { if (error?.context && typeof error.context.json==='function') { const body=await error.context.json(); return body?.error || body?.message || error.message; } } catch(_) {}
    return error?.message || 'Failed to send a request to the Edge Function.';
  }

  async function generate() {
    const prompt=document.getElementById('prompt')?.value.trim();
    const name=document.getElementById('projectName')?.value.trim() || 'BuildPilot Project';
    if (!state.selectedProjectType) return notice('homeNotice','error','Please select Website Only or Complete System.');
    if (!prompt) return notice('homeNotice','error','Please describe what you want to build.');
    const session=await getActiveSession();
    if (!session?.access_token) { location.hash='#login'; return; }
    const btn=document.getElementById('startBuild'); btn.disabled=true; btn.textContent='✦ Building...';
    notice('homeNotice','info','AI is planning your project. Please wait...');
    const { data,error }=await client.functions.invoke('buildpilot-generate',{headers:{Authorization:`Bearer ${session.access_token}`},body:{prompt,projectName:name,projectTypeId:state.selectedProjectType.id,projectTypeCode:state.selectedProjectType.code,projectTypeName:state.selectedProjectType.name,frontend:document.getElementById('frontend').value,backend:state.selectedProjectType.code==='complete_system'?'supabase':'none'}});
    btn.disabled=false; btn.textContent='✦ Build with AI';
    if (error) { const m=await readFunctionError(error); notice('homeNotice','error',m); return; }
    if (data?.upgradeRequired) { notice('homeNotice','error',data.message||'Project limit reached.'); setTimeout(()=>location.hash='#upgrade',700); return; }
    state.workspace={name,plan:data?.plan||null,projectId:data?.projectId||null,files:data?.plan?.files||[],activeFile:null};
    location.hash='#builder';
  }

  function builderShell() {
    const plan=state.workspace.plan||{}; const files=Array.isArray(state.workspace.files)?state.workspace.files:[];
    if (!state.workspace.activeFile && files.length) state.workspace.activeFile=files[0].path;
    const active=files.find(f=>f.path===state.workspace.activeFile);
    const code=active ? `// ${active.path}\n// ${active.purpose||'Generated project file'}\n\n// BuildPilot will generate the full file contents in the next generation step.` : '// Select a file from the left panel.';
    return `<div class="workspace"><header class="workspace-top"><div class="brandmark">BuildPilot <span>AI</span></div><div class="workspace-name">${esc(state.workspace.name||plan.projectName||'Untitled Project')} <span class="live-badge">DRAFT</span></div><div class="top-actions"><button class="btn ghost" id="backHome">Home</button><button class="btn" id="downloadPlan">Project Plan</button><button class="btn primary" id="publishBtn">Publish</button></div></header>
      <div class="workspace-grid">
        <aside class="panel files-panel"><div class="panel-title">FILES</div><div class="file-list">${files.length?files.map(f=>`<button class="file-row ${state.workspace.activeFile===f.path?'active':''}" data-file="${esc(f.path)}"><span>◻</span>${esc(f.path)}</button>`).join(''):`<div class="empty">AI planned the project. Full file generation will populate this tree.</div>`}</div><div class="panel-footer"><button class="btn full" id="newPrompt">✦ Ask AI to change this</button></div></aside>
        <main class="preview-panel"><div class="preview-tabs"><span>PREVIEW</span><span class="muted">CODE</span><span class="muted">DATABASE</span></div><div class="preview-frame"><div class="browser-bar"><span></span><span></span><span></span><div>localhost / ${esc(state.workspace.name||'preview')}</div></div><div class="preview-content"><div class="preview-icon">✦</div><h2>${esc(plan.projectName||state.workspace.name||'Your project')}</h2><p>${esc(plan.summary||'Your AI-generated project workspace is ready.')}</p><div class="preview-cards"><div></div><div></div><div></div></div></div></div></main>
        <aside class="panel ai-panel"><div class="panel-title">BUILDPILOT AI</div><div id="builderMessages" class="builder-messages"><div class="ai-bubble"><b>Project created.</b><br>${esc(plan.summary||'I created the architecture for your project. Tell me what you want to change.')}</div></div><div class="ai-compose"><textarea id="modifyPrompt" placeholder="Ask BuildPilot to add a feature, change the design, fix an error..."></textarea><button id="modifyBtn" class="btn primary">Send ✦</button></div></aside>
      </div>
      <footer class="workspace-footer"><span>Architecture: ${esc(plan.frontend||'HTML')} / ${esc(plan.backend||'No backend')}</span><span>Project ID: ${esc(state.workspace.projectId||'pending')}</span></footer></div>`;
  }

  function renderBuilder() {
    app.innerHTML=builderShell();
    document.getElementById('backHome').onclick=()=>location.hash='';
    document.getElementById('publishBtn').onclick=()=>alert('Publish automation will connect GitHub + deployment in the next step.');
    document.getElementById('downloadPlan').onclick=()=>{const blob=new Blob([JSON.stringify(state.workspace.plan||{},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='buildpilot-project-plan.json';a.click();URL.revokeObjectURL(a.href);};
    document.querySelectorAll('[data-file]').forEach(b=>b.onclick=()=>{state.workspace.activeFile=b.dataset.file;renderBuilder();});
    document.getElementById('newPrompt').onclick=()=>document.getElementById('modifyPrompt')?.focus();
    document.getElementById('modifyBtn').onclick=()=>modifyProject();
  }

  async function modifyProject() {
    const el=document.getElementById('modifyPrompt'); const text=el?.value.trim(); if(!text)return;
    const box=document.getElementById('builderMessages'); box.insertAdjacentHTML('beforeend',`<div class="user-bubble">${esc(text)}</div><div class="ai-bubble">I’m preparing this change. Existing-project modification will be connected to the project version engine next.</div>`); box.scrollTop=box.scrollHeight; el.value='';
  }

  function authPage(mode) {
    const signup=mode==='signup'; app.innerHTML=`<div class="site">${nav()}<main class="auth-wrap"><div class="auth-card"><div class="eyebrow">BUILDPILOT AI</div><h2>${signup?'Create your account':'Welcome back'}</h2><p class="muted">${signup?'Start building with AI.':'Login to continue building.'}</p><div class="stack"><input id="email" class="input" type="email" placeholder="Email"><input id="password" class="input" type="password" placeholder="Password"><button id="auth" class="btn primary big">${signup?'Create account':'Login'}</button><div id="authMsg" class="notice hidden"></div><div class="row"><button class="btn ghost" id="other">${signup?'Already have an account':'Create new account'}</button><button class="btn ghost" id="back">Home</button></div></div></div></main></div>`;
    bindNav(); document.getElementById('back').onclick=()=>location.hash=''; document.getElementById('other').onclick=()=>location.hash=signup?'#login':'#signup';
    document.getElementById('auth').onclick=async()=>{const email=document.getElementById('email').value.trim(),password=document.getElementById('password').value,msg=document.getElementById('authMsg');if(!email||password.length<6){msg.className='notice error';msg.textContent='Enter a valid email and password of at least 6 characters.';return;}const r=signup?await client.auth.signUp({email,password}):await client.auth.signInWithPassword({email,password});if(r.error){msg.className='notice error';msg.textContent=r.error.message;return;}if(signup){if(r.data.user&&r.data.session)await ensureProfile(r.data.user);msg.className='notice success-note';msg.textContent=r.data.session?'Account created.':'Account created. Confirm your email, then login.';}else{state.session=r.data.session;state.profile=state.session?.user?await ensureProfile(state.session.user):null;location.hash='';}};
  }

  async function projectsPage(){await refreshAuth();if(!state.session){location.hash='#login';return;}const {data,error}=await client.from('projects').select('id,name,description,status,frontend,backend,project_type_id,created_at').order('created_at',{ascending:false});app.innerHTML=`<div class="site">${nav()}<main class="container"><div class="page-head"><div><div class="eyebrow">WORKSPACE</div><h2>My Projects</h2></div><button class="btn primary" id="new">+ New project</button></div>${error?`<div class="notice error">${esc(error.message)}</div>`:''}<div class="project-list">${(data||[]).map(p=>`<div class="project-item"><div><b>${esc(p.name)}</b><p>${esc(p.description||'')}</p></div><span class="pill">${esc(p.status)}</span></div>`).join('')||'<div class="empty-card">No projects yet.</div>'}</div></main></div>`;bindNav();document.getElementById('new').onclick=()=>location.hash='';}

  async function upgradePage(){await refreshAuth();if(!state.session){location.hash='#login';return;}app.innerHTML=`<div class="site">${nav()}<main class="auth-wrap"><div class="auth-card"><div class="eyebrow">PLAN UPGRADE</div><h2>Request more capacity</h2><div class="stack"><input id="requestedProjects" class="input" type="number" min="5" value="10"><input id="requestedFiles" class="input" type="number" min="2" value="10"><textarea id="reason" class="textarea" placeholder="Reason / required plan"></textarea><button id="send" class="btn primary">Send Request</button><div id="m" class="notice hidden"></div><button class="btn ghost" id="back">Back</button></div></div></main></div>`;bindNav();document.getElementById('back').onclick=()=>location.hash='';document.getElementById('send').onclick=async()=>{const {error}=await client.from('upgrade_requests').insert({user_id:state.session.user.id,requested_project_limit:Number(document.getElementById('requestedProjects').value),requested_github_file_limit:Number(document.getElementById('requestedFiles').value),reason:document.getElementById('reason').value.trim()});notice('m',error?'error':'success-note',error?error.message:'Request sent to Admin successfully.');};}

  async function adminLogin(){app.innerHTML=`<div class="site">${nav()}<main class="auth-wrap"><div class="auth-card"><div class="eyebrow">ADMIN</div><h2>Admin Login</h2><div class="stack"><input id="email" class="input" type="email" placeholder="Admin email"><input id="password" class="input" type="password" placeholder="Password"><button id="go" class="btn primary">Login</button><div id="m" class="notice hidden"></div><button class="btn ghost" id="back">Back</button></div></div></main></div>`;bindNav();document.getElementById('back').onclick=()=>location.hash='';document.getElementById('go').onclick=async()=>{const m=document.getElementById('m');const {data,error}=await client.auth.signInWithPassword({email:document.getElementById('email').value.trim(),password:document.getElementById('password').value});if(error){m.className='notice error';m.textContent=error.message;return;}await refreshAuth();if(state.profile?.role!=='admin'||state.profile?.status!=='active'){await client.auth.signOut();m.className='notice error';m.textContent='This account is not an active Admin.';return;}location.hash='#admin';};}

  async function adminPage(){await refreshAuth();if(!state.session||state.profile?.role!=='admin'||state.profile?.status!=='active'){location.hash='#admin-login';return;}const [{data:users},{data:projects},{data:requests}]=await Promise.all([client.from('profiles').select('*').order('created_at',{ascending:false}),client.from('projects').select('*').order('created_at',{ascending:false}).limit(100),client.from('upgrade_requests').select('*').order('created_at',{ascending:false})]);app.innerHTML=`<div class="site">${nav()}<main class="container"><div class="page-head"><div><div class="eyebrow">ADMIN CONSOLE</div><h2>BuildPilot Control Center</h2></div><button class="btn" id="home">User App</button></div><div class="stats"><div class="stat"><small>Users</small><b>${(users||[]).length}</b></div><div class="stat"><small>Active</small><b>${(users||[]).filter(x=>x.status==='active').length}</b></div><div class="stat"><small>Blocked</small><b>${(users||[]).filter(x=>x.status==='blocked').length}</b></div><div class="stat"><small>Projects</small><b>${(projects||[]).length}</b></div></div><div class="admin-grid"><div class="card"><h3>Users</h3><div class="table-wrap"><table class="table"><tbody>${(users||[]).map(u=>`<tr><td>${esc(u.full_name||u.id)}<br><small>${esc(u.plan)} · ${u.project_limit} projects</small></td><td>${esc(u.status)}</td><td>${u.role==='admin'?'<span class="pill">ADMIN</span>':`<button class="btn ${u.status==='blocked'?'success':'danger'}" data-user="${u.id}" data-action="${u.status==='blocked'?'active':'blocked'}">${u.status==='blocked'?'Reactivate':'Block'}</button>`}</td></tr>`).join('')}</tbody></table></div></div><div class="card"><h3>Upgrade Requests</h3><div class="table-wrap"><table class="table"><tbody>${(requests||[]).map(r=>`<tr><td>${esc(r.user_id)}</td><td>${r.requested_project_limit} / ${r.requested_github_file_limit}</td><td>${esc(r.status)}</td><td>${r.status==='pending'?`<button class="btn success" data-req="${r.id}" data-r="approved">Approve</button> <button class="btn danger" data-req="${r.id}" data-r="rejected">Reject</button>`:''}</td></tr>`).join('')}</tbody></table></div></div></div></main></div>`;bindNav();document.getElementById('home').onclick=()=>location.hash='';document.querySelectorAll('[data-user]').forEach(b=>b.onclick=async()=>{const {error}=await client.from('profiles').update({status:b.dataset.action}).eq('id',b.dataset.user);if(error)alert(error.message);else adminPage();});document.querySelectorAll('[data-req]').forEach(b=>b.onclick=async()=>{const id=b.dataset.req,status=b.dataset.r;const {data:req}=await client.from('upgrade_requests').select('*').eq('id',id).single();if(!req)return;const patch={status,reviewed_by:state.session.user.id,reviewed_at:new Date().toISOString()};if(status==='approved'){patch.approved_project_limit=req.requested_project_limit;patch.approved_github_file_limit=req.requested_github_file_limit;}const {error}=await client.from('upgrade_requests').update(patch).eq('id',id);if(error){alert(error.message);return;}if(status==='approved')await client.from('profiles').update({project_limit:req.requested_project_limit,github_file_limit:req.requested_github_file_limit,plan:'premium'}).eq('id',req.user_id);adminPage();});}

  function router(){const h=location.hash;if(h==='#login')authPage('login');else if(h==='#signup')authPage('signup');else if(h==='#builder')renderBuilder();else if(h==='#projects')projectsPage();else if(h==='#upgrade')upgradePage();else if(h==='#admin-login')adminLogin();else if(h==='#admin')adminPage();else renderHome();}
  window.addEventListener('hashchange',router);
  client.auth.onAuthStateChange(async(_e,session)=>{state.session=session||null;state.profile=session?.user?await ensureProfile(session.user):null;if(!session&&['#projects','#upgrade','#admin'].includes(location.hash)){location.hash='#login';return;}if(!location.hash||location.hash==='#')router();});
  refreshAuth().then(router);
})();
