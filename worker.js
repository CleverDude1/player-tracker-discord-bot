import nacl from "tweetnacl";

const API_URL = "https://mainserver.serv00.net/API/players.php";
const ONLINE_MINUTES = 2;

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // ---- Discord signature headers ----
    const signature = request.headers.get("X-Signature-Ed25519");
    const timestamp = request.headers.get("X-Signature-Timestamp");

    if (!signature || !timestamp) {
      return new Response("Missing signature", { status: 401 });
    }

    const body = await request.clone().arrayBuffer();

    // ---- Verify request ----
    const isValid = nacl.sign.detached.verify(
      new Uint8Array([
        ...new TextEncoder().encode(timestamp),
        ...new Uint8Array(body)
      ]),
      hexToUint8(signature),
      hexToUint8(env.DISCORD_PUBLIC_KEY)
    );

    if (!isValid) {
      return new Response("Invalid signature", { status: 401 });
    }

    const interaction = JSON.parse(new TextDecoder().decode(body));

    // ---- Discord ping ----
    if (interaction.type === 1) {
      return json({ type: 1 });
    }

    // ---- Slash command ----
    if (interaction.type === 2) {
      const command = interaction.data.name.toLowerCase();

      if (command === "online") {
        const players = await fetchPlayers();

        if (!players) {
          return reply("❌ Failed to fetch player data.");
        }

        const now = new Date();
        const online = players.filter(p => {
          if (!p.last_login) return false;
          const last = new Date(p.last_login + "Z");
          return (now - last) / 60000 <= ONLINE_MINUTES;
        });

        if (online.length === 0) {
          return reply("😴 No players online in the last 2 minutes.");
        }

        const names = online.map(p => p.username).join("\n");

        return reply(
          `🎮 **${online.length} players online** (last 2 minutes):\n${names}`
        );
      }
    }

    return new Response("Unhandled interaction", { status: 400 });
  }
};

// ---------------- HELPERS ----------------

async function fetchPlayers() {
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
    data: { content }
  });
}

function json(data) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" }
  });
}

function hexToUint8(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
}
