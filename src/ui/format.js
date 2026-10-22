// 金額格式：兩位小數、千分位（與參考站相同）。
export const fmt = (n) => (Math.floor(n * 100 + 1e-6) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtX = (x) => `×${x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)}`;
export const el = (tag, className = '', html = '') => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html) e.innerHTML = html;
  return e;
};
