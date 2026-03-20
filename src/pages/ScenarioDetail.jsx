import "./ScenarioDetail.css";
import ScenarioCard from "../components/ScenarioCard";

import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import micIcon from "../assets/microphone.png";


  /*LOCAL const AI_URL = "http://localhost:3001/chat";*/
const AI_URL = `${import.meta.env.VITE_API_URL}/chat`;
const REALTIME_API_URL = import.meta.env.VITE_API_URL;

function roundMetric(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value);
}

function formatMs(value) {
  if (!Number.isFinite(value)) return "n/a";
  return `${Math.round(value)} ms`;
}

function getRatingMeta(kind) {
  if (kind === "good") {
    return { label: "OK", className: "good" };
  }

  if (kind === "warn") {
    return { label: "Pozor", className: "warn" };
  }

  return { label: "Problém", className: "bad" };
}

function assessCaptureHealth(mic) {
  if (!mic?.settings) {
    return {
      kind: "warn",
      title: "Mikrofón",
      summary: "Nemám ešte reálne audio nastavenia z prehliadača.",
      details: "Spusť hovor a skús znova otvoriť diagnostics.",
    };
  }

  const issues = [];
  const settings = mic.settings;

  if (settings.channelCount !== 1) {
    issues.push("capture nie je mono");
  }

  if (settings.echoCancellation !== true) {
    issues.push("echo cancellation nie je aktívny");
  }

  if (settings.noiseSuppression !== true) {
    issues.push("noise suppression nie je aktívny");
  }

  if (settings.autoGainControl !== true) {
    issues.push("auto gain control nie je aktívny");
  }

  if (settings.sampleRate && settings.sampleRate !== 48000) {
    issues.push(`sample rate je ${settings.sampleRate} Hz namiesto očakávaných 48000 Hz`);
  }

  if (mic.profile === "browser-default") {
    issues.push("browser odmietol preferovaný audio profil a použil defaulty");
  }

  const acquisitionMs = mic.acquisitionMs ?? null;
  if (Number.isFinite(acquisitionMs) && acquisitionMs > 1500) {
    issues.push("otvorenie mikrofónu je pomalé");
  }

  if (issues.length) {
    return {
      kind: issues.length >= 2 ? "bad" : "warn",
      title: "Mikrofón",
      summary: "Vstupný audio profil nie je úplne stabilný.",
      details: issues.join("; "),
    };
  }

  return {
    kind: "good",
    title: "Mikrofón",
    summary: "Capture profil vyzerá konzistentne.",
    details: `${mic.profile}, mono, AEC/NS/AGC zapnuté, ${settings.sampleRate || "n/a"} Hz`,
  };
}

function assessStartupHealth(diagnostics) {
  const timings = diagnostics?.timings || {};
  const stages = [
    { key: "acquisitionMs", label: "mikrofón", value: diagnostics?.mic?.acquisitionMs },
    { key: "sessionMs", label: "session backend/OpenAI", value: timings.sessionMs },
    { key: "offerMs", label: "WebRTC handshake", value: timings.offerMs },
    { key: "connectMs", label: "SDP connect", value: timings.connectMs },
  ].filter((item) => Number.isFinite(item.value));

  if (!Number.isFinite(timings.firstAudioPlaybackMs)) {
    return {
      kind: "warn",
      title: "Štart hovoru",
      summary: "Nemám ešte celý čas štartu hovoru.",
      details: "Spusť hovor a počkaj na prvú odpoveď AI.",
    };
  }

  const bottleneck = stages.sort((a, b) => b.value - a.value)[0];
  const total = timings.firstAudioPlaybackMs;

  let kind = "good";
  if (total > 4000) {
    kind = "bad";
  } else if (total > 2500) {
    kind = "warn";
  }

  return {
    kind,
    title: "Štart hovoru",
    summary: `Prvý zvuk prišiel za ${formatMs(total)}.`,
    details: bottleneck
      ? `Najväčšia brzda: ${bottleneck.label} (${formatMs(bottleneck.value)}).`
      : "Najväčšia brzda sa zatiaľ nedá určiť.",
  };
}

