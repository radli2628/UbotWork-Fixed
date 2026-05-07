import { useState } from "react";
import {
  useListBots,
  useListPaymentRequests,
  useListPlans,
  useApprovePaymentRequest,
  useRejectPaymentRequest,
  getListPaymentRequestsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function BotPaymentRequests({ botId, botName }: { botId: number; botName: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: requests, isLoading } = useListPaymentRequests(botId, {
    query: { queryKey: getListPaymentRequestsQueryKey(botId) },
  });
  const { data: plans } = useListPlans(botId);
  const approveRequest = useApprovePaymentRequest();
  const rejectRequest = useRejectPaymentRequest();
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const pending = requests?.filter((r) => r.status === "pending") ?? [];

  function handleApprove(requestId: number) {
    approveRequest.mutate(
      { botId, requestId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPaymentRequestsQueryKey(botId) });
          toast({ title: "Payment approved and token sent" });
        },
        onError: () => {
          toast({ title: "Failed to approve", variant: "destructive" });
        },
      }
    );
  }

  function handleReject() {
    if (rejectId === null) return;
    rejectRequest.mutate(
      { botId, requestId: rejectId, data: { reason: rejectReason } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPaymentRequestsQueryKey(botId) });
          toast({ title: "Payment rejected" });
          setRejectId(null);
          setRejectReason("");
        },
        onError: () => {
          toast({ title: "Failed to reject", variant: "destructive" });
        },
      }
    );
  }

  function getPlanName(planId: number) {
    return plans?.find((p) => p.id === planId)?.name ?? `Plan #${planId}`;
  }

  if (isLoading) return <Skeleton className="h-24 w-full rounded-lg" />;
  if (!pending.length) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{botName}</h3>
      {pending.map((req) => (
        <Card key={req.id} className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800" data-testid={`card-request-${req.id}`}>
          <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm" data-testid={`text-chatid-${req.id}`}>
                  {req.telegramFirstName ?? req.chatId}
                </span>
                {req.telegramUsername && (
                  <span className="text-xs text-muted-foreground">@{req.telegramUsername}</span>
                )}
                <Badge variant="outline" className="text-xs" data-testid={`text-plan-${req.id}`}>
                  {getPlanName(req.planId)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Requested {new Date(req.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => handleApprove(req.id)}
                disabled={approveRequest.isPending}
                data-testid={`button-approve-${req.id}`}
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive border-destructive/40"
                onClick={() => { setRejectId(req.id); setRejectReason(""); }}
                data-testid={`button-reject-${req.id}`}
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={rejectId !== null} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payment Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="reject-reason">Reason (optional)</Label>
            <Input
              id="reject-reason"
              placeholder="Reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              data-testid="input-reject-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectRequest.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectRequest.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PaymentRequests() {
  const { data: bots, isLoading } = useListBots();
  const [filterBotId, setFilterBotId] = useState<string>("all");

  const filteredBots = bots?.filter((b) =>
    filterBotId === "all" ? true : String(b.id) === filterBotId
  ) ?? [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Requests</h1>
          <p className="text-muted-foreground mt-2">Review and act on pending subscription payments.</p>
        </div>
        {bots && bots.length > 1 && (
          <Select value={filterBotId} onValueChange={setFilterBotId}>
            <SelectTrigger className="w-48" data-testid="select-filter-bot">
              <SelectValue placeholder="All bots" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All bots</SelectItem>
              {bots.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : filteredBots.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No bots to show</p>
              <p className="text-sm text-muted-foreground mt-1">Register a bot first to start receiving payment requests.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {filteredBots.map((bot) => (
            <BotPaymentRequests key={bot.id} botId={bot.id} botName={bot.name} />
          ))}
          <div className="flex items-center gap-2 p-4 rounded-lg bg-muted/50 text-muted-foreground text-sm" data-testid="note-processed">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            Only pending requests are shown here. Approved and rejected requests are visible in each bot's detail page.
          </div>
        </div>
      )}
    </div>
  );
}
