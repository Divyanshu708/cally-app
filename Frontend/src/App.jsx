import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import CreateRoomPage from "./pages/CreateRoomPage";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import RoomEntryPage from "./pages/RoomEntryPage";
import NavBar from "./components/NavBar";
import RoomNotFound from "./pages/RoomNotFound";
import { ToastContainer, Flip, Bounce } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function App() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <div className="text-white w-full h-[100dvh] bg-gradient-to-b from-black via-[#331639] to-[#254260] flex flex-col overflow-y-auto lg:overflow-hidden">
        <NavBar />

        <div className="w-full flex-1 min-h-0 flex">
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<CreateRoomPage />} />
              <Route path="room" element={<Outlet />}>
                <Route index element={<RoomNotFound />} />
                <Route path=":roomId" element={<RoomEntryPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
          <ReactQueryDevtools buttonPosition="bottom-left" />
        </div>
      </div>
      <ToastContainer
        hideProgressBar={true}
        transition={Flip}
        limit={1}
        newestOnTop={true}
        closeOnClick={true}
        position={"top-right"}
        autoClose={2000}
        pauseOnFocusLoss={false}
        draggable={true}
        closeButton={false}
        theme="dark"
        pauseOnHover={false}
      />
    </QueryClientProvider>
  );
}

export default App;
