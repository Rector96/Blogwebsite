import { createClient } from "@supabase/supabase-js";

const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json"}});
export default async (req:Request)=>{
  if(req.method!=="POST") return json({error:"Method not allowed"},405);
  const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) return json({error:"Storage is not configured."},503);
  const body=await req.json().catch(()=>({}));
  const data=String(body.data||"");
  const mime=String(body.mime_type||"");
  if(!/^data:image\\/(jpeg|png|webp|avif);base64,/i.test(data)) return json({error:"Use JPG, PNG, WebP or AVIF."},400);
  const raw=Buffer.from(data.split(",")[1]||"","base64");
  if(raw.length>4*1024*1024) return json({error:"Image must be 5 MB or smaller."},400);
  const ext=mime.includes("png")?"png":mime.includes("webp")?"webp":mime.includes("avif")?"avif":"jpg";
  const path="advertiser-creatives/"+Date.now().toString(36)+"-"+crypto.randomUUID()+"."+ext;
  const db=createClient(url,key);
  const {error}=await db.storage.from("rwdnews-images").upload(path,raw,{contentType:mime||"image/jpeg",upsert:false});
  if(error) return json({error:"Could not store creative."},500);
  const {data:pub}=db.storage.from("rwdnews-images").getPublicUrl(path);
  return json({ok:true,url:pub.publicUrl});
};

export const config = { path: "/api/advertiser/creative-upload", rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip"] } };\n