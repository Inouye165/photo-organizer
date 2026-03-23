import { RouterProvider, createBrowserRouter } from "react-router-dom";

import { DashboardPage } from "@/routes/dashboard";
import { RejectedFilesPage } from "@/routes/rejected";

const router = createBrowserRouter([
  {
    path: "/",
    element: <DashboardPage />,
  },
  {
    path: "/rejected",
    element: <RejectedFilesPage />,
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
