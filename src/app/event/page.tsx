// Server component: hands the merged (static + DB) catalog to the seasonal
// exhibition, so an approved portal submission in the season's colours joins
// it without a code change.
import { getAllArtworks } from "@/lib/all-artworks";
import { SeasonExhibition } from "./SeasonExhibition";

export default async function EventPage() {
  const catalog = await getAllArtworks();
  return <SeasonExhibition catalog={catalog} />;
}
