import { useState } from "react";
import { Link } from "wouter";
import {
  useListBots,
  useCreateBot,
  useDeleteBot,
  useSetupWebhook,
  getListBotsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Bot, Plus, Trash2, ExternalLink, Webhook, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const createBotSchema = z.object({
  name: z.string().min(1, "Name is required"),
  token: z.string().min(1, "Token is required"),
});
type CreateBotForm = z.infer<typeof createBotSchema>;

export default function Bots() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: bots, isLoading, isError } = useListBots();
  const createBot = useCreateBot();
  const deleteBot = useDeleteBot();
  const setupWebhook = useSetupWebhook();

  const form = useForm<CreateBotForm>({
    resolver: zodResolver(createBotSchema),
    defaultValues: { name: "", token: "" },
  });

  function onSubmit(values: CreateBotForm) {
    createBot.mutate(
      { data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
          toast({ title: "Bot registered successfully" });
          setOpen(false);
          form.reset();
        },
        onError: () => {
          toast({ title: "Failed to register bot", variant: "destructive" });
        },
      }
    );
  }

  function handleDelete(botId: number) {
    deleteBot.mutate(
      { botId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
          toast({ title: "Bot deleted" });
        },
        onError: () => {
          toast({ title: "Failed to delete bot", variant: "destructive" });
        },
      }
    );
  }

  function handleSetupWebhook(botId: number) {
    setupWebhook.mutate(
      { botId },
      {
        onSuccess: (data) => {
          toast({ title: "Webhook registered", description: data.webhookUrl });
        },
        onError: () => {
          toast({ title: "Failed to setup webhook", variant: "destructive" });
        },
      }
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bots</h1>
          <p className="text-muted-foreground mt-2">Manage your registered Telegram bots.</p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="button-create-bot">
          <Plus className="h-4 w-4 mr-2" />
          New Bot
        </Button>
      </div>

      {isError && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20" data-testid="bots-error">
          Failed to load bots.
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2" data-testid="bots-loading">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : bots && bots.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {bots.map((bot) => (
            <Card key={bot.id} className="hover-elevate transition-all border-border shadow-sm" data-testid={`card-bot-${bot.id}`}>
              <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{bot.name}</CardTitle>
                    {bot.username && (
                      <p className="text-xs text-muted-foreground mt-0.5">@{bot.username}</p>
                    )}
                  </div>
                </div>
                <Badge variant={bot.isActive ? "default" : "secondary"} data-testid={`status-bot-${bot.id}`}>
                  {bot.isActive ? "Active" : "Inactive"}
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground font-mono truncate mb-4" data-testid={`text-token-${bot.id}`}>
                  {bot.token.slice(0, 12)}••••••••••••
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => handleSetupWebhook(bot.id)} disabled={setupWebhook.isPending} data-testid={`button-webhook-${bot.id}`}>
                    <Webhook className="h-3.5 w-3.5 mr-1.5" />
                    Setup Webhook
                  </Button>
                  <Link href={`/bots/${bot.id}`}>
                    <Button variant="outline" size="sm" data-testid={`link-bot-detail-${bot.id}`}>
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      Manage
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </Link>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive ml-auto" data-testid={`button-delete-bot-${bot.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {bot.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the bot and all associated data. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive hover:bg-destructive/90"
                          onClick={() => handleDelete(bot.id)}
                          data-testid={`confirm-delete-bot-${bot.id}`}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Bot className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No bots registered yet</p>
              <p className="text-sm text-muted-foreground mt-1">Click "New Bot" to register your first Telegram bot.</p>
            </div>
            <Button onClick={() => setOpen(true)} data-testid="button-create-bot-empty">
              <Plus className="h-4 w-4 mr-2" />
              New Bot
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register New Bot</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bot Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Broadcast Bot" {...field} data-testid="input-bot-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telegram Bot Token</FormLabel>
                    <FormControl>
                      <Input placeholder="123456789:ABCDef..." {...field} data-testid="input-bot-token" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createBot.isPending} data-testid="button-submit-bot">
                  {createBot.isPending ? "Registering..." : "Register Bot"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
