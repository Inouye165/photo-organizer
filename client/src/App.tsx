import { RouterProvider, createBrowserRouter } from "react-router-dom";

import { DashboardPage } from "@/routes/dashboard";

const router = createBrowserRouter([
  {
    path: "/",
    element: <DashboardPage />,
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
