/* Mi Reseller Program — ImgBB upload helper
   Uploads a File/Blob to ImgBB and returns { url, thumbUrl, deleteUrl } */
import { IMGBB_KEY, IMGBB_URL } from './config.js';

export function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = () => rej(new Error('Read failed'));
    r.readAsDataURL(file);
  });
}

/**
 * Upload an image file to ImgBB.
 * @param {File} file
 * @param {(pct:number)=>void} [onProgress]
 * @returns {Promise<{url:string, thumbUrl:string, deleteUrl:string}>}
 */
export async function uploadToImgBB(file, onProgress) {
  if (!file) throw new Error('No file provided');
  if (!file.type?.startsWith('image/')) throw new Error('Sirf image files allowed hain');
  if (file.size > 32 * 1024 * 1024) throw new Error('Image 32MB se choti honi chahiye');

  const base64 = await fileToBase64(file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('key', IMGBB_KEY);
    form.append('image', base64);

    xhr.open('POST', IMGBB_URL, true);
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (data.success) {
          resolve({
            url: data.data.url,
            thumbUrl: data.data.thumb?.url || data.data.url,
            deleteUrl: data.data.delete_url
          });
        } else {
          reject(new Error(data.error?.message || 'Upload fail ho gaya'));
        }
      } catch (e) {
        reject(new Error('Upload response parse nahi hui'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error — upload fail'));
    xhr.send(form);
  });
}

/**
 * Wire up an .img-up element: click to pick file, shows preview + progress bar, calls onDone(url) when finished.
 * @param {HTMLElement} el - the .img-up container
 * @param {(url:string)=>void} onDone
 * @param {string} [existingUrl]
 */
export function wireImageUpload(el, onDone, existingUrl) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
  el.appendChild(input);

  let img = el.querySelector('img');
  if (!img && existingUrl) {
    img = document.createElement('img'); img.src = existingUrl; el.appendChild(img);
  }
  let prog = el.querySelector('.up-prog');
  if (!prog) { prog = document.createElement('div'); prog.className = 'up-prog'; el.appendChild(prog); }
  let label = el.querySelector('.up-label');

  el.addEventListener('click', (e) => { if (e.target !== input) input.click(); });

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    playSound?.('click');
    const localUrl = URL.createObjectURL(file);
    if (!img) { img = document.createElement('img'); el.appendChild(img); }
    img.src = localUrl;
    if (label) label.style.display = 'none';
    prog.style.width = '0%';
    try {
      const result = await uploadToImgBB(file, (pct) => { prog.style.width = pct + '%'; });
      prog.style.width = '100%';
      playSound?.('upload');
      window.showToast?.('✅ Image upload ho gayi', 'ok', 1800);
      onDone(result.url);
      setTimeout(() => { prog.style.width = '0%'; }, 600);
    } catch (err) {
      window.showToast?.('❌ ' + err.message, 'err', 2500);
      prog.style.width = '0%';
    }
  });
}
