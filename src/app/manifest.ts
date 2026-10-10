import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

/** Lets a phone install Tavi to the home screen: free, no store, no service worker needed. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.name,
    description: brand.description,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f8f8fb",
    theme_color: brand.emailColors.accent,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
