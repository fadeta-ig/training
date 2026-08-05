import { redirect } from 'next/navigation';

export default async function LegacyGradeParticipantPage({
    params,
}: {
    params: Promise<{ id: string; participantId: string }>;
}) {
    const { id, participantId } = await params;
    redirect(`/admin/sessions/${id}/participants/${participantId}/answers`);
}
