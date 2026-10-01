import { notFound, redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/session";
import { getVoteDetailsService } from "@/server/services/voting.service";
import { VotingNav } from "@/components/voting/voting-nav";
import { VoteDetailView } from "@/components/voting/vote-detail-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getVoteDetailsService(slug);
  if (!data?.vote) {
    return { title: "Vote Not Found — SastraNet" };
  }
  return {
    title: `${data.vote.title} — SastraNet Voting`,
    description: data.vote.description || "Cast your vote or view results.",
  };
}

export default async function VoteDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    redirect(`/login?callbackUrl=/voting/${slug}`);
  }

  const data = await getVoteDetailsService(slug, user._id.toString());
  if (!data || !data.vote) {
    notFound();
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-5 py-8 sm:px-10">
      {/* Navigation */}
      <VotingNav />

      {/* Interactive Detail Island */}
      <VoteDetailView
        initialVote={data.vote}
        initialSummary={data.summary}
        currentUserId={user._id.toString()}
      />
    </main>
  );
}
