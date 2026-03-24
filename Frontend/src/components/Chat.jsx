import { useEffect, useState, useRef } from "react";
import axios from "axios";
import sendmsgIcon from "../assets/Tools/msg_send_logo.svg";
import emojiIcon from "../assets/Tools/emoji_logo.svg";
import linkIcon from "../assets/Tools/attachment_logo.svg";
import mentionIcon from "../assets/Tools/mention_logo.svg";
import userMiniLogo from "../assets/miniUserLogo.svg";
import dot_logo from "../assets/Tools/3dot_logo.svg";
import { socket } from "../services/socket";

function Chat({ roomId, roomName, displayName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [participantCount, setParticipantCount] = useState(0);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!roomId) return;

    const fetchMessages = async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/messages`,
          {
            params: { roomId },
          },
        );
        setMessages(res.data.data || []);
      } catch (err) {
        console.error("Failed to load messages", err);
      }
    };

    fetchMessages();

    socket.on("message", (message) => {
      if (message.roomId !== roomId) return;
      setMessages((prev) => {
        if (message.clientTempId) {
          const idx = prev.findIndex((m) => m.clientTempId === message.clientTempId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...message };
            return next;
          }
        }
        if (prev.some((m) => m._id === message._id)) return prev;
        return [...prev, message];
      });
    });

    socket.on("room-participants", (participants) => {
      setParticipantCount(Array.isArray(participants) ? participants.length : 0);
    });

    return () => {
      socket.off("message");
      socket.off("room-participants");
    };
  }, [roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e) => {
    e?.preventDefault?.();
    const text = input.trim();
    if (!text || !roomId) return;
    if (!socket.connected) {
      console.warn("Socket not connected. Message not sent.");
      return;
    }

    const clientTempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticMsg = {
      _id: clientTempId,
      clientTempId,
      roomId,
      userId: socket.id,
      userName: displayName || "User",
      text,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInput("");

    socket.emit("send-message", {
      roomId,
      userId: socket.id,
      userName: displayName || "User",
      text,
      clientTempId,
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-full h-[320px] sm:h-[360px] lg:h-full bg-[#C9DFE6]/40 rounded-2xl flex flex-col">
      <div className="bg-[#16191F]/79 w-full min-h-[64px] rounded-t-2xl border-b-1 flex items-start">
        <div className="flex items-center justify-between w-full px-6">
          <div className=" flex flex-col  py-3 text-white">
            <h1 className="text-xs font-medium ">{roomName}</h1>
            <div className="font-light flex items-center text-xs">
              <img
                src={userMiniLogo}
                alt="User Mini Logo"
                className="scale-120"
              />{" "}
              <span className="opacity-65">
                {participantCount} {participantCount === 1 ? "Person" : "People"}
              </span>
            </div>
          </div>
          <img
            src={dot_logo}
            alt="arrow down"
            className="w-6 h-6 cursor-pointer scale-90 hover:scale-95 transition-all duration-100"
          />
        </div>
      </div>
      <div className="w-full flex-1 bg-[#3E6291]/29 overflow-y-auto overflow-x-hidden scrollbar-rounded px-3 sm:px-4 py-3 space-y-2 flex flex-col">
        {messages.map((msg) => (
          <div
            key={msg._id || `${msg.userId}-${msg.createdAt}-${msg.text}`}
            className={`max-w-[90%] rounded-xl px-3 py-2 text-xs ${
              msg.userId === socket.id
                ? "bg-[#00114E]/40 self-end ml-auto text-right"
                : "bg-[#ffffff]/15 self-start mr-auto text-left"
            }`}
          >
            <div className="font-semibold text-[10px] text-white/50">
              {msg.userName || "Guest"}
            </div>
            <div className="mt-0.5 break-words text-white/90">{msg.text}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="w-full min-h-[64px] bg-[#3E6291]/29 rounded-b-2xl p-2 sm:p-3">
        <div className="w-full h-full border-2 border-white/70 bg-[#00114E]/10 p-1 pl-2 rounded-full flex items-center justify-between -gap-1">
          <img
            src={emojiIcon}
            alt="emoji"
            className="w-6 h-6 hover:scale-108 transition-all duration-100 cursor-pointer"
          />

          <input
            type="text"
            placeholder="Type a message"
            className="h-full bg-transparent placeholder:text-xs sm:placeholder:text-sm placeholder:font-medium pl-2 pb-1 outline-none text-white/70 w-[72%] sm:w-[80%]"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="flex items-center justify-center gap-2 sm:gap-3 w-[20%] sm:w-[16%] scale-90 ">
            {/* <img src={linkIcon} alt="attach" className="w-6 h-6" />
            <img src={mentionIcon} alt="mention" className="w-6 h-6" /> */}
            <button
              type="button"
              onClick={handleSend}
              className="p-1 rounded-full hover:bg-white/10 transition-all duration-100 cursor-pointer"
              aria-label="Send message"
            >
              <img
                src={sendmsgIcon}
                alt="send"
                className="w-6 h-6 hover:scale-108 transition-all duration-100"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chat;
