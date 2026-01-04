addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

// ---------------- CONFIG ----------------
const API_URL = "https://mainserver.serv00.net/API/players.php"; // Replace with your game API URL
const ONLINE_THRESHOLD_MINUTES = 2;
const RECENT_THRESHOLD_DAYS = 7;

// Helper: Parse "YYYY-MM-DD HH:MM:SS" string to Date
function parseAPIDate(str) {
    return new Date(str + "Z"); // Treat as UTC
}

// Helper: paginate array
function paginate(arr, pageSize) {
    let pages = [];
    for (let i = 0; i < arr.length; i += pageSize) {
        pages.push(arr.slice(i, i + pageSize));
    }
    return pages;
}

// Fetch player data from API
async function fetchPlayerData() {
    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        return data;
    } catch (err) {
        console.log("API error:", err);
        return null;
    }
}

async function handleRequest(request) {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const body = await request.json();

    // Discord PING verification
    if (body.type === 1) {
        return new Response(JSON.stringify({ type: 1 }), {
            headers: { "Content-Type": "application/json" }
        });
    }

    if (body.type === 2) { // ApplicationCommand
        const command = body.data.name.toLowerCase();
        const data = await fetchPlayerData();

        if (!data) {
            return new Response(JSON.stringify({
                type: 4,
                data: { content: "❌ Unable to fetch player data." }
            }), { headers: { "Content-Type": "application/json" }});
        }

        const now = new Date();

        if (command === "online") {
            const onlinePlayers = data.filter(p => {
                if (!p.last_login) return false;
                const lastLogin = parseAPIDate(p.last_login);
                return (now - lastLogin) / 1000 / 60 <= ONLINE_THRESHOLD_MINUTES;
            }).map(p => p.username || "Unknown");

            const content = onlinePlayers.length === 0 
                ? "😴 No players online in the last 2 minutes." 
                : `🎮 Players online (last 2 minutes): **${onlinePlayers.length}**\n${onlinePlayers.join("\n")}`;

            return new Response(JSON.stringify({ type: 4, data: { content } }),
                { headers: { "Content-Type": "application/json" }});
        }

        if (command === "recent") {
            const recentPlayers = data.filter(p => {
                if (!p.last_login) return false;
                const lastLogin = parseAPIDate(p.last_login);
                return (now - lastLogin) / 1000 / 60 / 60 / 24 <= RECENT_THRESHOLD_DAYS;
            }).map(p => `${p.username || "Unknown"} (${p.last_login})`);

            if (recentPlayers.length === 0) {
                return new Response(JSON.stringify({
                    type: 4,
                    data: { content: "😴 No players played in the last 7 days." }
                }), { headers: { "Content-Type": "application/json" }});
            }

            // Paginate 10 per page
            const pages = paginate(recentPlayers, 10);
            const page = 0;
            const content = `Recent Players (Page ${page+1}/${pages.length}):\n` + pages[page].join("\n");

            return new Response(JSON.stringify({
                type: 4,
                data: {
                    content: content,
                    components: [
                        {
                            type: 1,
                            components: [
                                { type: 2, style: 2, label: "Previous", custom_id: `prev_0` },
                                { type: 2, style: 1, label: "Next", custom_id: `next_0` }
                            ]
                        }
                    ]
                }
            }), { headers: { "Content-Type": "application/json" }});
        }

        return new Response(JSON.stringify({
            type: 4,
            data: { content: "Unknown command" }
        }), { headers: { "Content-Type": "application/json" }});
    }

    return new Response("OK");
}
