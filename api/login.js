import handler from "./index.js";

export default function login(req, res) {
  req.pratiqueRoute = "/api/login";
  return handler(req, res);
}
