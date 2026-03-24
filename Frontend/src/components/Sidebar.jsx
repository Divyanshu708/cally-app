import chatLogo from "../assets/Chat.svg";
import createNew from "../assets/createNew.svg";
import groupLogo from "../assets/Group.svg";
import notificationBell from "../assets/notificationBell.svg";
import settingsLogo from "../assets/settings.svg";
import historyLogo from "../assets/History.svg";

function Sidebar() {
  return (
    <div className="h-[80%] w-17 bg-black/30 relative top-[4rem] rounded-r-2xl border-t-1 border-r-1 border-b-1 border-white/10 flex flex-col items-center justify-around">
      <img
        src={createNew}
        alt="Create New"
        className="scale-80 cursor-pointer transition-all duration-200 hover:scale-87"
      />
      <img
        src={historyLogo}
        alt="History Logo"
        className="scale-70 cursor-pointer transition-all duration-200 hover:scale-77"
      />
      <img
        src={chatLogo}
        alt="Chat Logo"
        className="scale-70 cursor-pointer transition-all duration-200 hover:scale-77"
      />
      <img
        src={groupLogo}
        alt="Group Logo"
        className="scale-78 cursor-pointer transition-all duration-200 hover:scale-85"
      />
      <img
        src={notificationBell}
        alt="Notification Bell"
        className="scale-80 cursor-pointer transition-all duration-200 hover:scale-87"
      />
      <img
        src={settingsLogo}
        alt="Settings Logo"
        className="scale-65 cursor-pointer transition-all duration-200 hover:scale-72"
      />
    </div>
  );
}

export default Sidebar;
