import nacl from "tweetnacl";

/* ================= CONFIG ================= */
const API_URL = "https://mainserver.serv00.net/API/players.php";
const ONLINE_THRESHOLD_MINUTES = 2;
const RECENT_THRESHOLD_DAYS = 7;

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
      const players = await fetchPlayerData();

      if (!players) {
        return reply("❌ Unable to fetch player data.");
      }

      const now = new Date();

      if (command === "online") {
        const online = players.filter((p) => {
          const last = parseAPIDate(p.last_login);
          if (!last) return false; // skip invalid dates
          return (now - last) / 60000 <= ONLINE_THRESHOLD_MINUTES;
        });

        if (online.length === 0) {
          return reply("😴 No players online in the last 2 minutes.");
        }

        return reply(
          `🎮 **${online.length} players online** (last 2 minutes):\n` +
            online.map((p) => p.nickname || "Unknown").join("\n")
        );
      }

      if (command === "recent") {
        const recent = players.filter((p) => {
          const last = parseAPIDate(p.last_login);
          if (!last) return false; // skip invalid dates
          return (now - last) / 86400000 <= RECENT_THRESHOLD_DAYS;
        });

        if (recent.length === 0) {
          return reply("😴 No players played in the last 7 days.");
        }

        const page = recent.slice(0, 10).map(
          (p) => `${p.nickname || "Unknown"} (${p.last_login})`
        );

        return json({
          type: 4,
          data: {
            content: `🕒 **Recent Players (last 7 days)**\n` + page.join("\n"),
          },
        });
      }

      return reply("❓ Unknown command.");
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

function parseAPIDate(str) {
  if (!str || str === "0000-00-00 00:00:00") return null;
  return new Date(str.replace(" ", "T") + "Z");
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
  return new Uint8Array(hex.match(/.{1,2}/g).map((b) => parseInt(b, 16)));
}
