// 자동 업데이트 체크 (v3.1.5: 디버그 toast 추가)

const { check } = window.__TAURI__.updater;
const { ask } = window.__TAURI__.dialog;
const { relaunch } = window.__TAURI__.process;

export async function initUpdater(showToast) {
  const dbg = (msg, type = 'info', duration = 6000) => {
    try { showToast?.('[업데이트] ' + msg, type, duration); } catch {}
    try { console.log('[updater]', msg); } catch {}
  };

  setTimeout(async () => {
    dbg('업데이트 확인 중...', 'info', 4000);
    let update;
    try {
      update = await check();
    } catch (e) {
      const msg = (e && (e.message || e.toString())) || String(e);
      dbg('체크 실패: ' + msg.slice(0, 200), 'error', 15000);
      console.warn('Update check failed:', e);
      return;
    }

    if (!update) {
      dbg('check() 결과가 null — 응답 없음', 'warning', 10000);
      return;
    }

    if (!update.available) {
      dbg('이미 최신 버전 (현재: v' + update.currentVersion + ')', 'success', 5000);
      return;
    }

    dbg('새 버전 발견! 현재 v' + update.currentVersion + ' → 최신 v' + update.version, 'success', 8000);

    const wantToInstall = await ask(
      `새 버전이 나왔어요!\n\n` +
      `현재: v${update.currentVersion}\n` +
      `최신: v${update.version}\n\n` +
      `${update.body || ''}\n\n` +
      `지금 업데이트할까요? (앱이 자동으로 다시 시작됩니다)`,
      {
        title: '옵시디언 AI 비서 업데이트',
        kind: 'info',
        okLabel: '업데이트',
        cancelLabel: '나중에',
      }
    );

    if (!wantToInstall) {
      showToast?.('업데이트는 다음에 안내해드릴게요.', 'info');
      return;
    }

    showToast?.('업데이트 다운로드 중...', 'info', 30000);

    let downloaded = 0;
    let totalBytes = 0;
    try {
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            totalBytes = event.data.contentLength || 0;
            dbg('다운로드 시작 (' + Math.round(totalBytes / 1024) + ' KB)', 'info', 5000);
            break;
          case 'Progress':
            downloaded += event.data.chunkLength || 0;
            if (totalBytes > 0) {
              const pct = Math.round((downloaded / totalBytes) * 100);
              showToast?.(`다운로드 ${pct}%`, 'info', 5000);
            }
            break;
          case 'Finished':
            showToast?.('다운로드 완료. 잠시 후 재시작합니다...', 'success');
            break;
        }
      });
      await relaunch();
    } catch (e) {
      const msg = (e && (e.message || e.toString())) || String(e);
      dbg('다운로드/설치 실패: ' + msg.slice(0, 200), 'error', 15000);
      console.warn('Update install failed:', e);
    }
  }, 5000);
}

export async function checkNow(showToast) {
  try {
    const update = await check();
    if (!update?.available) {
      showToast?.('이미 최신 버전이에요.', 'success');
      return;
    }
    showToast?.(`새 버전 v${update.version} 사용 가능`, 'info', 8000);
  } catch (e) {
    showToast?.(`업데이트 확인 실패: ${e.message || e}`, 'error');
  }
}
