"use client";

import { useEffect, useState } from "react";
import { isSaved, toggleSaved, type SavedPark } from "@/lib/saved";

export default function SaveButton({ park }: { park: SavedPark }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isSaved(park.parkCode));
  }, [park.parkCode]);

  return (
    <button
      type="button"
      className="rounded-full border border-pine px-4 py-2 text-sm font-bold text-pine focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine"
      aria-pressed={saved}
      onClick={() => setSaved(toggleSaved(park))}
    >
      {saved ? "Saved on this device" : "Save park"}
    </button>
  );
}
