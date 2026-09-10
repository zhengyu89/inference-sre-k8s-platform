import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";
import Inference from "./pages/Inference.tsx";
import LoadTest from "./pages/LoadTest.tsx";
import Overview from "./pages/Overview.tsx";
import RequestDetail from "./pages/RequestDetail.tsx";
import Requests from "./pages/Requests.tsx";
import SreLab from "./pages/SreLab.tsx";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Overview /> },
      { path: "inference", element: <Inference /> },
      { path: "load-test", element: <LoadTest /> },
      { path: "sre-lab", element: <SreLab /> },
      { path: "requests", element: <Requests /> },
      { path: "requests/:id", element: <RequestDetail /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
