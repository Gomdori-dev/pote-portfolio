export type PlaylistKey = "rain" | "city" | "afterglow" | "coffee" | "sunday" | "snow" | "jazzBar" | "festival" | "homeCafe" | "nightRun" | "digitalDetox" | "soloTrip" | "vinylShop" | "midnightSnack" | "bookAfternoon" | "campfire";
type PlaylistLabel = "playlistRain" | "playlistCity" | "playlistAfterglow" | "playlistCoffee" | "playlistSunday" | "playlistSnow" | "playlistJazzBar" | "playlistFestival" | "playlistHomeCafe" | "playlistNightRun" | "playlistDigitalDetox" | "playlistSoloTrip" | "playlistVinylShop" | "playlistMidnightSnack" | "playlistBookAfternoon" | "playlistCampfire";

// A wider pool than what's shown at once — see the note by the copy in
// gallery-copy.ts. Three of these are picked at random per page load
// (PICK_COUNT below) instead of always showing the same three tabs.
// Each playlist's 3 works are hand-picked and used by no other playlist —
// selecting any tab always surfaces a set you haven't already seen under a
// different mood.
export const ALL_PLAYLISTS: { key: PlaylistKey; label: PlaylistLabel; slugs: string[] }[] = [
  { key: "rain", label: "playlistRain", slugs: ["hoohoo-03", "haerang-07", "haerang-39"] },
  { key: "city", label: "playlistCity", slugs: ["hedon-01", "haerang-16", "hoohoo-08"] },
  { key: "afterglow", label: "playlistAfterglow", slugs: ["record-03", "haerang-40", "hoohoo-26"] },
  { key: "coffee", label: "playlistCoffee", slugs: ["hoohoo-05", "haerang-24", "record-06"] },
  { key: "sunday", label: "playlistSunday", slugs: ["haerang-04", "hoohoo-09", "haerang-33"] },
  { key: "snow", label: "playlistSnow", slugs: ["haerang-15", "haerang-17", "hoohoo-19"] },
  { key: "jazzBar", label: "playlistJazzBar", slugs: ["hoohoo-15", "haerang-31", "haerang-38"] },
  { key: "festival", label: "playlistFestival", slugs: ["hedon-07", "hedon-17", "haerang-26"] },
  { key: "homeCafe", label: "playlistHomeCafe", slugs: ["hoohoo-12", "haerang-21", "haerang-36"] },
  { key: "nightRun", label: "playlistNightRun", slugs: ["hedon-11", "hoohoo-13", "haerang-34"] },
  { key: "digitalDetox", label: "playlistDigitalDetox", slugs: ["haerang-20", "haerang-32", "hoohoo-14"] },
  { key: "soloTrip", label: "playlistSoloTrip", slugs: ["haerang-28", "haerang-35", "hoohoo-25"] },
  { key: "vinylShop", label: "playlistVinylShop", slugs: ["hoohoo-06", "haerang-14", "hoohoo-17"] },
  { key: "midnightSnack", label: "playlistMidnightSnack", slugs: ["hedon-04", "hedon-08", "haerang-42"] },
  { key: "bookAfternoon", label: "playlistBookAfternoon", slugs: ["hoohoo-18", "hoohoo-24", "haerang-29"] },
  { key: "campfire", label: "playlistCampfire", slugs: ["haerang-41", "hoohoo-20", "hedon-05"] },
];
