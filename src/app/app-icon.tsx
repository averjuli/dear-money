import { ImageResponse } from "next/og";

/** Square app icon: accent background with a coin-like «d». */
export function renderAppIcon(size: number) {
  const coin = Math.round(size * 0.56);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1B6B4D",
      }}
    >
      <div
        style={{
          width: coin,
          height: coin,
          borderRadius: "50%",
          background: "#DCEBE3",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#14523B",
          fontSize: Math.round(size * 0.36),
          fontWeight: 700,
        }}
      >
        d
      </div>
    </div>,
    { width: size, height: size },
  );
}
