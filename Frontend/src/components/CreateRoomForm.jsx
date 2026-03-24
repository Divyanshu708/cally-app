const CreateRoomForm = ({
  roomInput,
  displayName,
  setRoomInput,
  setDisplayName,
  handleCreateRoom,
}) => {
  return (
    <div className="w-full  flex flex-col justify-center items-center gap-6 ">
      <input
        type="text"
        className="border-2 border-white/30 w-full max-w-md sm:w-[70%] h-12 rounded-lg px-4 sm:px-5 font-normal text-white/70"
        placeholder="Room Name"
        value={roomInput}
        onChange={(e) => setRoomInput(e.target.value)}
        required
      ></input>
      <input
        type="text"
        className="border-2 border-white/30 w-full max-w-md sm:w-[70%] h-12 rounded-lg px-4 sm:px-5 font-normal text-white/70"
        placeholder="Display Name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        required
      ></input>
      <div className="w-full max-w-[40rem] flex justify-center px-1 sm:px-0">
        <button
          className="bg-black/40 w-full max-w-xs sm:max-w-none sm:w-1/3 border-1 border-white/10 h-11 rounded-lg cursor-pointer hover:scale-105 transition-all text-white/60"
          onClick={handleCreateRoom}
        >
          Create a Room
        </button>
      </div>
    </div>
  );
};

export default CreateRoomForm;
