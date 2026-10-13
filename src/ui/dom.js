// 小さな DOM 道具：要素を作る・トースト・外側クリックと Esc で閉じる・ボトムシート

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && k !== 'style' && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function dia(cls = '') {
  return h('span', { class: `dia ${cls}`, 'aria-hidden': 'true' });
}

export function toast(message, kind = 'ok') {
  const box = document.getElementById('toast');
  const t = h('div', { class: `toast ${kind === 'err' ? 'err' : ''}` }, dia(kind === 'err' ? '' : 'gold sm'), message);
  box.append(t);
  setTimeout(() => t.remove(), kind === 'err' ? 4000 : 2200);
}

/** 外側クリック（pointerdown を capture で拾う）と Esc で onClose。戻り値は解除関数。 */
export function useDismiss(el, onClose) {
  const onPointer = (e) => { if (!el.contains(e.target)) onClose(); };
  const onKey = (e) => { if (e.key === 'Escape') onClose(); };
  setTimeout(() => {
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey);
  }, 0);
  return () => {
    document.removeEventListener('pointerdown', onPointer, true);
    document.removeEventListener('keydown', onKey);
  };
}

/** ボトムシート。content(close) が中身を返す。 */
export function sheet(title, content) {
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
  const back = h('div', { class: 'sheet-back' }, panel);
  let off = () => {};
  const close = () => { off(); back.remove(); };
  if (title) panel.append(h('h2', {}, dia('gold'), title));
  append(panel, [content(close)]);
  document.body.append(back);
  off = useDismiss(panel, close);
  const first = panel.querySelector('button, input');
  if (first) first.focus();
  return close;
}

export function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n) => String(n).padStart(2, '0');
  return hh > 0 ? `${hh}:${p(mm)}:${p(ss)}` : `${p(mm)}:${p(ss)}`;
}

export function fmtTime(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
