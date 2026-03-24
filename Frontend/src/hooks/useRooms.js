import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "react-toastify";

function useGetRoomById(id) {
  return useQuery({
    queryKey: ["rooms"],
    queryFn: async () => {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/rooms/${id}`,
        {
          withCredentials: true,
        },
      );
      console.log(res);
      return res.data.rooms;
    },
    staleTime: 1000 * 60,
    cacheTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
}

function useCreateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/rooms`,
        body,
        {
          withCredentials: true,
        },
      );
      return res.data.rooms;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      toast.success("Room created successfully");
    },
    onError: (error) => {
      toast.error(error.response.data.message);
    },
  });
}

export { useGetRoomById, useCreateRoom };
