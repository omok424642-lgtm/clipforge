import { SeasonDiscovery } from "@/components/season-discovery";

export const dynamic = "force-dynamic";
export default function DiscoverPage() {
  return <SeasonDiscovery initialNow={new Date().toISOString()} />;
}
