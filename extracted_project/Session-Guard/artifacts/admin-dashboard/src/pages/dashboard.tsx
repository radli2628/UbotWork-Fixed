import { useGetDashboardStats } from "@workspace/api-client-react";
import { 
  Bot, 
  Users, 
  CreditCard, 
  KeyRound, 
  CheckCircle2, 
  Send 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: stats, isLoading, isError } = useGetDashboardStats();

  if (isError) {
    return (
      <div className="p-6 bg-destructive/10 text-destructive rounded-lg font-medium border border-destructive/20" data-testid="dashboard-error">
        Failed to load dashboard statistics.
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Bots",
      value: stats?.totalBots,
      icon: Bot,
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    {
      title: "Total Subscribers",
      value: stats?.totalSubscribers,
      icon: Users,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10"
    },
    {
      title: "Pending Payments",
      value: stats?.pendingRequests,
      icon: CreditCard,
      color: "text-amber-500",
      bg: "bg-amber-500/10"
    },
    {
      title: "Total Tokens",
      value: stats?.totalTokens,
      icon: KeyRound,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10"
    },
    {
      title: "Active Tokens",
      value: stats?.activeTokens,
      icon: CheckCircle2,
      color: "text-teal-500",
      bg: "bg-teal-500/10"
    },
    {
      title: "Total Broadcasts",
      value: stats?.totalBroadcasts,
      icon: Send,
      color: "text-purple-500",
      bg: "bg-purple-500/10"
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
        <p className="text-muted-foreground mt-2">Live metrics across all managed bots and subscriptions.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card, i) => (
          <Card key={card.title} className="overflow-hidden hover-elevate transition-all border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`h-8 w-8 rounded-md flex items-center justify-center ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" data-testid={`skeleton-${i}`} />
              ) : (
                <div className="text-3xl font-bold tracking-tighter text-foreground" data-testid={`stat-${card.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  {card.value?.toLocaleString()}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}