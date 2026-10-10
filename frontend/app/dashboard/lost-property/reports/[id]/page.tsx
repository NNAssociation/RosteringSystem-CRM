import { WorkplaceDetailPage } from "@/components/workplace/workplace-page";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkplaceDetailPage resource="lost-property/reports" id={Number(id)} />;
}
