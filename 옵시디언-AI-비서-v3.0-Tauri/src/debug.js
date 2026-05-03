// v3.1.8 standalone debug module — no dependencies on app.js or updater.js

setTimeout(async () => {
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:120px;left:0;right:0;background:#7c3aed;color:#fff;padding:14px 20px;font-size:14px;font-weight:600;z-index:2147483647;text-align:center;font-family:sans-serif;';
  banner.textContent = '[양모듈 JS] debug.js 모듈 로드됨 - window.__TAURI__: ' + (typeof window.__TAURI__);
  document.body.appendChild(banner);

  if (window.__TAURI__?.dialog?.message) {
    try {
      await window.__TAURI__.dialog.message('debug.js 모듈이 native dialog 호출을 성공했습니다!', { title: 'v3.1.8 DEBUG', kind: 'info' });
      const ok = document.createElement('div');
      ok.style.cssText = 'position:fixed;top:170px;left:0;right:0;background:#0891b2;color:#fff;padding:14px 20px;font-size:14px;font-weight:600;z-index:2147483647;text-align:center;font-family:sans-serif;';
      ok.textContent = '[native] dialog 호출 성공';
      document.body.appendChild(ok);
    } catch (e) {
      const err = document.createElement('div');
      err.style.cssText = 'position:fixed;top:170px;left:0;right:0;background:#ea580c;color:#fff;padding:14px 20px;font-size:14px;font-weight:600;z-index:2147483647;text-align:center;font-family:sans-serif;';
      err.textContent = '[native ERROR] ' + (e.message || e);
      document.body.appendChild(err);
    }
  } else {
    const err = document.createElement('div');
    err.style.cssText = 'position:fixed;top:170px;left:0;right:0;background:#ea580c;color:#fff;padding:14px 20px;font-size:14px;font-weight:600;z-index:2147483647;text-align:center;font-family:sans-serif;';
    err.textContent = '[에러] window.__TAURI__.dialog.message 없음! Tauri 노출 실패';
    document.body.appendChild(err);
  }
}, 2000);
