import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import Stores from "@/pages/Stores";
import Ingredients from "@/pages/Ingredients";
import StoreMenu from "@/pages/StoreMenu";
import MenuItemDetails from "@/pages/MenuItemDetails";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Admin from "@/pages/Admin";
import Profile from "@/pages/Profile";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 mins
    },
  },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-zinc-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-zinc-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Redirect to="/stores" />;
  }

  return <>{children}</>;
}

function Router() {
  const [location] = useLocation();
  const isAuthPage = location === "/login" || location === "/register";

  const routes = (
    <Switch>
      <Route path="/login">
        <RedirectIfAuthed>
          <Login />
        </RedirectIfAuthed>
      </Route>
      <Route path="/register">
        <RedirectIfAuthed>
          <Register />
        </RedirectIfAuthed>
      </Route>
      <Route path="/">
        <RequireAuth>
          <Stores />
        </RequireAuth>
      </Route>
      <Route path="/stores">
        <RequireAuth>
          <Stores />
        </RequireAuth>
      </Route>
      <Route path="/ingredients">
        <RequireAuth>
          <Ingredients />
        </RequireAuth>
      </Route>
      <Route path="/stores/:storeId/menu">
        <RequireAuth>
          <StoreMenu />
        </RequireAuth>
      </Route>
      <Route path="/stores/:storeId/menu/:menuItemId">
        <RequireAuth>
          <MenuItemDetails />
        </RequireAuth>
      </Route>
      <Route path="/admin">
        <RequireAuth>
          <Admin />
        </RequireAuth>
      </Route>
      <Route path="/profile">
        <RequireAuth>
          <Profile />
        </RequireAuth>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );

  if (isAuthPage) {
    return <div className="h-[100dvh] overflow-y-auto bg-background font-sans text-zinc-900">{routes}</div>;
  }

  return <AppLayout>{routes}</AppLayout>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