function assessConnectionHealth(peer) {
  const stats = peer?.stats;
  const rtt = stats?.selectedCandidatePair?.currentRoundTripTime;
  const jitter = stats?.inboundAudio?.jitter;
  const packetsLost = stats?.inboundAudio?.packetsLost ?? 0;
  const packetsReceived = stats?.inboundAudio?.packetsReceived ?? 0;
  const totalPackets = packetsLost + packetsReceived;
  const lossRate = totalPackets > 0 ? packetsLost / totalPackets : 0;

  if (!stats) {
    return {
      kind: "warn",
      title: "Sieť a WebRTC",
      summary: "Nemám ešte sieťové štatistiky.",
      details: "Počkaj, kým sa hovor spojí alebo odohrá aspoň krátka odpoveď.",
    };
  }

  const reasons = [];
  if (Number.isFinite(rtt) && rtt > 0.35) {
    reasons.push(`vysoké RTT ${Math.round(rtt * 1000)} ms`);
  }

  if (Number.isFinite(jitter) && jitter > 0.03) {
    reasons.push(`vyšší jitter ${jitter.toFixed(3)}`);
  }

  if (lossRate > 0.03 || packetsLost > 30) {
    reasons.push(`strata paketov ${Math.round(lossRate * 100)} %`);
  }

  if (peer.connectionState !== "connected" || peer.iceConnectionState !== "connected") {
    reasons.push("spojenie nie je stabilne connected");
  }

  if (reasons.length) {
    return {
      kind: reasons.length >= 2 ? "bad" : "warn",
      title: "Sieť a WebRTC",
      summary: "Spojenie môže spôsobovať trhanie alebo preskakovanie zvuku.",
      details: reasons.join("; "),
    };
  }

  return {
    kind: "good",
    title: "Sieť a WebRTC",
    summary: "Spojenie vyzerá zdravo.",
    details: `RTT ${Math.round((rtt || 0) * 1000)} ms, jitter ${(jitter || 0).toFixed(3)}, packet loss ${Math.round(lossRate * 100)} %.`,
  };
}

function assessPrewarmHealth(prewarm) {
  if (!prewarm) {
    return {
      kind: "warn",
      title: "Cold start",
      summary: "Prewarm ešte neprebehol.",
      details: "Backend sa zatiaľ nepodarilo overiť pred štartom hovoru.",
    };
  }

  if (!prewarm.ok) {
    return {
      kind: "warn",
      title: "Cold start",
      summary: "Prewarm backendu nefunguje.",
      details: "Prvý hovor po nečinnosti môže byť pomalší, lebo backend sa nezahrial vopred.",
    };
  }

  return {
    kind: "good",
    title: "Cold start",
    summary: "Prewarm funguje.",
    details: prewarm.cache?.wasWarm
      ? "Scenár bol už v cache."
      : "Scenár sa pred hovorom úspešne nahrial.",
  };
}

function buildLikelyCause(diagnostics) {
  if (diagnostics?.lastError) {
    return {
      heading: "Hlavný problém",
      text: diagnostics.lastError,
    };
  }

  const startup = diagnostics?.timings || {};
  const micAcquisitionMs = diagnostics?.mic?.acquisitionMs ?? null;
  const sessionMs = startup.sessionMs ?? null;
  const offerMs = startup.offerMs ?? null;
  const connectMs = startup.connectMs ?? null;
  const totalStartupMs = startup.firstAudioPlaybackMs ?? startup.totalStartupMs ?? null;
  const peerStats = diagnostics?.peer?.stats;
  const packetsLost = peerStats?.inboundAudio?.packetsLost ?? 0;
  const packetsReceived = peerStats?.inboundAudio?.packetsReceived ?? 0;
  const totalPackets = packetsLost + packetsReceived;
  const lossRate = totalPackets > 0 ? packetsLost / totalPackets : 0;
  const rtt = peerStats?.selectedCandidatePair?.currentRoundTripTime ?? 0;
  const jitter = peerStats?.inboundAudio?.jitter ?? 0;

  if (lossRate > 0.03 || rtt > 0.35 || jitter > 0.03) {
    return {
      heading: "Pravdepodobná príčina",
      text: "Najpravdepodobnejší problém je sieť alebo WebRTC spojenie. To vie spôsobovať trhanie, preskakovanie slabík a nestabilný hlas.",
    };
  }

  if (Number.isFinite(offerMs) && offerMs >= Math.max(sessionMs || 0, micAcquisitionMs || 0, connectMs || 0) && offerMs > 1000) {
    return {
      heading: "Pravdepodobná príčina",
      text: "Najviac času berie WebRTC handshake v zariadení/browseri. Toto spomaľuje štart hovoru, ale samo o sebe zvyčajne nevysvetľuje sekanie počas hovoru.",
    };
  }

  if (Number.isFinite(sessionMs) && sessionMs > 1000) {
    return {
      heading: "Pravdepodobná príčina",
      text: "Brzdou je štart backend session alebo cold start servera. To sa prejaví najmä pri prvom hovore po nečinnosti.",
    };
  }

  if (Number.isFinite(micAcquisitionMs) && micAcquisitionMs > 1000) {
    return {
      heading: "Pravdepodobná príčina",
      text: "Brzdou je inicializácia mikrofónu a audio session v zariadení. To je časté hlavne na mobile.",
    };
  }

  if (Number.isFinite(totalStartupMs) && totalStartupMs > 2500 && diagnostics?.prewarm?.ok === false) {
    return {
      heading: "Pravdepodobná príčina",
      text: "Hovor funguje, ale prvý štart spomaľuje cold start backendu, pretože prewarm neprešiel.",
    };
  }

  return {
    heading: "Pravdepodobná príčina",
    text: "Capture aj sieť vyzerajú zdravo. Ak aj tak počuješ preskakovanie po slovách alebo skákanie do reči, skôr ide o príliš citlivý turn detection/VAD než o sieť alebo mikrofón.",
  };
}

