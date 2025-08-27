export function generateJoinCode(len = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyz";

  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }

  return out;
}
