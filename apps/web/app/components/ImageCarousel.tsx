"use client";
import { useEffect, useState } from "react";

const images = [
  "/images/stadium_illustration.svg",
  "/images/trophy_banner.svg",
  "/images/bb_dice_sides.png",
  "/images/blocking_dice/pow.png",
];

export default function ImageCarousel() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % images.length), 3500);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow">
      <img src={images[idx]} alt="carousel" className="w-full h-64 object-contain bg-gray-50" />
      <div className="absolute bottom-2 right-3 flex gap-1">
        {images.map((_, i) => (
          <span key={i} className={`h-2 w-2 rounded-full ${i === idx ? "bg-gray-800" : "bg-gray-300"}`} />
        ))}
      </div>
    </div>
  );
}
