const MAX_BYTES = 1024 * 1024;

function validUrl(value) {
  try {
    const u = new URL(value);
    const h = u.hostname.toLowerCase();

    if (u.protocol !== "https:" || u.username || u.password) return false;
    if (!h.includes(".") || h === "localhost" || h.endsWith(".local")) return false;
    if (h.startsWith("[") || /^\d/.test(h)) return false;

    return true;
  } catch {
    return false;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({ ok: true, service: "lugarerrado-web" });
    }

    if (url.pathname === "/api/playlist") {
      if (request.method !== "POST") {
        return Response.json({ error: "Use POST." }, { status: 405 });
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "JSON inválido." }, { status: 400 });
      }

      if (typeof body.url !== "string" || !validUrl(body.url)) {
        return Response.json(
          { error: "Informe uma URL HTTPS pública válida." },
          { status: 400 }
        );
      }

      try {
        const response = await fetch(body.url, {
          redirect: "manual",
          signal: AbortSignal.timeout(10000),
          headers: { Accept: "application/vnd.apple.mpegurl, text/plain" }
        });

        if (response.status >= 300 && response.status < 400) {
          return Response.json(
            { error: "Redirecionamentos não são aceitos." },
            { status: 400 }
          );
        }

        if (!response.ok) {
          return Response.json({ error: `HTTP ${response.status}` }, { status: 502 });
        }

        const reader = response.body?.getReader();
        if (!reader) {
          return Response.json({ error: "Resposta vazia." }, { status: 502 });
        }

        const chunks = [];
        let total = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.length;

          if (total > MAX_BYTES) {
            await reader.cancel();
            return Response.json({ error: "Playlist maior que 1 MB." }, { status: 413 });
          }

          chunks.push(value);
        }

        const bytes = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }

        const playlist = new TextDecoder().decode(bytes);

        if (!playlist.trimStart().startsWith("#EXTM3U")) {
          return Response.json(
            { error: "O endereço não retornou uma playlist M3U8 válida." },
            { status: 422 }
          );
        }

        return Response.json({ ok: true, message: "Playlist recebida.", playlist });
      } catch {
        return Response.json(
          { error: "Não foi possível buscar a playlist." },
          { status: 502 }
        );
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return Response.json({ error: "Endpoint não encontrado." }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
  }
};
