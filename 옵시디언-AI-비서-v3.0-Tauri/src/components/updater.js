// 자동 업데이트 체크
//
// 앱 시작 후 잠깐 뒤에 GitHub Releases에서 latest.json을 확인하고
// 새 버전이 있으면 사용자에게 업데이트 알림 모달을 보여줌.

const { check } = window.__TAURI__.updater;
const { ask } = window.__TAURI__.dialog;
const { relaunch } = window.__TAURI__.process;

export async function initUpdater(showToast) {
  setTimeout(async () => {
    try {
      const update = await check();
      if (!update?.available) return;

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
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            totalBytes = event.data.contentLength || 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength || 0;
            if (totalBytes > 0) {
              const pct = Math.round((downloaded / totalBytes) * 100);
              showToast?.('다운로드 ' + pct + '%', 'info', 5000);
            }
            break;
          case 'Finished':
            showToast?.('다운로드 완료. 잠시 후 재시작합니다...', 'success');
            break;
        }
      });
      await relaunch();
    } catch (e) {
      console.warn('Update check failed:', e);
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
    showToast?.('새 버전 v' + update.version + ' 사용 가능', 'info', 8000);
  } catch (e) {
    showToast?.('업데이트 확인 실패: ' + (e.message || e), 'error');
  }
}
