import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetBot,
  useUpdateBot,
  useListPlans,
  useCreatePlan,
  useDeletePlan,
  useListSubscribers,
  useListPaymentRequests,
  useApprovePaymentRequest,
  useRejectPaymentRequest,
  useListTokens,
  useListBroadcasts,
  useListUserbots,
  useRevokeUserbot,
  getGetBotQueryKey,
  getListPlansQueryKey,
  getListSubscribersQueryKey,
  getListPaymentRequestsQueryKey,
  getListTokensQueryKey,
  getListBroadcastsQueryKey,
  getListUserbotsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, Plus, Trash2, CheckCircle, XCircle, Send,
  Users, CreditCard, KeyRound, Radio, Settings2, Bot, ShieldOff, Phone, CircleDot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const createPlanSchema = z.object({
  name: z.string().min(1, "Name is required"),
  durationMonths: z.coerce.number().int().min(1),
  price: z.string().min(1, "Price is required"),
});
type CreatePlanForm = z.infer<typeof createPlanSchema>;

const updateBotSchema = z.object({
  name: z.string().min(1),
  superuserChatId: z.string().optional(),
  paymentInfo: z.string().optional(),
});
type UpdateBotForm = z.infer<typeof updateBotSchema>;

function PlansTab({ botId }: { botId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: plans, isLoading } = useListPlans(botId, {
    query: { queryKey: getListPlansQueryKey(botId) },
  });
  const createPlan = useCreatePlan();
  const deletePlan = useDeletePlan();

  const form = useForm<CreatePlanForm>({
    resolver: zodResolver(createPlanSchema),
    defaultValues: { name: "", durationMonths: 1, price: "" },
  });

  function onSubmit(values: CreatePlanForm) {
    createPlan.mutate(
      { botId, data: { ...values, price: values.price } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPlansQueryKey(botId) });
          toast({ title: "Plan created" });
          setOpen(false);
          form.reset();
        },
        onError: () => toast({ title: "Failed to create plan", variant: "destructive" }),
      }
    );
  }

  function handleDelete(planId: number) {
    deletePlan.mutate(
      { botId, planId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPlansQueryKey(botId) });
          toast({ title: "Plan deleted" });
        },
        onError: () => toast({ title: "Failed to delete plan", variant: "destructive" }),
      }
    );
  }

  if (isLoading) return <Skeleton className="h-32 w-full rounded-lg" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)} data-testid="button-create-plan">
          <Plus className="h-3.5 w-3.5 mr-1.5" />New Plan
        </Button>
      </div>
      {!plans?.length ? (
        <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground text-sm">No plans yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((plan) => (
            <Card key={plan.id} data-testid={`card-plan-${plan.id}`}>
              <CardContent className="py-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">{plan.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{plan.durationMonths} month{plan.durationMonths !== 1 ? "s" : ""} · {plan.price}</p>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(plan.id)} data-testid={`button-delete-plan-${plan.id}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Plan</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan Name</FormLabel>
                  <FormControl><Input placeholder="1 Month Access" {...field} data-testid="input-plan-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="durationMonths" render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (months)</FormLabel>
                  <FormControl><Input type="number" min={1} {...field} data-testid="input-plan-duration" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem>
                  <FormLabel>Price</FormLabel>
                  <FormControl><Input placeholder="$9.99" {...field} data-testid="input-plan-price" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createPlan.isPending} data-testid="button-submit-plan">
                  {createPlan.isPending ? "Creating..." : "Create Plan"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SubscribersTab({ botId }: { botId: number }) {
  const { data: subscribers, isLoading } = useListSubscribers(botId, {
    query: { queryKey: getListSubscribersQueryKey(botId) },
  });

  if (isLoading) return <Skeleton className="h-32 w-full rounded-lg" />;
  if (!subscribers?.length) return (
    <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground text-sm">No subscribers yet.</CardContent></Card>
  );

  return (
    <div className="space-y-2">
      {subscribers.map((sub) => (
        <Card key={sub.id} data-testid={`card-subscriber-${sub.id}`}>
          <CardContent className="py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" data-testid={`text-subscriber-name-${sub.id}`}>
                  {sub.firstName ?? sub.chatId}{sub.lastName ? ` ${sub.lastName}` : ""}
                </p>
                {sub.username && <p className="text-xs text-muted-foreground">@{sub.username}</p>}
              </div>
            </div>
            <Badge variant={sub.isActive ? "default" : "secondary"} className="text-xs flex-shrink-0">
              {sub.isActive ? "Active" : "Inactive"}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PaymentRequestsTab({ botId }: { botId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const { data: requests, isLoading } = useListPaymentRequests(botId, {
    query: { queryKey: getListPaymentRequestsQueryKey(botId) },
  });
  const { data: plans } = useListPlans(botId);
  const approveRequest = useApprovePaymentRequest();
  const rejectRequest = useRejectPaymentRequest();

  function getPlanName(planId: number) {
    return plans?.find((p) => p.id === planId)?.name ?? `Plan #${planId}`;
  }

  function handleApprove(requestId: number) {
    approveRequest.mutate({ botId, requestId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPaymentRequestsQueryKey(botId) });
        toast({ title: "Payment approved and token sent" });
      },
      onError: () => toast({ title: "Failed to approve", variant: "destructive" }),
    });
  }

  function handleReject() {
    if (rejectId === null) return;
    rejectRequest.mutate({ botId, requestId: rejectId, data: { reason: rejectReason } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPaymentRequestsQueryKey(botId) });
        toast({ title: "Payment rejected" });
        setRejectId(null);
        setRejectReason("");
      },
      onError: () => toast({ title: "Failed to reject", variant: "destructive" }),
    });
  }

  const statusBadge = (status: string) => {
    if (status === "approved") return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">Approved</Badge>;
    if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="outline" className="border-amber-400 text-amber-600">Pending</Badge>;
  };

  if (isLoading) return <Skeleton className="h-32 w-full rounded-lg" />;
  if (!requests?.length) return (
    <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground text-sm">No payment requests yet.</CardContent></Card>
  );

  return (
    <div className="space-y-2">
      {requests.map((req) => (
        <Card key={req.id} data-testid={`card-payment-${req.id}`}>
          <CardContent className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium" data-testid={`text-payment-user-${req.id}`}>
                  {req.telegramFirstName ?? req.chatId}
                </span>
                {req.telegramUsername && <span className="text-xs text-muted-foreground">@{req.telegramUsername}</span>}
                {statusBadge(req.status)}
              </div>
              <p className="text-xs text-muted-foreground">{getPlanName(req.planId)} · {new Date(req.createdAt).toLocaleDateString()}</p>
              {req.rejectionReason && <p className="text-xs text-destructive">{req.rejectionReason}</p>}
            </div>
            {req.status === "pending" && (
              <div className="flex gap-2 flex-shrink-0">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleApprove(req.id)} disabled={approveRequest.isPending} data-testid={`button-approve-${req.id}`}>
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />Approve
                </Button>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive border-destructive/40" onClick={() => { setRejectId(req.id); setRejectReason(""); }} data-testid={`button-reject-${req.id}`}>
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />Reject
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      <Dialog open={rejectId !== null} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Payment Request</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="reject-reason-detail">Reason (optional)</Label>
            <Input id="reject-reason-detail" placeholder="Reason for rejection..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} data-testid="input-reject-reason-detail" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectRequest.isPending} data-testid="button-confirm-reject-detail">
              {rejectRequest.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TokensTab({ botId }: { botId: number }) {
  const { data: tokens, isLoading } = useListTokens(botId, {
    query: { queryKey: getListTokensQueryKey(botId) },
  });

  if (isLoading) return <Skeleton className="h-32 w-full rounded-lg" />;
  if (!tokens?.length) return (
    <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground text-sm">No tokens generated yet.</CardContent></Card>
  );

  return (
    <div className="space-y-2">
      {tokens.map((tok) => (
        <Card key={tok.id} data-testid={`card-token-${tok.id}`}>
          <CardContent className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-mono text-sm tracking-widest" data-testid={`text-token-value-${tok.id}`}>{tok.token}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Expires {new Date(tok.expiresAt).toLocaleDateString()}
                {tok.activatedByChatId && ` · Used by ${tok.activatedByChatId}`}
              </p>
            </div>
            <Badge variant={tok.isActivated ? "default" : "secondary"} className="flex-shrink-0 text-xs" data-testid={`status-token-${tok.id}`}>
              {tok.isActivated ? "Activated" : "Unused"}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function UserBotsTab({ botId }: { botId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const { data: userbots, isLoading } = useListUserbots(botId, {
    query: { queryKey: getListUserbotsQueryKey(botId) },
  });
  const revokeUserbot = useRevokeUserbot();

  function handleRevoke(chatId: string) {
    revokeUserbot.mutate(
      { botId, chatId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUserbotsQueryKey(botId) });
          toast({ title: "UserBot session revoked" });
          setConfirmRevokeId(null);
        },
        onError: () => toast({ title: "Failed to revoke session", variant: "destructive" }),
      },
    );
  }

  if (isLoading) return <Skeleton className="h-32 w-full rounded-lg" />;

  if (!userbots?.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center space-y-3">
          <Bot className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No active UserBot sessions.</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Subscribed users can log in their Telegram account as a UserBot to broadcast messages to their groups and channels.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {userbots.length} active UserBot session{userbots.length !== 1 ? "s" : ""}. Revoking a session immediately disconnects that user's bot.
      </p>
      {userbots.map((ub) => (
        <Card key={ub.id} data-testid={`card-userbot-${ub.id}`}>
          <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Bot className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm">
                  {ub.telegramFirstName ?? `User ${ub.chatId}`}
                </p>
                {ub.telegramUsername && (
                  <span className="text-xs text-muted-foreground">@{ub.telegramUsername}</span>
                )}
                <Badge
                  className={
                    ub.isActive
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-xs"
                      : "text-xs"
                  }
                  variant={ub.isActive ? "outline" : "secondary"}
                >
                  <CircleDot className={`h-2.5 w-2.5 mr-1 ${ub.isActive ? "text-emerald-500" : ""}`} />
                  {ub.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />{ub.phone}
                </span>
                {ub.telegramUserId && (
                  <span>TG ID: {ub.telegramUserId}</span>
                )}
                <span>Chat: {ub.chatId}</span>
                <span>Added {new Date(ub.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60 flex-shrink-0"
              onClick={() => setConfirmRevokeId(ub.chatId)}
              data-testid={`button-revoke-userbot-${ub.id}`}
            >
              <ShieldOff className="h-3.5 w-3.5 mr-1.5" />Revoke
            </Button>
          </CardContent>
        </Card>
      ))}

      <Dialog open={confirmRevokeId !== null} onOpenChange={(o) => !o && setConfirmRevokeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke UserBot Session</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the stored Telegram session for this user. They will be notified and can reconnect from the subscriber menu.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRevokeId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => confirmRevokeId && handleRevoke(confirmRevokeId)}
              disabled={revokeUserbot.isPending}
              data-testid="button-confirm-revoke"
            >
              {revokeUserbot.isPending ? "Revoking..." : "Revoke Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BroadcastsTab({ botId }: { botId: number }) {
  const { data: broadcasts, isLoading } = useListBroadcasts(botId, {
    query: { queryKey: getListBroadcastsQueryKey(botId) },
  });

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
      sending: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
      failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
      draft: "bg-gray-100 text-gray-700 dark:bg-gray-900/40",
    };
    return <Badge className={map[status] ?? ""}>{status}</Badge>;
  };

  if (isLoading) return <Skeleton className="h-32 w-full rounded-lg" />;
  if (!broadcasts?.length) return (
    <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground text-sm">No broadcasts yet.</CardContent></Card>
  );

  return (
    <div className="space-y-2">
      {broadcasts.map((b) => (
        <Card key={b.id} data-testid={`card-broadcast-${b.id}`}>
          <CardContent className="py-3 flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate" data-testid={`text-broadcast-message-${b.id}`}>{b.message}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(b.createdAt).toLocaleDateString()} · {b.sentCount}/{b.totalRecipients} sent
                {b.failedCount > 0 && ` · ${b.failedCount} failed`}
              </p>
            </div>
            {statusBadge(b.status)}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SettingsTab({ botId }: { botId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: bot, isLoading } = useGetBot(botId, {
    query: { queryKey: getGetBotQueryKey(botId) },
  });
  const updateBot = useUpdateBot();

  const form = useForm<UpdateBotForm>({
    resolver: zodResolver(updateBotSchema),
    defaultValues: { name: "", superuserChatId: "", paymentInfo: "" },
    values: bot ? {
      name: bot.name,
      superuserChatId: bot.superuserChatId ?? "",
      paymentInfo: bot.paymentInfo ?? "",
    } : undefined,
  });

  function onSubmit(values: UpdateBotForm) {
    updateBot.mutate(
      { botId, data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(botId) });
          toast({ title: "Bot updated" });
        },
        onError: () => toast({ title: "Failed to update bot", variant: "destructive" }),
      }
    );
  }

  if (isLoading) return <Skeleton className="h-48 w-full rounded-lg" />;

  return (
    <Card>
      <CardContent className="py-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Bot Name</FormLabel>
                <FormControl><Input {...field} data-testid="input-update-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="superuserChatId" render={({ field }) => (
              <FormItem>
                <FormLabel>Superuser Chat ID</FormLabel>
                <FormControl><Input placeholder="123456789" {...field} data-testid="input-superuser-chat-id" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="paymentInfo" render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Instructions</FormLabel>
                <FormControl>
                  <Textarea placeholder="Send payment to..." rows={4} {...field} data-testid="textarea-payment-info" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex justify-end">
              <Button type="submit" disabled={updateBot.isPending} data-testid="button-save-settings">
                {updateBot.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export default function BotDetail() {
  const { botId: botIdStr } = useParams<{ botId: string }>();
  const botId = Number(botIdStr);
  const [, setLocation] = useLocation();
  const { data: bot, isLoading, isError } = useGetBot(botId, {
    query: { enabled: !!botId, queryKey: getGetBotQueryKey(botId) },
  });

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );

  if (isError || !bot) return (
    <div className="p-6 bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
      Bot not found or failed to load.
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/bots")} data-testid="link-back-to-bots">
          <ArrowLeft className="h-4 w-4 mr-1.5" />Back
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate" data-testid="text-bot-name">{bot.name}</h1>
          {bot.username && <p className="text-sm text-muted-foreground">@{bot.username}</p>}
        </div>
        <Link href={`/bots/${botId}/broadcasts/new`}>
          <Button size="sm" data-testid="link-new-broadcast">
            <Send className="h-3.5 w-3.5 mr-1.5" />New Broadcast
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="plans">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="plans" data-testid="tab-plans">
            <CreditCard className="h-3.5 w-3.5 mr-1.5" />Plans
          </TabsTrigger>
          <TabsTrigger value="subscribers" data-testid="tab-subscribers">
            <Users className="h-3.5 w-3.5 mr-1.5" />Subscribers
          </TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-payments">
            <Radio className="h-3.5 w-3.5 mr-1.5" />Payments
          </TabsTrigger>
          <TabsTrigger value="tokens" data-testid="tab-tokens">
            <KeyRound className="h-3.5 w-3.5 mr-1.5" />Tokens
          </TabsTrigger>
          <TabsTrigger value="userbots" data-testid="tab-userbots">
            <Bot className="h-3.5 w-3.5 mr-1.5" />UserBots
          </TabsTrigger>
          <TabsTrigger value="broadcasts" data-testid="tab-broadcasts">
            <Send className="h-3.5 w-3.5 mr-1.5" />Broadcasts
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings2 className="h-3.5 w-3.5 mr-1.5" />Settings
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="plans"><PlansTab botId={botId} /></TabsContent>
          <TabsContent value="subscribers"><SubscribersTab botId={botId} /></TabsContent>
          <TabsContent value="payments"><PaymentRequestsTab botId={botId} /></TabsContent>
          <TabsContent value="tokens"><TokensTab botId={botId} /></TabsContent>
          <TabsContent value="userbots"><UserBotsTab botId={botId} /></TabsContent>
          <TabsContent value="broadcasts"><BroadcastsTab botId={botId} /></TabsContent>
          <TabsContent value="settings"><SettingsTab botId={botId} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