function getVoiceDebugEnabled() {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  return (
    params.get("voiceDebug") === "1" ||
    window.localStorage.getItem("voice_debug") === "1"
  );
}

function detectVoiceRuntime() {
  if (typeof navigator === "undefined") {
    return {
      browser: "unknown",
      platformProfile: "desktop",
      userAgent: "",
      isAndroid: false,
      isIOS: false,
      isWebKit: false,
    };
  }

  const userAgent = navigator.userAgent || "";
  const isAndroid = /Android/i.test(userAgent);
  const isIOS =
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (/Mac/i.test(navigator.platform || "") &&
      typeof navigator.maxTouchPoints === "number" &&
      navigator.maxTouchPoints > 1);
  const isWebKit = /AppleWebKit/i.test(userAgent) && !/Chrome|Chromium|CriOS|EdgiOS/i.test(userAgent);

  let browser = "unknown";
  if (/EdgA|EdgiOS|Edg\//i.test(userAgent)) {
    browser = "edge";
  } else if (/CriOS|Chrome/i.test(userAgent)) {
    browser = "chrome";
  } else if (/Safari/i.test(userAgent)) {
    browser = "safari";
  } else if (/Firefox|FxiOS/i.test(userAgent)) {
    browser = "firefox";
  }

  let platformProfile = "desktop";
  if (isIOS || isWebKit) {
    platformProfile = "ios-webkit";
  } else if (isAndroid) {
    platformProfile = "android-chromium";
  }

  return {
    browser,
    platformProfile,
    userAgent,
    isAndroid,
    isIOS,
    isWebKit,
  };
}

function buildAudioConstraintAttempts(runtime) {
  const speechFirst = {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    latency: runtime.platformProfile === "desktop" ? 0.02 : 0.04,
  };

  const conservativeMobile = {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };

  const fallbackSpeech = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };

  if (runtime.platformProfile === "ios-webkit") {
    return [
      { label: "ios-speech-safe", constraints: conservativeMobile },
      { label: "speech-safe", constraints: fallbackSpeech },
      { label: "browser-default", constraints: true },
    ];
  }

  if (runtime.platformProfile === "android-chromium") {
    return [
      { label: "android-speech-safe", constraints: speechFirst },
      { label: "speech-safe", constraints: fallbackSpeech },
      { label: "browser-default", constraints: true },
    ];
  }

  return [
    { label: "desktop-speech-safe", constraints: speechFirst },
    { label: "speech-safe", constraints: fallbackSpeech },
    { label: "browser-default", constraints: true },
  ];
}

async function waitForIceGatheringComplete(pc, timeoutMs = 1200) {
  if (pc.iceGatheringState === "complete") {
    return;
  }

  await new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve();
    }, timeoutMs);

    function handleStateChange() {
      if (pc.iceGatheringState === "complete") {
        cleanup();
        resolve();
      }
    }

    function cleanup() {
      window.clearTimeout(timeoutId);
      pc.removeEventListener("icegatheringstatechange", handleStateChange);
    }

    pc.addEventListener("icegatheringstatechange", handleStateChange);
  });
}

