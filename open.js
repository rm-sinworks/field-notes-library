"use strict";
(async function openLink(){
  const getKey = () => location.hash.slice(1).split("/")[0];
  const encoded = getKey();
  window.addEventListener("hashchange", () => { if (getKey() !== encoded) location.reload(); });
  if (!/^[a-zA-Z0-9_-]{43}$/.test(encoded)) return;
  const message = document.getElementById("message");
  try {
    message.textContent = "Opening your link…";
    const rawKey = Uint8Array.from(atob(encoded.replace(/-/g, "+").replace(/_/g, "/") + "="), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
    const response = await fetch("./content.bin", {credentials:"omit", referrerPolicy:"no-referrer", cache:"no-cache"});
    if (!response.ok) throw Error();
    const bytes = new Uint8Array(await response.arrayBuffer());
    const opened = await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes.subarray(0,12)},key,bytes.subarray(12));
    const size = new DataView(opened).getUint32(0);
    const decoder = new TextDecoder(); 
    const manifest = JSON.parse(decoder.decode(new Uint8Array(opened,4,size)));
    let offset=4+size;
    const docs=Object.create(null);
    const urls=Object.create(null);
    for(const {name,type,length} of manifest){
      const data=new Uint8Array(opened,offset,length);
      offset+=length;
      if(name==="document") docs.html=decoder.decode(data);
      else urls[name]=URL.createObjectURL(new Blob([data],{type}));
    }
    if(offset!==opened.byteLength) throw Error();
    const [,stage,flag,values]=location.hash.slice(1).split("/");
    const carry=flag==="carry"?(values||"").split(",").filter(value=>/^[a-z0-9-]{1,48}$/.test(value)).slice(0,64):[];
    if(flag==="carry")history.replaceState(null,"","#"+encoded+"/"+(stage||""));
    window.privatePage=Object.freeze({
      file:name=>urls[name],
      go:id=>"#"+encoded+"/"+id,
      step:()=>location.hash.slice(1).split("/")[1]||"",
      carry
    });
    // Only use markup and script whose GCM authentication just succeeded.
    const template=document.createElement("template");template.innerHTML=docs.html;
    const css=document.createElement("link");css.rel="stylesheet";css.href=urls.style;
    document.head.append(css);
    document.body.replaceChildren(template.content);
    const app=document.createElement("script");app.src=urls.program;document.body.append(app);
  } catch {
    message.textContent="This private link could not be opened. Check that you copied the full link.";
  }
})();
