import type { MetadataRoute } from "next"

/**
 * PWA-manifestet: sandkassen på heimeskjermen. Merket er VAFFEL sjølv —
 * rutenettet, bogane og beina i AHO-oransjen. Kvit botn, som sida:
 * objektet er lyst finér med hard skugge på kvitt papir.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "50 × 50 × 50",
    short_name: "50×50×50",
    description:
      "Eit parametrisk sitjemøbel i ein kube på 500 mm. Still krakken etter brukaren, sjå lasta på flata, få kuttlista med minst svinn.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/ikon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/ikon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/ikon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