async function getPeerConnectionStatsSnapshot(pc) {
  if (!pc?.getStats) return null;

  const stats = await pc.getStats();
  const snapshot = {
    selectedCandidatePair: null,
    inboundAudio: null,
    outboundAudio: null,
  };

  stats.forEach((report) => {
    if (
      report.type === "candidate-pair" &&
      report.nominated &&
      (report.state === "succeeded" || report.selected)
    ) {
      snapshot.selectedCandidatePair = {
        currentRoundTripTime: report.currentRoundTripTime ?? null,
        availableOutgoingBitrate: report.availableOutgoingBitrate ?? null,
        bytesReceived: report.bytesReceived ?? null,
        bytesSent: report.bytesSent ?? null,
      };
    }

    if (report.type === "inbound-rtp" && report.kind === "audio" && !report.isRemote) {
      snapshot.inboundAudio = {
        jitter: report.jitter ?? null,
        packetsLost: report.packetsLost ?? null,
        packetsReceived: report.packetsReceived ?? null,
      };
    }

    if (report.type === "outbound-rtp" && report.kind === "audio" && !report.isRemote) {
      snapshot.outboundAudio = {
        packetsSent: report.packetsSent ?? null,
        bytesSent: report.bytesSent ?? null,
        retransmittedPacketsSent: report.retransmittedPacketsSent ?? null,
      };
    }
  });

  return snapshot;
}

async function collectMediaDeviceSummary() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];

  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.map((device) => ({
    kind: device.kind,
    label: device.label || "unlabeled",
    deviceId: device.deviceId ? "present" : "missing",
  }));
}

function normalizeVoiceError(err) {
  if (!err) return "Nepodarilo sa spustiť mikrofón";

  if (err.name === "NotAllowedError") {
    return "Prístup k mikrofónu bol zamietnutý";
  }

  if (err.name === "NotFoundError") {
    return "Nebolo nájdené žiadne vstupné audio zariadenie";
  }

  if (err.name === "NotReadableError") {
    return "Mikrofón je práve používaný inou aplikáciou alebo zariadenie nedokáže otvoriť audio vstup";
  }

  if (err.name === "OverconstrainedError") {
    return "Zariadenie nepodporuje požadovaný audio profil";
  }

  return err.message || "Nepodarilo sa spustiť mikrofón";
}

function createInitialVoiceDiagnostics() {
  return {
    runtime: null,
    prewarm: null,
    mic: null,
    timings: {},
    peer: {
      connectionState: "new",
      iceConnectionState: "new",
      iceGatheringState: "new",
      signalingState: "stable",
      stats: null,
    },
    lastError: null,
  };
}

