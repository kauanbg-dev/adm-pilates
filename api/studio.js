import handler from "./index.js";

export default function studio(req, res) {
  req.pratiqueRoute = "/api/studio";
  return handler(req, res);
}
