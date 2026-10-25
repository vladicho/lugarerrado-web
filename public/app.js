const form = document.querySelector("#download-form");
const urlInput = document.querySelector("#url");
const sourceSelect = document.querySelector("#source");
const openButton = document.querySelector("#open-site");
const downloadButton = document.querySelector("#download");
const statusText = document.querySelector("#status");
const progress = document.querySelector("#progress");
const playerSection = document.querySelector("#player-section");
const player = document.querySelector("#player");

let hls = null;

function setStatus(message, value = 0) {
  statusText.textContent = message;
  progress.value = value;
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isYouTubeUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();

    return (
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtu.be"
    );
  } catch {
    return false;
  }
}

function stopPlayer() {
  if (hls) {
    hls.destroy();
    hls = null;
  }

  player.pause();
  player.removeAttribute("src");
  player.load();
  playerSection.hidden = true;
}

function updatePlaceholder() {
  urlInput.placeholder =
    sourceSelect.value === "youtube"
      ? "Cole o link do YouTube"
      : "Cole o link HTTPS da playlist .m3u8";
}

function playM3U8(url) {
  stopPlayer();
  playerSection.hidden = false;

  if (player.canPlayType("application/vnd.apple.mpegurl")) {
    player.src = url;
    player.load();
    player.play().catch(() => {
      setStatus("Playlist carregada. Aperte Reproduzir no player.");
    });
    setStatus("Playlist carregada no player.", 100);
    return;
  }

  if (window.Hls && Hls.isSupported()) {
    hls = new Hls();

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        setStatus(
          "Não foi possível reproduzir a playlist. Ela pode exigir acesso autorizado ou permitir apenas certos servidores."
        );
      }
    });

    hls.loadSource(url);
    hls.attachMedia(player);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setStatus("Vídeo pronto. Aperte Reproduzir no player.", 100);
    });

    return;
  }

  setStatus("Este navegador não oferece suporte à reprodução HLS.");
}

sourceSelect.addEventListener("change", () => {
  stopPlayer();
  updatePlaceholder();
  setStatus("Selecione um link para continuar.");
});

updatePlaceholder();

openButton.addEventListener("click", () => {
  const value = urlInput.value.trim();

  if (!isHttpsUrl(value)) {
    setStatus("Digite um link HTTPS válido.");
    return;
  }

  if (sourceSelect.value === "youtube" && !isYouTubeUrl(value)) {
    setStatus("Esse link não parece ser do YouTube.");
    return;
  }

  window.open(value, "_blank", "noopener,noreferrer");
  setStatus("Link aberto em outra aba.");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const value = urlInput.value.trim();
  stopPlayer();

  if (!isHttpsUrl(value)) {
    setStatus("Digite um link HTTPS válido.");
    return;
  }

  if (sourceSelect.value === "youtube") {
    if (!isYouTubeUrl(value)) {
      setStatus("Cole um link válido do YouTube.");
      return;
    }

    setStatus(
      "Link do YouTube reconhecido. O download não está implementado; use Abrir link para assistir."
    );
    return;
  }

  if (!/\.m3u8(?:$|[?#])/i.test(value)) {
    setStatus("O link precisa apontar para uma playlist .m3u8.");
    return;
  }

  downloadButton.disabled = true;
  setStatus("Verificando a playlist M3U8...");

  try {
    const response = await fetch("/api/playlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: value })
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Falha ao verificar a playlist.");
    }

    setStatus("Playlist válida. Preparando reprodução...", 100);
    playM3U8(value);
  } catch (error) {
    setStatus(error.message || "Erro ao comunicar com o servidor.");
  } finally {
    downloadButton.disabled = false;
  }
});

urlInput.addEventListener("input", stopPlayer);
