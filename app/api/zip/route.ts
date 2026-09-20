import {NextResponse} from 'next/server';
import archiver from 'archiver';
import {Readable} from 'stream';
export const runtime='nodejs';
export async function POST(req:Request){const b=await req.json();const name=String(b.idea||'buildpilot-project').slice(0,45).replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'buildpilot-project';const files:any={
 'README.md':`# BuildPilot AI Project\n\nGenerated project plan.\n\nBackend: ${b.backend}\nFrontend: ${b.frontend}\n\n## Next steps\n1. Install dependencies.\n2. Copy .env.example to .env.local.\n3. Add only server-side secrets where instructed.\n4. Follow SETUP.md.\n5. Push to GitHub and deploy.\n`,
 '.env.example':`OPENAI_API_KEY=\nSUPABASE_URL=\nSUPABASE_PUBLISHABLE_KEY=\nFIREBASE_PROJECT_ID=\n`,
 'SETUP.md':`# Setup Guide\n\n## ${b.backend}\n${b.backend==='Supabase'?'Create a Supabase project, configure Auth, create Postgres tables, enable RLS and add policies. Never put the service-role key in browser code.':'Create your Firebase project, enable the required Authentication provider, Firestore/Storage and publish restrictive security rules.'}\n\n## GitHub\nCreate a repository, upload this folder, commit the files, then connect it to your deployment provider.\n\n## AI\nConfigure OPENAI_API_KEY only on the server.\n`,
 'project-plan.json':JSON.stringify({idea:b.idea,backend:b.backend,frontend:b.frontend,plan:b.plan},null,2),
 'src/README.md':'Place generated application source files here.\n'
}; const chunks:Buffer[]=[];const archive=archiver('zip',{zlib:{level:9}});archive.on('data',c=>chunks.push(Buffer.from(c)));const done=new Promise<void>((res,rej)=>{archive.on('end',()=>res());archive.on('error',rej)});for(const [p,c] of Object.entries(files))archive.append(String(c),{name:`${name}/${p}`});archive.finalize();await done;const body=Buffer.concat(chunks);return new NextResponse(body,{headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="${name}.zip"`}})}