export default function ScenarioDetail({ mobileOpen, setMobileOpen }) {
  

  const { moduleId, scenarioId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [scenario, setScenario] = useState(null);
  const [loading, setLoading] = useState(true);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  /*implementacia voice*/

  const pcRef = useRef(null);
  const audioRef = useRef(null);
  const localStreamRef = useRef(null);
  const dataChannelRef = useRef(null);
  const activeCallTokenRef = useRef(null);
  const voiceRuntimeRef = useRef(detectVoiceRuntime());

  const [inCall, setInCall] = useState(false);
  const [micError, setMicError] = useState(null);
  /*ukladanie voice do DB - v intevaloch aby bol vÄąÄľdy zapis o tom ÄąÄľe sa to stalo ig.*/
  const messagesRef = useRef([]);
  const hasSavedFinalRef = useRef(false);
  const assistantBufferRef = useRef("");
  const isStartingRef = useRef(false);
  const [voiceDebugEnabled, setVoiceDebugEnabled] = useState(getVoiceDebugEnabled);
  const [voiceDiagnostics, setVoiceDiagnostics] = useState(createInitialVoiceDiagnostics);
  const captureHealth = assessCaptureHealth(voiceDiagnostics.mic);
  const startupHealth = assessStartupHealth(voiceDiagnostics);
  const connectionHealth = assessConnectionHealth(voiceDiagnostics.peer);
  const prewarmHealth = assessPrewarmHealth(voiceDiagnostics.prewarm);
  const likelyCause = buildLikelyCause(voiceDiagnostics);




  /*const [mobileOpen, setMobileOpen] = useState(false);*/
  useEffect(() => {
    async function loadScenario() {
      console.log("Loading scenario:", scenarioId);
      try {
        const res = await api(
          `/items/scenarios/${scenarioId}?fields=id,name,age,role,image,description,tags`
        );
        setScenario(res.data);
        
      } catch (err) {
        console.error("Scenario load error", err);
      } finally {
        setLoading(false);
      }
    }

    loadScenario();
  }, [scenarioId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const runtime = detectVoiceRuntime();
    voiceRuntimeRef.current = runtime;
    setVoiceDebugEnabled(getVoiceDebugEnabled());
    setVoiceDiagnostics((prev) => ({
      ...prev,
      runtime,
    }));
  }, []);

  useEffect(() => {
    if (!scenarioId || !REALTIME_API_URL) return;

    let cancelled = false;
    const startedAt = performance.now();

    fetch(`${REALTIME_API_URL}/realtime-prewarm?scenario_id=${scenarioId}`)
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (cancelled) return;

        setVoiceDiagnostics((prev) => ({
          ...prev,
          prewarm: {
            ok: res.ok,
            status: payload.status || "unknown",
            cache: payload.cache || null,
            durationMs: roundMetric(performance.now() - startedAt),
          },
        }));
      })
      .catch((err) => {
        if (cancelled) return;
        setVoiceDiagnostics((prev) => ({
          ...prev,
          prewarm: {
            ok: false,
            status: "error",
            error: err.message,
            durationMs: roundMetric(performance.now() - startedAt),
          },
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [scenarioId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth > 768) return;

    setMobileOpen(true);

    return () => {
      setMobileOpen(false);
    };
  }, [scenarioId, setMobileOpen]);
  async function sendMessage() {
    if (!input.trim() || sending || !user) return;

    const userMessage = { role: "user", content: input };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const res = await fetch(AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_id: scenarioId,
          user_id: user.id,
          messages: nextMessages,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    } catch (err) {
      console.error("AI error", err);
    } finally {
      setSending(false);
    }
  }
  async function acquireLocalAudioStream() {
    const runtime = voiceRuntimeRef.current || detectVoiceRuntime();
    const attempts = buildAudioConstraintAttempts(runtime);
    const supportedConstraints =
      navigator.mediaDevices?.getSupportedConstraints?.() ?? null;
    let lastError = null;

    for (const attempt of attempts) {
      const startedAt = performance.now();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: attempt.constraints,
        });

        const track = stream.getAudioTracks()[0];
        if (track && "contentHint" in track) {
          track.contentHint = "speech";
        }

        const deviceSummary = await collectMediaDeviceSummary().catch(() => []);

        setVoiceDiagnostics((prev) => ({
          ...prev,
          runtime,
          mic: {
            profile: attempt.label,
            requestedConstraints:
              attempt.constraints === true ? "browser-default" : attempt.constraints,
            supportedConstraints,
            settings: track?.getSettings?.() ?? null,
            label: track?.label || "unknown",
            devices: deviceSummary,
            acquisitionMs: roundMetric(performance.now() - startedAt),
          },
          lastError: null,
        }));

        return stream;
      } catch (err) {
        lastError = err;
        console.warn(`Microphone attempt failed (${attempt.label})`, err);
      }
    }

    throw lastError;
  }

  function teardownRealtimeResources() {
    activeCallTokenRef.current = null;

    const dc = dataChannelRef.current;
    dataChannelRef.current = null;
    if (dc) {
      try {
        dc.close();
      } catch {}
    }

    const pc = pcRef.current;
    pcRef.current = null;
    if (pc) {
      try {
        pc.getSenders().forEach((sender) => sender.track?.stop());
      } catch {}
      try {
        pc.close();
      } catch {}
    }

    const localStream = localStreamRef.current;
    localStreamRef.current = null;
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    const audio = audioRef.current;
    audioRef.current = null;
    if (audio?.srcObject) {
      audio.srcObject.getTracks().forEach((track) => track.stop());
      audio.srcObject = null;
    }
    if (audio) {
      audio.pause?.();
    }

    assistantBufferRef.current = "";
  }

  async function cleanupRealtimeCall({ saveFinal = false } = {}) {
    isStartingRef.current = false;
    const activePc = pcRef.current;

    if (activePc) {
      try {
        const stats = await getPeerConnectionStatsSnapshot(activePc);
        if (stats) {
          setVoiceDiagnostics((prev) => ({
            ...prev,
            peer: {
              ...prev.peer,
              stats,
            },
          }));
        }
      } catch (err) {
        console.warn("Peer stats snapshot failed during cleanup", err);
      }
    }

    teardownRealtimeResources();
    setInCall(false);

    if (saveFinal) {
      await saveTranscript(true);
    }
  }

  useEffect(() => {
    function handleForceStop() {
      cleanupRealtimeCall({ saveFinal: false }).catch((err) => {
        console.error("Realtime cleanup error", err);
      });
    }

    window.addEventListener("force-stop-realtime", handleForceStop);
    window.addEventListener("pagehide", handleForceStop);

    return () => {
      window.removeEventListener("force-stop-realtime", handleForceStop);
      window.removeEventListener("pagehide", handleForceStop);
      handleForceStop();
    };
  }, []);

  async function startRealtimeCall() {
    if (isStartingRef.current) return;

    teardownRealtimeResources();
    setInCall(false);
    setMicError(null);
    isStartingRef.current = true;
    const startedAt = performance.now();
    const runtime = voiceRuntimeRef.current || detectVoiceRuntime();

    setVoiceDiagnostics((prev) => ({
      ...createInitialVoiceDiagnostics(),
      runtime,
      prewarm: prev.prewarm,
    }));

    const callToken = Symbol("realtime-call");
    activeCallTokenRef.current = callToken;

    if (inCall) {
      isStartingRef.current = false;
      return;
    }

    try {
      const sessionStartedAt = performance.now();
      const sessionPromise = fetch(`${REALTIME_API_URL}/realtime-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario_id: scenarioId }),
      });
      const streamPromise = acquireLocalAudioStream();

      const [sessionResult, streamResult] = await Promise.allSettled([
        sessionPromise,
        streamPromise,
      ]);

      if (streamResult.status === "rejected") {
        throw streamResult.reason;
      }

      const stream = streamResult.value;
      localStreamRef.current = stream;

      if (sessionResult.status === "rejected") {
        stream.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
        throw sessionResult.reason;
      }

      const sessionRes = sessionResult.value;
      const session = await sessionRes.json();
      if (!sessionRes.ok) throw new Error(session.error);
      if (activeCallTokenRef.current !== callToken) return;

      setVoiceDiagnostics((prev) => ({
        ...prev,
        timings: {
          ...prev.timings,
          sessionMs: roundMetric(performance.now() - sessionStartedAt),
          totalStartupMs: roundMetric(performance.now() - startedAt),
        },
      }));

      // 2ÄŹÂ¸ĹąWebRTC peer
      const pc = new RTCPeerConnection({
        bundlePolicy: "max-bundle",
        iceCandidatePoolSize: 1,
        iceServers: [
          { urls: "stun:stun.cloudflare.com:3478" },
          { urls: "stun:stun.l.google.com:19302" },
        ],
      });
      pcRef.current = pc;

      pc.addEventListener("connectionstatechange", async () => {
        setVoiceDiagnostics((prev) => ({
          ...prev,
          peer: {
            ...prev.peer,
            connectionState: pc.connectionState,
          },
        }));

        if (pc.connectionState === "connected") {
          try {
            const stats = await getPeerConnectionStatsSnapshot(pc);
            if (stats) {
              setVoiceDiagnostics((prev) => ({
                ...prev,
                peer: {
                  ...prev.peer,
                  stats,
                },
              }));
            }
          } catch (err) {
            console.warn("Peer stats snapshot failed", err);
          }
        }
      });

      pc.addEventListener("iceconnectionstatechange", () => {
        setVoiceDiagnostics((prev) => ({
          ...prev,
          peer: {
            ...prev.peer,
            iceConnectionState: pc.iceConnectionState,
          },
        }));
      });

      pc.addEventListener("icegatheringstatechange", () => {
        setVoiceDiagnostics((prev) => ({
          ...prev,
          peer: {
            ...prev.peer,
            iceGatheringState: pc.iceGatheringState,
          },
        }));
      });

      pc.addEventListener("signalingstatechange", () => {
        setVoiceDiagnostics((prev) => ({
          ...prev,
          peer: {
            ...prev.peer,
            signalingState: pc.signalingState,
          },
        }));
      });

      // Data channel pre textovÄ‚Â© eventy
      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;

      dc.onopen = () => {
        setVoiceDiagnostics((prev) => ({
          ...prev,
          timings: {
            ...prev.timings,
            dataChannelOpenMs: roundMetric(performance.now() - startedAt),
          },
        }));
      };

      dc.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "response.created") {
          assistantBufferRef.current = "";
        }

        if (data.type === "conversation.item.input_audio_transcription.completed") {
          const userText = data.transcript;

          setMessages((prev) => {
            const updated = [...prev, { role: "user", content: userText }];
            messagesRef.current = updated;
            return updated;
          });
        }

        if (data.type === "response.audio_transcript.delta") {
          const d = data.delta ?? "";
          if (d.trim().length === 0) return;
          assistantBufferRef.current += d;
        }

        if (data.type === "response.audio_transcript.done") {
          const text = assistantBufferRef.current.trim();

          if (text) {
            setMessages((prev) => {
              const updated = [...prev, { role: "assistant", content: text }];
              messagesRef.current = updated;
              return updated;
            });
          }

          assistantBufferRef.current = "";
        }

        if (data.type === "response.done") {
          const last = messagesRef.current[messagesRef.current.length - 1];
          const normalizedLast = last?.content
            ?.toLowerCase()
            ?.normalize("NFD")
            ?.replace(/[\u0300-\u036f]/g, "");
          if (normalizedLast?.includes("spatna vazba:")) {
            saveTranscript(true);
          }
        }
      };

      // 3ÄŹÂ¸Ĺąaudio vÄ‚Ëťstup
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.preload = "auto";
      audio.defaultPlaybackRate = 1;
      audio.playbackRate = 1;
      audio.preservesPitch = true;
      audio.mozPreservesPitch = true;
      audio.webkitPreservesPitch = true;
      audio.playsInline = true;
      audio.setAttribute("playsinline", "true");
      audio.setAttribute("webkit-playsinline", "true");
      if ("disableRemotePlayback" in audio) {
        audio.disableRemotePlayback = true;
      }
      audioRef.current = audio;

      pc.ontrack = async (e) => {
        if (activeCallTokenRef.current !== callToken) {
          e.streams[0]?.getTracks().forEach((track) => track.stop());
          return;
        }

        audio.srcObject = e.streams[0];
        setVoiceDiagnostics((prev) => ({
          ...prev,
          timings: {
            ...prev.timings,
            remoteTrackMs: roundMetric(performance.now() - startedAt),
          },
        }));

        try {
          audio.muted = false;
          audio.volume = 1;
          await audio.play();
          setVoiceDiagnostics((prev) => ({
            ...prev,
            timings: {
              ...prev.timings,
              firstAudioPlaybackMs: roundMetric(performance.now() - startedAt),
            },
          }));
        } catch (err) {
          console.error("Audio play blocked:", err);
        }
      };

      if (activeCallTokenRef.current !== callToken) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // 5ÄŹÂ¸ĹąSDP offer
      const offerStartedAt = performance.now();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGatheringComplete(pc);
      setVoiceDiagnostics((prev) => ({
        ...prev,
        timings: {
          ...prev.timings,
          offerMs: roundMetric(performance.now() - offerStartedAt),
          totalStartupMs: roundMetric(performance.now() - startedAt),
        },
      }));

      // NEW Ă˘â‚¬â€ť proxy cez backend (bez CORS)
      const connectStartedAt = performance.now();
      const sdpRes = await fetch(
        `${REALTIME_API_URL}/realtime-connect?model=${session.model}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/sdp",
            Authorization: `Bearer ${session.client_secret.value}`,
          },
          body: pc.localDescription?.sdp || offer.sdp,
        }
      );

      const sdpText = await sdpRes.text();
      if (!sdpRes.ok) throw new Error(sdpText);
      if (activeCallTokenRef.current !== callToken) return;

      const answer = {
        type: "answer",
        sdp: sdpText,
      };

      await pc.setRemoteDescription(answer);
      if (activeCallTokenRef.current !== callToken) return;

      setVoiceDiagnostics((prev) => ({
        ...prev,
        timings: {
          ...prev.timings,
          connectMs: roundMetric(performance.now() - connectStartedAt),
          totalStartupMs: roundMetric(performance.now() - startedAt),
        },
      }));

      setInCall(true);
      hasSavedFinalRef.current = false;
    } catch (err) {
      console.error("Ä‚ËÄąÄ„ÄąĹˇ Realtime start error:", err);
      const normalizedError = normalizeVoiceError(err);
      setMicError(normalizedError);
      setVoiceDiagnostics((prev) => ({
        ...prev,
        lastError: normalizedError,
        timings: {
          ...prev.timings,
          totalStartupMs: roundMetric(performance.now() - startedAt),
        },
      }));
      teardownRealtimeResources();
      setInCall(false);
    } finally {
      isStartingRef.current = false;
    }
  }
  async function saveTranscript(isFinal = false) {
    try {
      if (!messagesRef.current.length) return;

      // Ă˘ĹĄâ€” iba finÄ‚Ë‡lny save mÄ‚Ë‡ Ä‚Â­sÄąÄ„ do DB
      if (!isFinal) return;

      // zabrÄ‚Ë‡ni dvojitÄ‚Â©mu zÄ‚Ë‡pisu
      if (hasSavedFinalRef.current) return;
// LOCAL : await fetch("http://localhost:3001/save-realtime-transcript"
      await fetch(`${import.meta.env.VITE_API_URL}/save-realtime-transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_id: scenarioId,
          user_id: user.id,
          messages: messagesRef.current,
        }),
      });

      hasSavedFinalRef.current = true;

    } catch (err) {
      console.error("Transcript save error", err);
    }
  }



  function stopRealtimeCall() {
    cleanupRealtimeCall({ saveFinal: true }).catch((err) => {
      console.error("Realtime stop error", err);
    });
  }
  if (loading || !scenario) return null;

  return (
    <div className={`scenario-page ${mobileOpen ? "mobile-open" : ""}`}>
      {/* MOBILE HEADER */}
      

      {/* OVERLAY */}
      <div
        className="drawer-overlay"
        onClick={() => setMobileOpen(false)}
      />

      {/* MOBILE DRAWER */}
      <aside className="scenario-drawer">
        <button
          className="scenario-back"
          onClick={() => navigate(`/modules/${moduleId}`)}
        >
          &lt; Späť na scenáre
        </button>

        <ScenarioCard scenario={scenario} showDescription />
      </aside>

      {/* DESKTOP LAYOUT */}
      <div className="scenario-layout">
        <aside className="scenario-info desktop-only">
          <button
            className="scenario-back"
            onClick={() => navigate(`/modules/${moduleId}`)}
          >
            &lt; Späť na scenáre
          </button>

          <ScenarioCard scenario={scenario} showDescription />
        </aside>

        <div className="scenario-voice">
          {/* OLD CHAT
          <div className="chat">
            
            {messages.map((m, i) => (
              <div key={i}>
                <strong>{m.role === "user" ? "Vy" : scenario.name}:</strong>
                <div>{m.content}</div>
              </div>
            ))}
              
          </div>*/}

          {/* OLD CHAT
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            disabled={sending}
          />

          <button onClick={sendMessage} disabled={sending}>
            {sending ? "AI odpovedÄ‚Ë‡Ă˘â‚¬Â¦" : "OdoslaÄąÄ„"}
          </button>
           */}
           <div className="voice-controls">

  {/* INFO pred prvÄ‚Ëťm povolenÄ‚Â­m mikrofÄ‚Ĺ‚nu */}
  {micError && (
  <div className="mic-hint-pristup">
    Aplikácia potrebuje prístup k mikrofónu, aby ste mohli začať rozhovor. Prosím, povoľte prístup a skúste to znovu.
  </div>
)}


  {/* HLAVNÄ‚ĹĄ KRUHOVÄ‚ĹĄ BUTTON */}
  <div className="mic-wrapper">
  <button
    className={`mic-button ${inCall ? "active" : ""}`}
    onClick={inCall ? stopRealtimeCall : startRealtimeCall}
  >
    <div className="mic-content">
      <img src={micIcon} alt="MikrofĂłn" className="mic-icon-img" />
      <span className="mic-text">
      {inCall ? (
        <>
          Ukončiť<br /> rozhovor
        </>
      ) : (
        <>
          Začať <br /> rozhovor
        </>
      )}
    </span>

    </div>
  </button>

  {!inCall && (
    <div className="mic-hint-text">

      Po stlačení mikrofónu sa spustí voice chat.
      Začnite ho pozdravom.
    </div>
  )}
</div>


  {/* CHYBA */}
  {micError && (
    <div className="voice-error">
      {micError}
    </div>
  )}

  {voiceDebugEnabled && (
    <div className="voice-diagnostics">
      <strong>Voice diagnostics</strong>

      <div className="voice-diagnostics-summary">
        <div className="voice-diagnostics-lead">
          <span className="voice-diagnostics-lead-title">{likelyCause.heading}</span>
          <p>{likelyCause.text}</p>
        </div>

        {[captureHealth, startupHealth, connectionHealth, prewarmHealth].map((item) => {
          const rating = getRatingMeta(item.kind);

          return (
            <div key={item.title} className="voice-diagnostics-card">
              <div className="voice-diagnostics-card-top">
                <span className="voice-diagnostics-card-title">{item.title}</span>
                <span className={`voice-diagnostics-badge ${rating.className}`}>
                  {rating.label}
                </span>
              </div>
              <p className="voice-diagnostics-card-summary">{item.summary}</p>
              <p className="voice-diagnostics-card-detail">{item.details}</p>
            </div>
          );
        })}

        <details className="voice-diagnostics-raw">
          <summary>Surové dáta</summary>
          <pre>{JSON.stringify(voiceDiagnostics, null, 2)}</pre>
        </details>
      </div>
    </div>
  )}

</div>



        </div>
      </div>
    </div>
  );
}

