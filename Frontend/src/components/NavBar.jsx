import cally from "../assets/CaLLY_logo.svg";
import userLogo from "../assets/UserLogo.svg";

function NavBar() {
  return (
    <>
      <div className="flex justify-between items-center py-3 relative top-0 w-full">
        <img
          src={cally}
          alt="CaLLY Logo"
          className="px-10 cursor-pointer scale-80"
        />
        <img
          src={userLogo}
          alt="User Logo"
          className=" cursor-pointer scale-80 hover:scale-90 transition-all duration-200 px-10 "
        />
      </div>
      <hr className="navHr opacity-20" />
    </>
  );
}

export default NavBar;
