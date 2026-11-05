'use strict';
(async function openNote() {
  const token = location.hash.slice(1);
  window.addEventListener('hashchange', () => { if (location.hash.slice(1) !== token) location.reload(); });
  if (!/^[\w-]{43}$/.test(token)) return;

  const message = document.querySelector('#message');
  const frame = document.querySelector('#document');
  try {
    message.textContent = 'Opening guide…';
    const raw = Uint8Array.from(atob(token.replace(/-/g, '+').replace(/_/g, '/') + '='), ch => ch.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    async function openFile(kind) {
      const reply = await fetch(`./${kind}.dat`, {credentials:'omit', referrerPolicy:'no-referrer', cache:'no-cache'});
      if (!reply.ok) throw new Error('File unavailable');
      const bytes = new Uint8Array(await reply.arrayBuffer());
      const aad = new TextEncoder().encode(`notes-02:${kind}:v1`);
      return crypto.subtle.decrypt({name:'AES-GCM', iv:bytes.subarray(0,12), additionalData:aad}, key, bytes.subarray(12));
    }
    const contents = new TextDecoder().decode(await openFile('page'));
    // The sandbox gives the guide an opaque origin. Its only allowed script
    // scrolls the in-document links in place without changing the share URL.
    const doc = new DOMParser().parseFromString(contents, 'text/html');
    for (const script of doc.querySelectorAll('script')) script.remove();
    const noReferrer = doc.createElement('meta');
    noReferrer.name = 'referrer'; noReferrer.content = 'no-referrer';
    doc.head.prepend(noReferrer);
    const policy = doc.createElement('meta');
    policy.httpEquiv = 'Content-Security-Policy';
    policy.content = "default-src 'none'; script-src 'sha256-7i/DL0rieeOyRgoMxLq13Mk2rjThrXXlEVR2fjTNi6E='; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";
    doc.head.prepend(policy);
    const scroll = doc.createElement('script');
    scroll.textContent = `document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(!a)return;const section=document.getElementById(a.getAttribute('href').slice(1));if(!section)return;e.preventDefault();section.scrollIntoView();});`;
    doc.body.append(scroll);
    for (const link of doc.querySelectorAll('a[href]')) {
      if (/^https?:\/\//i.test(link.getAttribute('href'))) {
        link.target = '_blank'; link.rel = 'noopener noreferrer';
      }
    }
    frame.src = URL.createObjectURL(new Blob(['<!doctype html>', doc.documentElement.outerHTML], {type:'text/html;charset=utf-8'}));
    document.querySelector('#locked').hidden = true;
    frame.hidden = false; document.querySelector('#actions').hidden = false;
    try {
      const pdf = await openFile('paper');
      const href = URL.createObjectURL(new Blob([pdf], {type:'application/pdf'}));
      for (const link of document.querySelectorAll('#open-pdf, #save-pdf')) {
        link.href = href; link.hidden = false;
      }
      document.querySelector('#pdf-status').hidden = true;
    } catch {
      document.querySelector('#pdf-status').textContent = 'PDF unavailable. Reload to try again.';
    }
  } catch {
    message.textContent = 'This private guide could not be opened. Check that you copied the full link.';
  }
})();
