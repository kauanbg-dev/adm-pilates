import handler from "./index.js";

export default function me(req, res) {
  req.pratiqueRoute = "/api/me";
  return handler(req, res);
}
