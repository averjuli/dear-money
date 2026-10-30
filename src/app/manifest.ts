import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dear Money",
    short_name: "Dear Money",
    description: "Накопления по методу конвертов",
    start_url: "/",
    display: "standalone",
    background_color: "#edf1ee",
    theme_color: "#edf1ee",
    lang: "ru",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
