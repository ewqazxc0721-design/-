const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Companion-Access-Token",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

export async function handler(event){
  if(event.httpMethod === "OPTIONS"){
    return { statusCode:204, headers:corsHeaders, body:"" };
  }
  if(event.httpMethod !== "POST"){
    return { statusCode:405, headers:{ ...corsHeaders, "Content-Type":"application/json" }, body:JSON.stringify({ error:"Method not allowed" }) };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const expectedToken = process.env.AI_COMPANION_ACCESS_TOKEN;
  const suppliedToken = event.headers?.["x-companion-access-token"] || event.headers?.["X-Companion-Access-Token"] || "";
  if(!apiKey || !expectedToken){
    return { statusCode:503, headers:{ ...corsHeaders, "Content-Type":"application/json" }, body:JSON.stringify({ error:"AI 陪练服务尚未配置" }) };
  }
  if(suppliedToken !== expectedToken){
    return { statusCode:401, headers:{ ...corsHeaders, "Content-Type":"application/json" }, body:JSON.stringify({ error:"陪练访问码错误" }) };
  }
  if(!event.body){
    return { statusCode:400, headers:{ ...corsHeaders, "Content-Type":"application/json" }, body:JSON.stringify({ error:"缺少 WebRTC SDP" }) };
  }

  try{
    const sdp = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
    const form = new FormData();
    form.set("sdp", sdp);
    form.set("session", JSON.stringify({
      type:"realtime",
      model:process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-mini",
      audio:{ output:{ voice:process.env.OPENAI_REALTIME_VOICE || "marin" } }
    }));
    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method:"POST",
      headers:{ Authorization:`Bearer ${apiKey}` },
      body:form
    });
    const body = await response.text();
    if(!response.ok){
      console.error("OpenAI Realtime session failed", response.status, body.slice(0, 500));
      return { statusCode:response.status, headers:{ ...corsHeaders, "Content-Type":"application/json" }, body:JSON.stringify({ error:"OpenAI 实时会话创建失败" }) };
    }
    return { statusCode:200, headers:{ ...corsHeaders, "Content-Type":"application/sdp" }, body };
  }catch(err){
    console.error("Realtime session proxy failed", err);
    return { statusCode:500, headers:{ ...corsHeaders, "Content-Type":"application/json" }, body:JSON.stringify({ error:"AI 陪练会话服务异常" }) };
  }
}
