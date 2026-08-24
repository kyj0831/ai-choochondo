# ai-choochondo — 컨테이너 이미지 (Render / Fly.io / 일반 도커 호스트용)
#
# Railway는 nixpacks.toml로 자동 빌드되므로 이 파일이 없어도 된다.
# 이 Dockerfile은 도커 이미지를 직접 받는 호스트(Render, Fly.io, Cloud Run,
# 자체 VPS 등)에서 동일한 환경으로 배포하기 위한 것이다.
#
# 필요한 시스템 패키지:
#   chromium        PDF 결과지(puppeteer)용 브라우저
#   fonts-noto-cjk  한글 폰트. 없으면 PDF의 한글이 두부(□)로 나온다
#   python3/make/g++  better-sqlite3 네이티브 빌드용
#
# SQLite 데이터는 /data 볼륨에 저장한다(DATA_DIR). 볼륨을 안 붙이면
# 재배포 때 진단 데이터가 사라진다.

FROM node:22-bookworm-slim

# 1) 시스템 패키지
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-noto-cjk \
      python3 \
      make \
      g++ \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    DATA_DIR=/data \
    PORT=3000

WORKDIR /app

# 2) 의존성 설치 (puppeteer는 .puppeteerrc.cjs의 skipDownload로 브라우저를 안 받음)
COPY package.json package-lock.json .puppeteerrc.cjs ./
RUN npm ci

# 3) 소스 복사 후 프로덕션 빌드
COPY . .
RUN npm run build

# 4) SQLite 영구 저장 위치
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000

# 5) 실행 (next start, PORT 환경변수를 따른다)
CMD ["npm", "run", "start"]
