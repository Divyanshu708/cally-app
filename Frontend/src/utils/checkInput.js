import { toast } from "react-toastify";

function checkInputs(state, msg) {
  if (state === "") {
    toast.error(msg);
    return false;
  }
  return true;
}
export default checkInputs;
