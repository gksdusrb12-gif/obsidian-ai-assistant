const { check } = window.__TAURI__.updater;
const { ask } = window.__TAURI__.dialog;
const { relaunch } = window.__TAURI__.process;

export async function initUpdater(showToast) {
  setTimeout(async () => {
    try {
      const update = await check();
      if (!update?.available) return;

      const wantToInstall = await ask(
        `새 버전이 나왔어요!\n\n현재: v${update.currentVersion}\n최신: v${update.version}\n\n${update.body || ''}\n\n지금 업데이트할까요? (앱이 자동으로 다시 시작됩니다)`,
        {
          title: '옵시디언 AI 비서 업데이트',
          kind: 'info',
          okLabel: '업데이트',
          cancelLabel: '나중에',
        }
      );
      if (!wantToInstall) return;

      showToast?.('업데이트 다운로드 중...', 'info', 30000);
      await update.downloadAndInstall();
      await relaunch();
    } catch (e) {
      console.warn('Update check failed:', e);
    }
  }, 5000);
}
