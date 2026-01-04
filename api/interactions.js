export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const body = req.body;

  // Discord PING
  if (body.type === 1) {
    return res.status(200).json({ type: 1 });
  }

  // Here you can add your /online command logic later
  return res.status(200).json({ type: 4, data: { content: "Hello from bot!" } });
}
