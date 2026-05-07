import { useParams, useLocation } from "wouter";
import {
  useGetBot,
  useCreateBroadcast,
  getGetBotQueryKey,
  getListBroadcastsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  message: z.string().min(1, "Message is required"),
});
type BroadcastForm = z.infer<typeof schema>;

export default function NewBroadcast() {
  const { botId: botIdStr } = useParams<{ botId: string }>();
  const botId = Number(botIdStr);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bot, isLoading } = useGetBot(botId, {
    query: { enabled: !!botId, queryKey: getGetBotQueryKey(botId) },
  });
  const createBroadcast = useCreateBroadcast();

  const form = useForm<BroadcastForm>({
    resolver: zodResolver(schema),
    defaultValues: { message: "" },
  });

  function onSubmit(values: BroadcastForm) {
    createBroadcast.mutate(
      { botId, data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBroadcastsQueryKey(botId) });
          toast({ title: "Broadcast queued successfully" });
          setLocation(`/bots/${botId}`);
        },
        onError: () => {
          toast({ title: "Failed to send broadcast", variant: "destructive" });
        },
      }
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation(`/bots/${botId}`)} data-testid="link-back-to-bot">
          <ArrowLeft className="h-4 w-4 mr-1.5" />Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Broadcast</h1>
          {bot && <p className="text-sm text-muted-foreground">{bot.name}</p>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compose Message</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Type your broadcast message here..."
                        rows={8}
                        {...field}
                        data-testid="textarea-broadcast-message"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  This message will be sent to all active subscribers.
                </p>
                <Button type="submit" disabled={createBroadcast.isPending} data-testid="button-send-broadcast">
                  <Send className="h-4 w-4 mr-2" />
                  {createBroadcast.isPending ? "Sending..." : "Send Broadcast"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
