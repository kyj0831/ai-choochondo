/**
 * Mate 아바타.
 *
 * 스톡 사진 대신 일러스트를 쓴다. 실존하지 않는 목 데이터에 진짜 사람 사진을
 * 붙이면 검증 과정에서 사용자를 속이게 된다. 일러스트는 "샘플"임을 드러내면서도
 * 사람마다 다른 인상을 준다.
 */

const PALETTE = [
  { bg: "#FFE3D3", skin: "#F3C6A5", hair: "#2E2A26", cloth: "#2F6F63" },
  { bg: "#E6EFE4", skin: "#E8B88E", hair: "#1F1B18", cloth: "#C2542E" },
  { bg: "#FDE8CF", skin: "#F6D2B3", hair: "#4A3524", cloth: "#33518A" },
  { bg: "#E9E6F7", skin: "#E5AF87", hair: "#241F1C", cloth: "#B8474F" },
  { bg: "#DFECF3", skin: "#D9A57C", hair: "#332B22", cloth: "#3C6B45" },
  { bg: "#FBE4E4", skin: "#F1C9A8", hair: "#5A3B26", cloth: "#7A4FA3" },
  { bg: "#E8EEDC", skin: "#C9926A", hair: "#211C18", cloth: "#C77B2B" },
  { bg: "#FFF0D6", skin: "#F4CDA9", hair: "#3A2A1F", cloth: "#2C6E8F" },
];

function Hair({ variant, color }: { variant: number; color: string }) {
  const cap = <path d="M27 42a21 21 0 0 1 42 0c1-17-8-26-21-26S26 25 27 42z" fill={color} />;
  switch (variant % 8) {
    case 0: // 단발
      return (
        <g fill={color}>
          {cap}
          <path d="M26 40h5v22h-5zM65 40h5v22h-5z" />
        </g>
      );
    case 1: // 짧은 머리
      return cap;
    case 2: // 묶은 머리
      return (
        <g fill={color}>
          {cap}
          <circle cx="48" cy="17" r="8" />
        </g>
      );
    case 3: // 긴 머리
      return (
        <g fill={color}>
          {cap}
          <path d="M25 40h6v32h-6zM65 40h6v32h-6z" />
        </g>
      );
    case 4: // 곱슬
      return (
        <g fill={color}>
          {cap}
          <circle cx="32" cy="30" r="8" />
          <circle cx="48" cy="24" r="9" />
          <circle cx="64" cy="30" r="8" />
        </g>
      );
    case 5: // 옆 가르마
      return (
        <g fill={color}>
          {cap}
          <path d="M28 34c6-10 26-14 40-6-4-10-14-14-22-14-11 0-18 8-18 20z" />
        </g>
      );
    case 6: // 모자
      return (
        <g fill={color}>
          <path d="M28 40a20 20 0 0 1 40 0z" />
          <rect x="22" y="38" width="52" height="5" rx="2.5" />
        </g>
      );
    default: // 포니테일
      return (
        <g fill={color}>
          {cap}
          <path d="M66 36c8 2 12 10 10 20-1 5-5 8-9 7 3-9 2-19-1-27z" />
        </g>
      );
  }
}

export default function Avatar({
  variant,
  size = 64,
  glasses = false,
}: {
  variant: number;
  size?: number;
  glasses?: boolean;
}) {
  const c = PALETTE[variant % PALETTE.length];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      role="img"
      aria-label="메이트 사진"
      className="shrink-0"
    >
      <defs>
        {/* 어깨 모양이 둥근 모서리 밖으로 삐져나오지 않도록 잘라낸다. */}
        <clipPath id="hd-avatar-clip">
          <rect width="96" height="96" rx="28" />
        </clipPath>
      </defs>
      <g clipPath="url(#hd-avatar-clip)">
        <rect width="96" height="96" rx="28" fill={c.bg} />
        <path d="M14 96c0-18 15-28 34-28s34 10 34 28z" fill={c.cloth} />
      </g>
      <circle cx="48" cy="44" r="21" fill={c.skin} />
      <Hair variant={variant} color={c.hair} />
      <circle cx="41" cy="45" r="2.2" fill="#2B2320" />
      <circle cx="55" cy="45" r="2.2" fill="#2B2320" />
      <path
        d="M43 54c3 2.5 7 2.5 10 0"
        stroke="#2B2320"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {(glasses || variant % 3 === 0) && (
        <g stroke="#2B2320" strokeWidth="1.8" fill="none" opacity="0.75">
          <circle cx="41" cy="45" r="7" />
          <circle cx="55" cy="45" r="7" />
          <path d="M48 45h0.5M27 43h7M62 43h7" />
        </g>
      )}
    </svg>
  );
}
