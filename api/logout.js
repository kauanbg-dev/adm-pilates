import handler from "./index.js";

export default function logout(req, res) {
  req.pratiqueRoute = "/api/logout";
  return handler(req, res);
}
