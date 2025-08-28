import { setup, getLegalMoves, applyMove, makeRNG } from "./index";

const s1 = setup();
console.log("Initial:", s1);
const rng = makeRNG("dev-seed");
const moves = getLegalMoves(s1);
console.log("Legal moves:", moves.slice(0, 5), "...");
const m = moves.find((x) => x.type === "MOVE");
if (m && m.type === "MOVE") {
  const s2 = applyMove(s1, m, rng);
  console.log("After one move:", s2);
}
