import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "냉이랑 루틴",
    short_name: "냉이랑 루틴",
    description: "개인 맞춤 다이어트 루틴 트래커",
    start_url: "/",
    display: "standalone",
    background_color: "#19b7e9",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png"
      }
    ]
  };
}
