// Tiny DOM helpers. Text always goes in as text nodes, never as HTML.
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);

// Segmented single-choice control. Returns { el, get, set }.
export function segmented(name, options, value, onChange) {
  let cur = value;
  const btns = options.map(([v, label]) => h('button', { type: 'button', 'aria-pressed': String(v === cur), onclick: () => set(v, true) }, label));
  const el = h('div', { class: 'seg', role: 'group', 'aria-label': name }, btns);
  function set(v, fire) {
    cur = v;
    btns.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i][0] === v)));
    if (fire && onChange) onChange(v);
  }
  return { el, get: () => cur, set };
}

export function numberInput(id, value, attrs = {}) {
  return h('input', { id, type: 'number', inputmode: 'decimal', step: 'any', value: value ?? '', ...attrs });
}

export const num = el => (el.value === '' ? null : Number(el.value));
export const list = el => el.value.split(/[\s,]+/).filter(Boolean).map(Number).filter(Number.isFinite);

export function toast(text) {
  const t = h('div', { class: 'toast', role: 'status' }, text);
  document.body.append(t);
  setTimeout(() => t.remove(), 2200);
}

export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};
