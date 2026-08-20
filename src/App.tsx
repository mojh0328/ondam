import { Route, Switch, Redirect } from "wouter";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Login from "@/pages/Login";
import Admin from "@/pages/Admin";
import Profile from "@/pages/Profile";
import Ingredients from "@/pages/Ingredients";
import Stores from "@/pages/Stores";
import StoreMenu from "@/pages/StoreMenu";
import MenuItemDetails from "@/pages/MenuItemDetails";

function Router() {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route>
          <Redirect to="/login" />
        </Route>
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Stores} />
      <Route path="/profile" component={Profile} />
      <Route path="/ingredients" component={Ingredients} />
      <Route path="/stores/:id/menu" component={StoreMenu} />
      <Route path="/menu-items/:id" component={MenuItemDetails} />
      <Route path="/admin" component={Admin} />
      <Route path="/login">
        <Redirect to="/" />
      </Route>
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}