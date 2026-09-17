import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#dce6ff",
          200: "#b8ccff",
          300: "#8aa9ff",
          400: "#5c7fff",
          500: "#3855f5",
          600: "#2a3fd1",
          700: "#2431a6",
          800: "#212a80",
          900: "#1d2566",
        },
        // HeyDay 팔레트.
        // 따뜻하되 '노인 서비스'로 보이지 않아야 한다(PRD 15장).
        // 그래서 병원의 파랑도, AI 서비스의 보라 그라데이션도 쓰지 않고
        // 햇빛에 가까운 주황 계열을 주색으로 둔다.
        heyday: {
          50: "#FFF5F0",
          100: "#FFE7DA",
          200: "#FFC9AF",
          300: "#FFA982",
          400: "#F9835A",
          500: "#EF6237",
          600: "#D74C23",
          700: "#B03C1B",
          800: "#8A3018",
          900: "#682616",
        },
        // 바탕은 순백 대신 미색. 큰 글씨를 오래 봐도 덜 피로하다.
        sand: {
          50: "#FDFAF6",
          100: "#F7F1E8",
          200: "#EFE5D7",
          300: "#E2D4C0",
          400: "#CDBBA2",
        },
        ink: {
          900: "#1C1A17",
          700: "#3C3630",
          500: "#6B6157",
          400: "#8D8377",
        },
        leaf: {
          50: "#EEF6F0",
          500: "#2E7D5B",
          700: "#1F5E44",
        },
      },
    },
  },
  plugins: [],
};
export default config;
