import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminLayout } from "./components/layout/admin-layout";
import Dashboard from "./pages/dashboard";
import Bots from "./pages/bots";
import BotDetail from "./pages/bot-detail";
import NewBroadcast from "./pages/new-broadcast";
import PaymentRequests from "./pages/payment-requests";
import NotFound from "./pages/not-found";
import { useAuth } from "@workspace/replit-auth-web";

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, login } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm">Sign in to continue</p>
        <button
          onClick={login}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Log in
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

function Router() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/bots" component={Bots} />
        <Route path="/bots/:botId/broadcasts/new" component={NewBroadcast} />
        <Route path="/bots/:botId" component={BotDetail} />
        <Route path="/payment-requests" component={PaymentRequests} />
        <Route component={NotFound} />
      </Switch>
    </AdminLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthGuard>
            <Router />
          </AuthGuard>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
