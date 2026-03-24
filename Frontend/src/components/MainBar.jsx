import RoomInfo from "../Ui/RoomInfo";
import RoomMediaControl from "../Ui/RoomMediaControl";
import Chat from "./Chat";
import PeopleCount from "./PeopleCount";
import VideoChat from "./VideoChat";
import { useEffect, useState, useRef } from "react";
import { socket } from "../services/socket";
import { useParams, useNavigate } from "react-router-dom";

function MainBar() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const previousRoomIdRef = useRef(null);

  let roomInput = "Room";
  let displayName = "User";
  let roomCreatedAt = null;
  let role = "user";
  try {
    const stored = sessionStorage.getItem("roomInfo");
    const parsed = stored ? JSON.parse(stored) : null;
    if (parsed) {
      roomInput = parsed.roomInput ?? roomInput;
      displayName = parsed.displayName ?? displayName;
      roomCreatedAt = parsed.roomCreatedAt ?? null;
      role = parsed.role ?? role;
    }
  } catch {
    // use defaults
  }
  const [participantCount, setParticipantCount] = useState(0);
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    if (!roomId) return;

    const prev = previousRoomIdRef.current;
    if (prev && prev !== roomId) {
      socket.emit("leave-room", { roomId: prev });
    }
    previousRoomIdRef.current = roomId;

    setParticipantCount(0);
    setParticipants([]);

    const onUserJoined = (data) => {
      console.log("User joined:", data);
    };

    const onRoomParticipants = (participantsList) => {
      const list = Array.isArray(participantsList) ? participantsList : [];
      setParticipantCount(list.length);
      setParticipants(list);
    };

    socket.on("user-joined", onUserJoined);
    socket.on("room-participants", onRoomParticipants);

    socket.emit("join-room", {
      roomId,
      roomName: roomInput,
      displayName,
      role,
    });

    return () => {
      socket.off("user-joined", onUserJoined);
      socket.off("room-participants", onRoomParticipants);
      socket.emit("leave-room", { roomId });
    };
  }, [roomId, roomInput, displayName, role]);

  const handleLeaveRoom = () => {
    if (roomId) socket.emit("leave-room", { roomId });
    sessionStorage.removeItem("roomInfo");
    navigate("/");
  };

  return (
    <div className="w-full h-full px-2 sm:px-3 overflow-y-auto lg:overflow-hidden flex flex-col min-h-0">
      <div className="py-2 sm:py-3 flex-shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <RoomInfo
          roomName={roomInput}
          participantCount={participantCount}
          roomCreatedAt={roomCreatedAt}
        />

        <RoomMediaControl
          onLeaveRoom={handleLeaveRoom}
          roomCreatedAt={roomCreatedAt}
        />
      </div>

      <div className="pb-2 sm:pb-3 flex-1 min-h-0 flex flex-col lg:flex-row gap-3 lg:overflow-hidden">
        <div className="order-2 lg:order-1 w-full lg:w-[30%] min-w-0 h-[42vh] sm:h-[40vh] lg:h-full">
          <Chat
            roomId={roomId}
            roomName={roomInput}
            displayName={displayName}
          />
        </div>

        <div className="order-1 lg:order-2 flex-1 min-w-0 h-[35rem] sm:h-[68vh] lg:h-full ">
          <VideoChat
            roomId={roomId}
            participants={participants}
            role={role}
            displayName={displayName}
          />
        </div>

        {/* <div className="hidden lg:block order-1 lg:order-3 h-full flex-shrink-0">
          <PeopleCount participants={participants} />
        </div> */}
      </div>
    </div>
  );
}

export default MainBar;
