# 옵시디언 AI 비서 v3.0

![버전](https://img.shields.io/badge/버전-v3.0.0-38BDF8?style=flat-square)
![Tauri](https://img.shields.io/badge/Tauri-v2-F59E0B?style=flat-square)
![플랫폼](https://img.shields.io/badge/플랫폼-Windows%20%7C%20macOS-22C55E?style=flat-square)
![라이선스](https://img.shields.io/badge/라이선스-MIT-94A3B8?style=flat-square)

Gemini · GPT · Claude 세 AI를 하나의 **네이티브 데스크톱 앱**에서 사용해 파일, 음성, 웹, 메모를 **옵시디언 마크다운 노트**로 자동 변환해주는 로컬 AI 비서입니다.

v3.0부터는 Python 서버 없이 **Tauri v2 + Rust**로 완전히 네이티브 앱으로 재작성되었습니다.

---

## 다운로드 (지금 바로)

GitHub Releases 페이지에서 본인 OS에 맞는 파일을 받아 설치하세요.

| 운영체제 | 다운로드 파일 |
|---------|------------|
| Windows 10/11 | `옵시디언.AI.비서_3.0.0_x64-setup.exe` |
| macOS (M1/M2/M3/Intel) | `옵시디언.AI.비서_3.0.0_universal.dmg` |

> Releases 페이지는 이 저장소 오른쪽 사이드바 **"Releases"** 링크를 클릭하세요.

<!-- 스크린샷 자리 -->
<!-- ![앱 메인 화면](assets/screenshot-main.png) -->
<!-- ![설정 화면](assets/screenshot-settings.png) -->

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| 3개 AI 제공자 | Gemini 5종 · OpenAI 6종 · Claude 5종, 총 16개 모델 |
| 파일/이미지/코드 분석 | 이미지, 텍스트, 코드 파일 업로드 → AI 분석 |
| 음성 파일 분석 | .mp3/.wav/.m4a 등 — Gemini/GPT 전용 |
| 웹사이트 요약 | URL 입력 → 핵심 내용 마크다운 노트로 변환 |
| 직접 메모 정리 | 자유 텍스트 → 구조화된 노트 생성 |
| RAG (기존 지식 연결) | 옵시디언 vault의 기존 노트를 AI 컨텍스트로 활용 |
| 네이티브 성능 | Python/Electron 없이 Rust 백엔드로 빠르고 가볍게 실행 |

---

## 문서

| 문서 | 대상 |
|------|------|
| [사용설명서](tauri-docs/사용설명서.md) | 일반 사용자 — 설치부터 사용법, 문제 해결까지 |
| [빌드방법](tauri-docs/빌드방법.md) | GitHub Actions 자동 빌드 + 로컬 빌드 방법 |

---

## v3.0에서 바뀐 것

- **네이티브 앱으로 전환** — Python 서버, 터미널 창, 가상환경 완전 제거. Tauri v2 + Rust로 재작성
- **단일 실행 파일** — .exe 하나로 설치, 의존성 없음
- **GitHub Actions 자동 빌드** — 태그 push 한 번으로 Windows(.exe/.msi) + macOS(.dmg) 자동 생성
- **향상된 보안** — Tauri CSP 및 허용된 API 도메인만 통신
- **음성 파일 지원 개선** — 네이티브 파일 선택 대화상자로 대용량 음성 파일도 안정적 처리

---

## 시스템 요구사항

| 항목 | 요구사항 |
|-----|---------|
| Windows | 10 / 11 (64비트) |
| macOS | 12 Monterey 이상 |
| 인터넷 | AI API 호출용 필요 |
| 옵시디언 | 선택 (노트 저장 기능 사용 시) |

Python, Node.js, Rust 등 별도 설치 불필요.

---

## 빌드 현황

이 저장소에는 GitHub Actions 워크플로우(`.github/workflows/release.yml`)가 설정되어 있습니다.  
`v*.*.*` 형태의 태그를 push하면 자동으로 빌드가 시작됩니다.

자세한 빌드 방법은 [tauri-docs/빌드방법.md](tauri-docs/빌드방법.md) 참조.

---

## 라이선스

MIT License — 자유롭게 사용, 수정, 배포하실 수 있습니다.
