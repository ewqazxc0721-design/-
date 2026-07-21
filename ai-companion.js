(() => {
  "use strict";

  const ACCESS_TOKEN_KEY = "training-companion-access-token";
  const SESSION_ENDPOINT = "/.netlify/functions/realtime-session";
  const $ = (id) => document.getElementById(id);
  const bridge = window.trainingCompanionBridge;
  if(!bridge) return;

  let peer = null;
  let channel = null;
  let microphone = null;
  let remoteAudio = null;
  let connected = false;
  let toolCalls = new Set();

  const tools = [
    {
      type:"function",
      name:"get_today_training",
      description:"读取今天的训练计划、动作项目和完成状态。回答训练项目问题前先调用。",
      parameters:{ type:"object", properties:{}, additionalProperties:false }
    },
    {
      type:"function",
      name:"record_exercise",
      description:"记录今天某个训练项目是否完成，并保存用户主观难度和备注。只有用户明确确认完成情况后调用。",
      parameters:{
        type:"object",
        properties:{
          item_name:{ type:"string", description:"今日计划中的动作名称或可明确匹配的简称" },
          completed:{ type:"boolean", description:"是否完成" },
          difficulty:{ type:"number", minimum:1, maximum:10, description:"主观难度 1 到 10" },
          note:{ type:"string", description:"动作感受或备注，没有则为空字符串" }
        },
        required:["item_name","completed","difficulty","note"],
        additionalProperties:false
      }
    },
    {
      type:"function",
      name:"complete_today_training",
      description:"当用户明确表示今天全部训练完成时，一次完成今天所有项目并记录整体难度。",
      parameters:{
        type:"object",
        properties:{
          difficulty:{ type:"number", minimum:1, maximum:10, description:"今天整体主观难度 1 到 10" },
          note:{ type:"string", description:"今天整体感受或备注，没有则为空字符串" }
        },
        required:["difficulty","note"],
        additionalProperties:false
      }
    },
    {
      type:"function",
      name:"control_rest_timer",
      description:"设置、开始、暂停、重置或停止网页中的组间休息倒计时器。",
      parameters:{
        type:"object",
        properties:{
          action:{ type:"string", enum:["start","pause","reset","stop"] },
          seconds:{ type:"number", minimum:1, maximum:5999, description:"开始计时时的秒数；其他操作可省略" }
        },
        required:["action"],
        additionalProperties:false
      }
    }
  ];

  function setState(label, state){
    const el = $("aiCompanionState");
    if(!el) return;
    el.textContent = label;
    el.dataset.state = state;
  }

  function setLive(text){
    const el = $("aiCompanionLive");
    if(el) el.textContent = text;
  }

  function renderToday(){
    const context = bridge.getTodayContext();
    const done = context.items.filter((item) => item.completed).length;
    const names = context.items.map((item) => `${item.completed ? "✓" : "○"} ${item.text}`).join("；");
    const el = $("aiCompanionToday");
    if(el) el.textContent = `${context.dayName} · ${context.focus || "今日训练"} · ${done}/${context.items.length} 项完成${names ? `｜${names}` : ""}`;
    return context;
  }

  function send(event){
    if(!channel || channel.readyState !== "open") return false;
    channel.send(JSON.stringify(event));
    return true;
  }

  function getInstructions(){
    const today = bridge.getTodayContext();
    return [
      "你是简洁、积极、不过度打扰的中文 AI 训练陪练。",
      "你的职责仅限：播报今天训练、逐项记录完成情况、控制组间计时、训练中给予短鼓励、询问并记录 1 到 10 分主观难度。",
      "不要生成或修改训练计划，不提供医学诊断。出现疼痛、眩晕、呼吸异常时建议立即停止并寻求专业帮助。",
      "全身高强度训练与次日恢复在计划中强制绑定。恢复日不要建议额外高强度或力量训练，只协助记录轻活动与恢复项目。",
      "记录前要确认动作名称、是否完成和难度；如果用户没说难度，用一句话追问。",
      "计时结束后用一句短句提醒并鼓励继续下一组。工具成功后明确告诉用户已经写入网页。",
      `今天上下文：${JSON.stringify(today)}`
    ].join("\n");
  }

  async function executeTool(name, args){
    if(name === "get_today_training") return bridge.getTodayContext();
    if(name === "record_exercise") return bridge.recordExercise(args);
    if(name === "complete_today_training") return bridge.completeToday(args);
    if(name === "control_rest_timer") return bridge.controlTimer(args);
    return { ok:false, error:`未知工具：${name}` };
  }

  async function handleToolCall(item){
    const callId = item.call_id || item.id;
    if(!callId || toolCalls.has(callId)) return;
    toolCalls.add(callId);
    let args = {};
    try{ args = JSON.parse(item.arguments || "{}"); }catch(_){ args = {}; }
    let output;
    try{
      output = await executeTool(item.name, args);
      renderToday();
    }catch(err){
      output = { ok:false, error:err?.message || String(err) };
    }
    send({
      type:"conversation.item.create",
      item:{ type:"function_call_output", call_id:callId, output:JSON.stringify(output) }
    });
    send({ type:"response.create" });
  }

  function handleEvent(event){
    if(event.type === "response.output_audio_transcript.delta" && event.delta){
      setLive(`陪练：${event.delta}`);
    }else if(event.type === "response.output_audio_transcript.done" && event.transcript){
      setLive(`陪练：${event.transcript}`);
    }else if(event.type === "conversation.item.input_audio_transcription.completed" && event.transcript){
      setLive(`你：${event.transcript}`);
    }else if(event.type === "response.output_item.done" && event.item?.type === "function_call"){
      handleToolCall(event.item);
    }else if(event.type === "error"){
      const message = event.error?.message || "实时会话发生错误";
      setLive(message);
      setState("连接异常", "error");
    }
  }

  function configureSession(){
    send({
      type:"session.update",
      session:{
        type:"realtime",
        instructions:getInstructions(),
        output_modalities:["audio"],
        audio:{
          input:{
            transcription:{ model:"gpt-4o-mini-transcribe" },
            turn_detection:{ type:"server_vad", create_response:true, interrupt_response:true }
          },
          output:{ voice:"marin" }
        },
        tools,
        tool_choice:"auto"
      }
    });
    send({
      type:"response.create",
      response:{ instructions:"用一句话打招呼，然后简短说出今天训练主题和未完成项目数量。" }
    });
  }

  async function start(){
    if(connected) return;
    const token = localStorage.getItem(ACCESS_TOKEN_KEY) || "";
    if(!token){
      setState("需要访问码", "error");
      setLive("请展开“连接设置”，先保存陪练访问码。不要填写 OpenAI API Key。");
      $("aiCompanionAccessToken")?.focus();
      return;
    }
    if(!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection){
      setState("浏览器不支持", "error");
      setLive("当前浏览器不支持实时语音，请使用最新版 Safari、Chrome 或 Edge，并通过 HTTPS 打开网页。");
      return;
    }

    setState("正在连接", "connecting");
    setLive("正在请求麦克风并建立实时语音连接…");
    $("aiCompanionStartBtn").disabled = true;
    try{
      peer = new RTCPeerConnection();
      remoteAudio = document.createElement("audio");
      remoteAudio.autoplay = true;
      remoteAudio.playsInline = true;
      peer.ontrack = (event) => { remoteAudio.srcObject = event.streams[0]; };

      microphone = await navigator.mediaDevices.getUserMedia({
        audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true }
      });
      microphone.getTracks().forEach((track) => peer.addTrack(track, microphone));

      channel = peer.createDataChannel("oai-events");
      channel.onmessage = (message) => {
        try{ handleEvent(JSON.parse(message.data)); }catch(err){ console.error("Realtime event parse failed", err); }
      };
      channel.onopen = () => {
        connected = true;
        setState("语音进行中", "live");
        setLive("连接成功，正在载入今日训练…");
        $("aiCompanionStopBtn").disabled = false;
        configureSession();
      };
      channel.onclose = () => { if(connected) stop("连接已结束"); };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const response = await fetch(new URL(SESSION_ENDPOINT, location.origin), {
        method:"POST",
        headers:{ "Content-Type":"application/sdp", "X-Companion-Access-Token":token },
        body:offer.sdp
      });
      const answerSdp = await response.text();
      if(!response.ok){
        let detail = answerSdp;
        try{ detail = JSON.parse(answerSdp).error || detail; }catch(_){}
        throw new Error(detail || `会话服务返回 HTTP ${response.status}`);
      }
      await peer.setRemoteDescription({ type:"answer", sdp:answerSdp });
    }catch(err){
      stop();
      setState("连接失败", "error");
      const message = String(err?.message || err);
      setLive(message.includes("404") || message.includes("Failed to fetch")
        ? "找不到 AI 陪练会话服务。GitHub Pages 不能运行服务端函数，请部署到 Netlify 并配置环境变量。"
        : `连接失败：${message}`);
    }
  }

  function stop(message = "陪练已结束。训练记录和难度评估已保存在本机。"){
    connected = false;
    try{ channel?.close(); }catch(_){}
    try{ peer?.close(); }catch(_){}
    microphone?.getTracks().forEach((track) => track.stop());
    if(remoteAudio) remoteAudio.srcObject = null;
    peer = null;
    channel = null;
    microphone = null;
    remoteAudio = null;
    toolCalls = new Set();
    setState("未连接", "idle");
    setLive(message);
    if($("aiCompanionStartBtn")) $("aiCompanionStartBtn").disabled = false;
    if($("aiCompanionStopBtn")) $("aiCompanionStopBtn").disabled = true;
  }

  function saveAccessToken(){
    const value = $("aiCompanionAccessToken")?.value.trim() || "";
    if(value) localStorage.setItem(ACCESS_TOKEN_KEY, value);
    else localStorage.removeItem(ACCESS_TOKEN_KEY);
    if($("aiCompanionAccessToken")) $("aiCompanionAccessToken").value = "";
    setLive(value ? "访问码已保存到当前浏览器。" : "已清除本机访问码。");
  }

  $("aiCompanionStartBtn")?.addEventListener("click", start);
  $("aiCompanionStopBtn")?.addEventListener("click", () => stop());
  $("aiCompanionSaveTokenBtn")?.addEventListener("click", saveAccessToken);
  window.addEventListener("training-tracker:companion-updated", renderToday);
  window.addEventListener("training-tracker:timer-finished", () => {
    if(!connected) return;
    send({
      type:"conversation.item.create",
      item:{ type:"message", role:"user", content:[{ type:"input_text", text:"[系统事件] 休息倒计时已经结束。请用一句简短中文提醒并鼓励我开始下一组。" }] }
    });
    send({ type:"response.create" });
  });
  window.addEventListener("beforeunload", () => stop(""));
  renderToday();
})();
