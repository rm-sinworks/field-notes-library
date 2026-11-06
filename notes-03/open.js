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
    const revisions = {page:'577326e7e8577e5b', paper:'3fa93a06cbc02809'};
    async function openFile(kind, signal) {
      const reply = await fetch(`./${kind}.dat?v=${revisions[kind]}`, {credentials:'omit', referrerPolicy:'no-referrer', cache:'no-cache', signal});
      if (!reply.ok) throw new Error('File unavailable');
      const bytes = new Uint8Array(await reply.arrayBuffer());
      const aad = new TextEncoder().encode(`notes-03:${kind}:v1`);
      return crypto.subtle.decrypt({name:'AES-GCM', iv:bytes.subarray(0,12), additionalData:aad}, key, bytes.subarray(12));
    }
    const contents = new TextDecoder().decode(await openFile('page'));
    // The guide receives no key or same-origin permission. Run only the UI
    // whose exact bytes were pinned from the reviewed source at build time.
    const doc = new DOMParser().parseFromString(contents, 'text/html');
    const scripts = [...doc.querySelectorAll('script')];
    const approved = scripts.find(node => node.id === 'field-guide-ui' && !node.hasAttribute('src'));
    if (scripts.length !== 1 || !approved) throw new Error('Unrecognized guide program');
    const program = approved.textContent;
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(program)));
    const pin = 'sha256-ayZOF3UPRrYRws742bzeZGR3YwEzlhc9rVwQe/9EenU=';
    if ('sha256-' + btoa(String.fromCharCode(...hash)) !== pin) throw new Error('Guide viewer version mismatch');
    for (const script of doc.querySelectorAll('script')) script.remove();
    const noReferrer = doc.createElement('meta');
    noReferrer.name = 'referrer'; noReferrer.content = 'no-referrer';
    doc.head.prepend(noReferrer);
    const policy = doc.createElement('meta');
    policy.httpEquiv = 'Content-Security-Policy';
    policy.content = "default-src 'none'; script-src '" + pin + "'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";
    doc.head.prepend(policy);
    const script = doc.createElement('script');
    script.id = 'field-guide-ui'; script.textContent = program;
    doc.body.append(script);
    for (const link of doc.querySelectorAll('a[href]')) {
      if (/^https?:\/\//i.test(link.getAttribute('href'))) {
        link.target = '_blank'; link.rel = 'noopener noreferrer';
      }
    }
    frame.src = URL.createObjectURL(new Blob(['<!doctype html>', doc.documentElement.outerHTML], {type:'text/html;charset=utf-8'}));
    document.querySelector('#locked').hidden = true;
    frame.hidden = false; document.querySelector('#actions').hidden = false;
    const prepare = document.querySelector('#prepare-pdf'), status = document.querySelector('#pdf-status');
    prepare.addEventListener('click', async () => {
      if (prepare.disabled) return;
      prepare.disabled = true;
      prepare.textContent = 'Preparing PDF…';
      status.textContent = '';
      const controller = new AbortController();
      // The printable maps can take several minutes on a slow mobile link.
      const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000);
      try {
        const pdf = await openFile('paper', controller.signal);
        const href = URL.createObjectURL(new Blob([pdf], {type:'application/pdf'}));
        for (const link of document.querySelectorAll('#open-pdf, #save-pdf')) {
          link.href = href; link.hidden = false;
        }
        // Real links preserve a fresh user gesture in Safari even after a long fetch.
        prepare.hidden = true;
        status.textContent = 'PDF ready.';
        if (document.activeElement === prepare || document.activeElement === document.body) {
          document.querySelector('#open-pdf').focus({preventScroll:true});
        }
      } catch {
        status.textContent = 'Couldn’t load the PDF.';
        prepare.textContent = 'Retry PDF';
        prepare.disabled = false;
      } finally {
        clearTimeout(timeout);
      }
    });
  } catch {
    message.textContent = 'This private guide could not be opened. Check that you copied the full link.';
  }
})();
