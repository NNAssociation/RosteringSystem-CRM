import { BookingWorkspace } from "@/components/bookings/BookingWorkspace";
export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <BookingWorkspace key={id} bookingId={id} />; }
