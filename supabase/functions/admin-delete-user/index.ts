import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
const cors={ 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS' };
function reply(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}})}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({error:'Método no permitido'},405);
 try{
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),authorization=req.headers.get('Authorization');
 if(!url||!anon||!secret)return reply({error:'Falta configuración'},500);
 if(!authorization?.startsWith('Bearer '))return reply({error:'Sin sesión'},401);
 const callerClient=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user:caller},error:authError}=await callerClient.auth.getUser();if(authError||!caller)return reply({error:'Sesión inválida'},401);
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:profile,error:profileError}=await admin.from('pmo_user_profiles').select('rol,activo').eq('user_id',caller.id).maybeSingle();
 if(profileError||!profile||profile.rol!=='administrador'||profile.activo===false)return reply({error:'Solo administradores activos'},403);
 const body=await req.json().catch(()=>({}));const target=String(body?.user_id||'');
 if(!/^[0-9a-f-]{36}$/i.test(target))return reply({error:'Identificador inválido'},400);
 if(target===caller.id)return reply({error:'No puedes eliminar tu propia cuenta'},403);
 const {data:targetProfile,error:targetError}=await admin.from('pmo_user_profiles').select('user_id').eq('user_id',target).maybeSingle();
 if(targetError||!targetProfile)return reply({error:'Cuenta inexistente'},404);
 const {error:deleteError}=await admin.auth.admin.deleteUser(target);if(deleteError)return reply({error:deleteError.message},409);
 // Las tablas con referencias pueden tener ON DELETE CASCADE; si no lo tienen, deleteUser falla sin eliminar el perfil.
 return reply({deleted:true,user_id:target});
 }catch(e){return reply({error:String(e)},500)}
});
