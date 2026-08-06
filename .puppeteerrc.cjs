/**
 * puppeteer 설정.
 *
 * 설치 시 브라우저를 내려받지 않는다. 배포 이미지에는 apt로 설치한
 * 시스템 chromium을 쓰고(nixpacks.toml 참조), 로컬 개발에서는
 * `npx puppeteer browsers install chrome`으로 한 번만 받으면 된다.
 *
 * 환경변수(PUPPETEER_SKIP_DOWNLOAD) 대신 이 파일을 쓰는 이유:
 * 빌드 단계의 환경변수는 플랫폼마다 주입 시점이 달라 npm install 중에
 * 적용되지 않을 수 있다. 이 파일은 puppeteer가 항상 직접 읽는다.
 */
module.exports = {
  skipDownload: true,
};
