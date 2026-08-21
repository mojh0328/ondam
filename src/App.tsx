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
      {/* 🌟 뒤로가기 시 컴포넌트가 강제로 새로고침되도록 key와 inline render 함수 적용 */}
      <Route path="/stores/:id/menu">
        {(params) => <StoreMenu key={params.id} />}
      </Route>
      <Route path="/menu-items/:id">
        {(params) => <MenuItemDetails key={params.id} />}
      </Route>
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