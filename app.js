(() => {
  const C = window.BUILDPILOT_CONFIG || {};
  const client = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_PUBLISHABLE_KEY);
  const app = document.getElementById("app");
  const state = { session:null, profile:null };

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => Number(n || 0).toLocaleString("en-IN");

  async function refreshAuth(){
    const {data:{session}} = await client.auth.getSession();
    state.session=session;
    if(session){
      const {data:profile}=await client.from("profiles").select("*").eq("id",session.user.id).maybeSingle();
      state.profile=profile;
    } else state.profile=null;
  }

  function nav(){
    return `<div class="nav"><div class="brand">BuildPilot <span>AI</span></div>
      <div class="nav-actions">
        ${state.session ? `<span class="pill">${esc(state.session.user.email)}</span><button class="btn" id="logout">Logout</button>` : `<button class="btn" id="loginBtn">Login</button><button class="btn primary" id="signupBtn">Sign up</button>`}
      </div></div>`;
  }

  function bindNav(){
    document.getElementById("logout")?.addEventListener("click", async()=>{await client.auth.signOut(); await refreshAuth(); renderHome();});
    document.getElementById("loginBtn")?.addEventListener("click",()=>location.hash="#login");
    document.getElementById("signupBtn")?.addEventListener("click",()=>location.hash="#signup");
  }

  function renderHome(){
    app.innerHTML = `<div class="shell">${nav()}<main class="container">
      <section class="hero"><h1>Describe it. <span>Build it.</span></h1><p>BuildPilot AI turns your idea into a structured software project.</p></section>
      <section class="chat card">
        <div class="row"><span class="pill">Frontend: HTML / React / Next.js</span><span class="pill">Backend: Supabase / Firebase / GitHub</span></div>
        <div id="messages" class="messages"><div class="msg ai">Hi! Tell me what website or app you want to build.<br><br>Tip: type <b>admin login</b> to open the Admin Login page.</div></div>
        <div class="grid">
          <div><label class="label">Project name</label><input id="projectName" class="input" placeholder="e.g. Coaching Management App"></div>
          <div><label class="label">Frontend</label><select id="frontend" class="select"><option value="html">HTML</option><option value="react">React</option><option value="nextjs">Next.js</option></select></div>
        </div><br>
        <div class="grid">
          <div><label class="label">Backend</label><select id="backend" class="select"><option value="supabase">Supabase</option><option value="firebase">Firebase</option><option value="github">GitHub Only</option></select></div>
          <div><label class="label">Request</label><input id="prompt" class="input" placeholder="Build a coaching website with student login..."></div>
        </div><br>
        <button id="generate" class="btn primary">Generate Project Plan</button>
        <div id="homeNotice" class="notice hidden" style="margin-top:14px"></div>
      </section>
      <section class="grid" style="margin-top:18px">
        <div class="card"><h3>Free limits</h3><p class="muted">5 projects and 2 GitHub-file generation actions by default. Upgrade requests are reviewed by Admin.</p></div>
        <div class="card"><h3>Admin</h3><p class="muted">Type <b>admin login</b> in the chat or use the button below.</p><button class="btn" id="adminOpen">Admin Login</button></div>
      </section>
    </main></div>`;
    bindNav();
    document.getElementById("adminOpen").onclick=()=>location.hash="#admin-login";
    document.getElementById("generate").onclick=generate;
    document.getElementById("prompt").addEventListener("keydown",e=>{if(e.key==="Enter")generate();});
  }

  async function generate(){
    const prompt=document.getElementById("prompt").value.trim();
    const name=document.getElementById("projectName").value.trim();
    const notice=document.getElementById("homeNotice");
    const msgs=document.getElementById("messages");
    if(!state.session){ location.hash="#login"; return; }
    if(!prompt){notice.className="notice error";notice.textContent="Please describe your project.";return;}
    msgs.insertAdjacentHTML("beforeend",`<div class="msg user">${esc(prompt)}</div><div class="msg ai">Building your project plan...</div>`);
    msgs.scrollTop=msgs.scrollHeight;
    const {data,error}=await client.functions.invoke("buildpilot-generate",{body:{prompt,projectName:name,frontend:document.getElementById("frontend").value,backend:document.getElementById("backend").value}});
    if(error){
      notice.className="notice error";
      notice.textContent=error.message || "Generation failed.";
      msgs.insertAdjacentHTML("beforeend",`<div class="msg ai">I could not generate the project. Check your limit or try again.</div>`);
      return;
    }
    if(data?.upgradeRequired){
      notice.className="notice error";
      notice.innerHTML=`${esc(data.message)} <button class="btn primary" id="upgradeNow">Request Upgrade</button>`;
      document.getElementById("upgradeNow").onclick=()=>location.hash="#upgrade";
      return;
    }
    notice.className="notice success-note";
    notice.innerHTML=`Project created successfully. <button class="btn" id="projectsNow">Open Projects</button>`;
    document.getElementById("projectsNow").onclick=()=>location.hash="#projects";
    msgs.insertAdjacentHTML("beforeend",`<div class="msg ai"><b>${esc(data?.plan?.projectName || "Project")}</b><br>${esc(data?.plan?.summary || "Project plan created.")}</div>`);
    msgs.scrollTop=msgs.scrollHeight;
  }

  function authPage(mode){
    const signup=mode==="signup";
    app.innerHTML=`<div class="shell">${nav()}<main class="container"><div class="center card">
      <h2>${signup?"Create account":"Login"}</h2><p class="muted">${signup?"Start with the free BuildPilot plan.":"Login to continue building projects."}</p>
      <div class="stack"><input id="email" class="input" type="email" placeholder="Email"><input id="password" class="input" type="password" placeholder="Password">
      <button id="auth" class="btn primary">${signup?"Create account":"Login"}</button><div id="authMsg" class="notice hidden"></div>
      <div class="row"><button class="btn" id="other">${signup?"Already have an account":"Create new account"}</button><button class="btn" id="back">Home</button></div></div>
    </div></main></div>`;
    bindNav();
    document.getElementById("back").onclick=()=>location.hash="";
    document.getElementById("other").onclick=()=>location.hash=signup?"#login":"#signup";
    document.getElementById("auth").onclick=async()=>{
      const email=document.getElementById("email").value.trim(),password=document.getElementById("password").value;
      const msg=document.getElementById("authMsg");
      let result;
      if(signup) result=await client.auth.signUp({email,password});
      else result=await client.auth.signInWithPassword({email,password});
      if(result.error){msg.className="notice error";msg.textContent=result.error.message;return;}
      if(signup && result.data.user){
        await client.from("profiles").upsert({id:result.data.user.id,full_name:email.split("@")[0]});
        msg.className="notice success-note";msg.textContent="Account created. Check your email if confirmation is enabled, then login.";
      }else{await refreshAuth();location.hash="";}
    };
  }

  async function projectsPage(){
    await refreshAuth(); if(!state.session){location.hash="#login";return;}
    const {data:projects}=await client.from("projects").select("id,name,description,status,frontend,backend,created_at").order("created_at",{ascending:false});
    app.innerHTML=`<div class="shell">${nav()}<main class="container"><div class="row" style="justify-content:space-between"><div><h2>My Projects</h2><p class="muted">Your BuildPilot project history.</p></div><button class="btn" id="home">Build another</button></div>
      <div class="card table-wrap"><table class="table"><thead><tr><th>Name</th><th>Stack</th><th>Status</th><th>Created</th></tr></thead><tbody>${(projects||[]).map(p=>`<tr><td><b>${esc(p.name)}</b><br><span class="muted">${esc(p.description||"")}</span></td><td>${esc(p.frontend)} / ${esc(p.backend)}</td><td>${esc(p.status)}</td><td>${new Date(p.created_at).toLocaleString()}</td></tr>`).join("")||`<tr><td colspan="4">No projects yet.</td></tr>`}</tbody></table></div></main></div>`;
    bindNav();document.getElementById("home").onclick=()=>location.hash="";
  }

  async function upgradePage(){
    await refreshAuth();if(!state.session){location.hash="#login";return;}
    app.innerHTML=`<div class="shell">${nav()}<main class="container"><div class="center card"><h2>Request Limit Upgrade</h2><p class="muted">Tell Admin why you need more projects or GitHub-file generation.</p>
      <div class="stack"><input id="requestedProjects" class="input" type="number" min="5" value="10" placeholder="Project limit"><input id="requestedFiles" class="input" type="number" min="2" value="10" placeholder="GitHub file limit"><textarea id="reason" class="textarea" placeholder="Reason / plan / payment details"></textarea><button id="send" class="btn primary">Send Request to Admin</button><div id="m" class="notice hidden"></div><button class="btn" id="back">Back</button></div></div></main></div>`;
    bindNav();document.getElementById("back").onclick=()=>location.hash="";
    document.getElementById("send").onclick=async()=>{
      const m=document.getElementById("m");
      const {error}=await client.from("upgrade_requests").insert({user_id:state.session.user.id,requested_project_limit:Number(document.getElementById("requestedProjects").value),requested_github_file_limit:Number(document.getElementById("requestedFiles").value),reason:document.getElementById("reason").value.trim()});
      m.className=error?"notice error":"notice success-note";m.textContent=error?error.message:"Request sent to Admin successfully.";
    };
  }

  async function adminLogin(){
    app.innerHTML=`<div class="shell">${nav()}<main class="container"><div class="center card"><h2>Admin Login</h2><p class="muted">Admin access requires an authenticated account with the admin role.</p>
      <div class="stack"><input id="email" class="input" type="email" placeholder="Admin email"><input id="password" class="input" type="password" placeholder="Password"><button id="go" class="btn primary">Admin Login</button><div id="m" class="notice hidden"></div><button class="btn" id="back">Back</button></div></div></main></div>`;
    bindNav();document.getElementById("back").onclick=()=>location.hash="";
    document.getElementById("go").onclick=async()=>{
      const {data,error}=await client.auth.signInWithPassword({email:document.getElementById("email").value.trim(),password:document.getElementById("password").value});
      const m=document.getElementById("m");if(error){m.className="notice error";m.textContent=error.message;return;}
      state.session=data.session;
      const {data:p,error:pe}=await client.from("profiles").select("*").eq("id",data.user.id).single();
      if(pe||p?.role!=="admin"){await client.auth.signOut();m.className="notice error";m.textContent="This account is not an Admin.";return;}
      if(p.status!=="active"){await client.auth.signOut();m.className="notice error";m.textContent="Admin account is not active.";return;}
      state.profile=p;location.hash="#admin";
    };
  }

  async function adminPage(){
    await refreshAuth();if(!state.session||state.profile?.role!=="admin"){location.hash="#admin-login";return;}
    const [{data:users},{data:projects},{data:requests}]=await Promise.all([
      client.from("profiles").select("*").order("created_at",{ascending:false}),
      client.from("projects").select("id,user_id,name,status,created_at").order("created_at",{ascending:false}).limit(100),
      client.from("upgrade_requests").select("*").order("created_at",{ascending:false})
    ]);
    const active=(users||[]).filter(u=>u.status==="active").length,blocked=(users||[]).filter(u=>u.status==="blocked").length;
    app.innerHTML=`<div class="shell">${nav()}<main class="container"><div class="row" style="justify-content:space-between"><div><h2>Admin Dashboard</h2><p class="muted">Users, projects, limits and upgrade requests.</p></div><button class="btn" id="home">User App</button></div>
      <div class="stats"><div class="stat"><span class="muted">Users</span><b>${(users||[]).length}</b></div><div class="stat"><span class="muted">Active</span><b>${active}</b></div><div class="stat"><span class="muted">Blocked</span><b>${blocked}</b></div><div class="stat"><span class="muted">Projects</span><b>${(projects||[]).length}</b></div></div>
      <br><div class="grid">
      <div class="card"><h3>Users</h3><div class="table-wrap"><table class="table"><thead><tr><th>Email</th><th>Plan / Limits</th><th>Status</th><th>Action</th></tr></thead><tbody>${(users||[]).map(u=>`<tr><td>${esc(u.full_name||u.id)}<br><span class="muted">${esc(u.id)}</span></td><td>${esc(u.plan)}<br>${u.project_limit} projects / ${u.github_file_limit} files</td><td>${esc(u.status)} ${u.role==="admin"?'<span class="pill">ADMIN</span>':""}</td><td>${u.role!=="admin"?`<button class="btn ${u.status==="blocked"?"success":"danger"}" data-user="${u.id}" data-action="${u.status==="blocked"?"activate":"block"}">${u.status==="blocked"?"Reactivate":"Block"}</button>`:""}</td></tr>`).join("")}</tbody></table></div></div>
      <div class="card"><h3>Upgrade Requests</h3><div class="table-wrap"><table class="table"><thead><tr><th>User</th><th>Requested</th><th>Reason</th><th>Action</th></tr></thead><tbody>${(requests||[]).map(r=>`<tr><td>${esc(r.user_id)}</td><td>${r.requested_project_limit} projects / ${r.requested_github_file_limit} files</td><td>${esc(r.reason||"")}</td><td>${r.status==="pending"?`<button class="btn success" data-req="${r.id}" data-rstatus="approved">Approve</button> <button class="btn danger" data-req="${r.id}" data-rstatus="rejected">Reject</button>`:esc(r.status)}</td></tr>`).join("")||`<tr><td colspan="4">No requests.</td></tr>`}</tbody></table></div></div></div>
      <br><div class="card"><h3>Recent Projects</h3><div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>User</th><th>Status</th><th>Created</th></tr></thead><tbody>${(projects||[]).map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.user_id)}</td><td>${esc(p.status)}</td><td>${new Date(p.created_at).toLocaleString()}</td></tr>`).join("")||"<tr><td colspan=4>No projects.</td></tr>"}</tbody></table></div></div>
      </main></div>`;
    bindNav();document.getElementById("home").onclick=()=>location.hash="";
    document.querySelectorAll("[data-user]").forEach(b=>b.onclick=()=>adminUserAction(b.dataset.user,b.dataset.action));
    document.querySelectorAll("[data-req]").forEach(b=>b.onclick=()=>adminRequestAction(b.dataset.req,b.dataset.rstatus));
  }

  async function adminUserAction(id,action){
    const status=action==="block"?"blocked":"active";
    const {error}=await client.from("profiles").update({status}).eq("id",id);
    if(error) alert(error.message); else adminPage();
  }
  async function adminRequestAction(id,status){
    const {data:req}=await client.from("upgrade_requests").select("*").eq("id",id).single();
    if(!req)return;
    const patch={status,reviewed_by:state.session.user.id,reviewed_at:new Date().toISOString()};
    if(status==="approved") patch.approved_project_limit=req.requested_project_limit,patch.approved_github_file_limit=req.requested_github_file_limit;
    const {error}=await client.from("upgrade_requests").update(patch).eq("id",id);
    if(error){alert(error.message);return;}
    if(status==="approved"){
      await client.from("profiles").update({project_limit:req.requested_project_limit,github_file_limit:req.requested_github_file_limit,plan:"premium"}).eq("id",req.user_id);
    }
    adminPage();
  }

  function router(){
    const h=location.hash;
    if(h==="#login") authPage("login");
    else if(h==="#signup") authPage("signup");
    else if(h==="#admin-login") adminLogin();
    else if(h==="#admin") adminPage();
    else if(h==="#projects") projectsPage();
    else if(h==="#upgrade") upgradePage();
    else renderHome();
  }

  window.addEventListener("hashchange",router);
  refreshAuth().then(router);
})();