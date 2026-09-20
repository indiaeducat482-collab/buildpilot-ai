import {NextResponse} from 'next/server';
export async function POST(req:Request){
 const {idea,backend='Supabase',frontend='Next.js'}=await req.json();
 if(!idea?.trim())return NextResponse.json({error:'Project idea is required'},{status:400});
 const key=process.env.OPENAI_API_KEY;
 if(!key)return NextResponse.json({error:'OPENAI_API_KEY is not configured. Copy .env.example to .env.local and add your server-side API key.'},{status:500});
 const model=process.env.OPENAI_MODEL||'gpt-5-mini';
 const prompt=`You are the architecture and code-planning engine for BuildPilot AI. Create a practical project blueprint for this request. Return valid JSON only with keys: projectName, summary, stack, features, pages, database, auth, files, setupSteps, deploymentSteps, securityNotes. User idea: ${idea}. Frontend: ${frontend}. Backend: ${backend}. Do not include secrets. If Firebase is selected, describe Firebase Auth/Firestore/Storage/rules. If Supabase is selected, describe Auth/Postgres/Storage/RLS and never expose service-role keys.`;
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,input:prompt})});
 const d=await r.json(); if(!r.ok)return NextResponse.json({error:d?.error?.message||'AI request failed'},{status:r.status});
 const text=d.output_text||d.output?.flatMap((x:any)=>x.content||[]).map((c:any)=>c.text||'').join('')||'';
 try{return NextResponse.json(JSON.parse(text))}catch{return NextResponse.json({projectPlan:text})}
}
