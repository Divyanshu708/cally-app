import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";
import { useGetRoomById } from "../hooks/useRooms";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import axios from "axios";
import CreateRoomForm from "../components/CreateRoomForm";
import JoinRoomForm from "../components/JoinRoomForm";
import checkInputs from "../utils/checkInput";

function CreateRoomPage() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [joinRoomInput, setJoinRoomInput] = useState("");
  const [joinRoomDisplayName, setJoinRoomDisplayName] = useState("");

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (body) => {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/rooms`,
        body,
        { withCredentials: true },
      );
      return res.data.data;
    },
    onSuccess: (room) => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      toast.success("Room created successfully");
      sessionStorage.setItem(
        "roomInfo",
        JSON.stringify({
          roomInput,
          displayName,
          roomId,
          role: "admin",
          roomCreatedAt: room?.createdAt || new Date().toISOString(),
        }),
      );
      navigate(`/room/${roomId}`);
    },
    onError: (error) => {
      console.log(error);
      toast.error(error);
      return false;
    },
  });

  function handleCreateRoom() {
    const roomId = uuidv4();
    setRoomId(roomId);
    if (!checkInputs(roomInput, "Room name is required")) return;
    if (!checkInputs(displayName, "Display name is required")) return;
    mutation.mutate({ roomId, name: roomInput, role: "admin" });
  }

  async function handleJoinRoom() {
    if (!checkInputs(joinRoomInput, "Join link is required")) return;
    if (!checkInputs(joinRoomDisplayName, "Display name is required")) return;

    const roomId = joinRoomInput.startsWith("http")
      ? joinRoomInput.split("/").pop()
      : joinRoomInput;
    console.log(roomId);

    const data = await axios.get(
      `${import.meta.env.VITE_API_URL}/api/rooms/${roomId}`,
    );

    const room = data.data.data;
    if (!room) {
      toast.error("Room not found");
      return;
    }

    sessionStorage.setItem(
      "roomInfo",
      JSON.stringify({
        roomId,
        roomInput: room.name || "Room",
        displayName: joinRoomDisplayName,
        role: "user",
        roomCreatedAt: room.createdAt || new Date().toISOString(),
      }),
    );
    navigate(`/room/${roomId}`);
  }

  return (
    <div className="w-full h-full min-h-0 flex justify-start lg:justify-center items-center flex-col gap-8 lg:gap-12 px-4 pt-6 pb-10 sm:px-6 lg:px-0 lg:pt-0 lg:pb-0 overflow-y-auto">
      <div className="w-full max-w-4xl flex justify-center items-center gap-2 flex-col text-center">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white/70">
          Create a Room
        </h1>

        <p className="text-base sm:text-lg lg:text-xl font-extralight text-white/60 leading-relaxed">
          Start a room for video chat, voice chat, screen sharing, and
          whiteboard collaboration.
        </p>
      </div>

      <div className="w-full lg:w-1/2 flex flex-col lg:flex-row justify-center items-stretch lg:items-center gap-8 lg:gap-0">
        <CreateRoomForm
          roomInput={roomInput}
          setRoomInput={setRoomInput}
          displayName={displayName}
          setDisplayName={setDisplayName}
          handleCreateRoom={handleCreateRoom}
        />
        <div
          className="hidden lg:block w-[0.2rem] min-h-[12rem] shrink-0 self-stretch rounded-full bg-white/20"
          aria-hidden
        />
        <div
          className="lg:hidden w-full max-w-md mx-auto h-[0.2rem] shrink-0 rounded-full bg-white/20"
          aria-hidden
        />
        <JoinRoomForm
          joinRoomDisplayName={joinRoomDisplayName}
          setJoinRoomDisplayName={setJoinRoomDisplayName}
          joinRoomInput={joinRoomInput}
          setJoinRoomInput={setJoinRoomInput}
          handleJoinRoom={handleJoinRoom}
        />
      </div>
    </div>
  );
}

export default CreateRoomPage;
