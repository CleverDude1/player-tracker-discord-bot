import nacl from "tweetnacl";

/* ================= CONFIG ================= */
const API_URL = "https://mainserver.serv00.net/DiscordbotAPI/API.php"; // Light API URL

/* =============== MAIN HANDLER ============== */
export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // ----- Discord signature headers -----
    const signature = request.headers.get("X-Signature-Ed25519");
    const timestamp = request.headers.get("X-Signature-Timestamp");

    if (!signature || !timestamp) {
      return new Response("Missing signature", { status: 401 });
    }

    const body = await request.clone().arrayBuffer();

    // ----- Verify Discord request -----
    const isValid = nacl.sign.detached.verify(
      new Uint8Array([
        ...new TextEncoder().encode(timestamp),
        ...new Uint8Array(body),
      ]),
      hexToUint8(signature),
      hexToUint8(env.DISCORD_PUBLIC_KEY)
    );

    if (!isValid) {
      return new Response("Invalid signature", { status: 401 });
    }

    const interaction = JSON.parse(new TextDecoder().decode(body));

    /* ---------- Discord PING ---------- */
    if (interaction.type === 1) {
      return json({ type: 1 });
    }

    /* ---------- Slash Commands ---------- */
    if (interaction.type === 2) {
      const command = interaction.data.name.toLowerCase();

      if (command !== "online") {
        return reply("❓ Unknown command.");
      }

      // Fetch online players directly from light API
      const players = await fetchPlayerData();
      if (!players) {
        return reply("❌ Unable to fetch online players.");
      }

      if (players.length === 0) {
        return reply("😴 No players online right now.");
      }

      // Build message
      const content = `🎮 **${players.length} players online:**\n` +
        players.map(p => p.nickname || "Unknown").join("\n");

      return reply(content);
    }

    return new Response("Unhandled interaction", { status: 400 });
  },
};

/* ================= HELPERS ================= */

async function fetchPlayerData() {
  try {
    const res = await fetch(API_URL);
    return await res.json();
  } catch {
    return null;
  }
}

function reply(content) {
  return json({
    type: 4,
    data: { content },
  });
}

function json(data) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
}

function hexToUint8(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
}
