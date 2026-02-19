import "./ScenarioDetail.css";
import ScenarioCard from "../components/ScenarioCard";

import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import micIcon from "../assets/microphone.png";



const AI_URL = "http://localhost:3001/chat";

export default function ScenarioDetail({ mobileOpen, setMobileOpen }) {
  console.log("ScenarioDetail mobileOpen:", mobileOpen);

  const { moduleId, scenarioId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [scenario, setScenario] = useState(null);
  const [loading, setLoading] = useState(true);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  /*implementacia voice*/
  const [micPermissionAsked, setMicPermissionAsked] = useState(false);

  const pcRef = useRef(null);
  const audioRef = useRef(null);

  const [inCall, setInCall] = useState(false);
  const [micError, setMicError] = useState(null);
  /*ukladanie voice do DB - v intevaloch aby bol vždy zapis o tom že sa to stalo ig.*/
  const messagesRef = useRef([]);
  const hasSavedFinalRef = useRef(false);
  const assistantBufferRef = useRef("");
  const isStartingRef = useRef(false);




  /*const [mobileOpen, setMobileOpen] = useState(false);*/
  useEffect(() => {
    async function loadScenario() {
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
// voice funkcia a vypitanie povolenia na pouzitie mikrofonu 
  async function requestMicrophonePermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // okamžite zastavíme – ide nám len o permission
    stream.getTracks().forEach((t) => t.stop());

    return true;
  } catch (err) {
    console.error("Mic permission error:", err);
    setMicError("Prístup k mikrofónu bol zamietnutý");
    return false;
  }
}

  async function startRealtimeCall() {
    if (pcRef.current) {
  pcRef.current.close();
  pcRef.current = null;
}

    if (isStartingRef.current) return;
isStartingRef.current = true;

  // 👇 nový permission krok
  if (!micPermissionAsked) {
    const ok = await requestMicrophonePermission();
    setMicPermissionAsked(true);

    if (!ok) return;
  }

  
  if (inCall) return;

  try {
    // 1️vytvor realtime session
    const sessionRes = await fetch(
      "http://localhost:3001/realtime-session",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario_id: scenarioId }),
      }
    );

    const session = await sessionRes.json();
    if (!sessionRes.ok) throw new Error(session.error);

    // 2️WebRTC peer
    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    // Data channel pre textové eventy
    const dc = pc.createDataChannel("oai-events");
    


dc.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Realtime event:", data.type);

  if (data.type?.includes("failed")) {
  console.log("FAILED EVENT FULL:", data);
}

  // =========================
  // reset buffer na začiatku odpovede
  // =========================
  if (data.type === "response.created") {
    assistantBufferRef.current = "";
  }

  // =========================
  // USER TRANSCRIPT
  // =========================
  if (data.type === "conversation.item.input_audio_transcription.completed") {
    const userText = data.transcript;

    setMessages(prev => {
      const updated = [...prev, { role: "user", content: userText }];
      messagesRef.current = updated;
      return updated;
    });
  }

  // =========================
  // ASSISTANT DELTA STREAM (buffer)
  // =========================
  if (data.type === "response.audio_transcript.delta"){
    const d = data.delta ?? "";
    if (d.trim().length === 0) return;
    assistantBufferRef.current += d;
  }

  // =========================
  // ASSISTANT TRANSCRIPT DONE → vlož správu
  // =========================
  if (data.type === "response.audio_transcript.done")
{
    const text = assistantBufferRef.current.trim();

    if (text) {
      setMessages(prev => {
        const updated = [...prev, { role: "assistant", content: text }];
        messagesRef.current = updated;
        return updated;
      });
    }

    assistantBufferRef.current = "";
  }

  // =========================
  // RESPONSE DONE → ak je feedback, uložiť do DB
  // =========================
  if (data.type === "response.done") {
    const last = messagesRef.current[messagesRef.current.length - 1];
    if (last?.content?.toLowerCase().includes("spätná väzba:")) {
      saveTranscript(true);
    }
  }
};




    // 3️audio výstup
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audioRef.current = audio;

    pc.ontrack = async (e) => {
      console.log("🎧 Audio track received");

      audio.srcObject = e.streams[0];

      try {
        audio.muted = false;
        audio.volume = 1;
        await audio.play();
        console.log("▶ Audio playing");
      } catch (err) {
        console.error("Audio play blocked:", err);
      }
    };


    // 4️mic vstup
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    stream.getTracks().forEach((track) =>
      pc.addTrack(track, stream)
    );

    // 5️SDP offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // 6️pošli SDP priamo OpenAI `https://api.openai.com/v1/realtime?model=${session.model}`,
    const sdpRes = await fetch(
      `https://api.openai.com/v1/realtime`,
      {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${session.client_secret.value}`,
          "Content-Type": "application/sdp",
        },
      }
    );

    const answer = {
      type: "answer",
      sdp: await sdpRes.text(),
    };

    await pc.setRemoteDescription(answer);


    setInCall(true);
    isStartingRef.current = false;


    // reset flag
    hasSavedFinalRef.current = false;

    

  } catch (err) {
  console.error("❌ Realtime start error:", err);
  setMicError(err?.message || "Nepodarilo sa spustiť mikrofón");
  isStartingRef.current = false;

  }

}
  // 🔥 ULOŽENIE TRANSCRIPTU (autosave + final)
  async function saveTranscript(isFinal = false) {
    try {
      if (!messagesRef.current.length) return;

      // ❗ iba finálny save má ísť do DB
      if (!isFinal) return;

      // zabráni dvojitému zápisu
      if (hasSavedFinalRef.current) return;

      await fetch("http://localhost:3001/save-realtime-transcript", {
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
  pcRef.current?.close();
  pcRef.current = null;

  if (audioRef.current?.srcObject) {
    audioRef.current.srcObject
      .getTracks()
      .forEach((t) => t.stop());
  }

  setInCall(false);


  // finálne uloženie
  saveTranscript(true);
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
          ← Späť
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
            &lt; Naspäť na scenáre
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
            {sending ? "AI odpovedá…" : "Odoslať"}
          </button>
           */}
           <div className="voice-controls">

  {/* INFO pred prvým povolením mikrofónu */}
{micError && (
  <div className="mic-hint-pristup">
    Aplikácia potrebuje prístup k mikrofónu.
  </div>
)}


  {/* HLAVNÝ KRUHOVÝ BUTTON */}
  <div className="mic-wrapper">
  <button
    className={`mic-button ${inCall ? "active" : ""}`}
    onClick={inCall ? stopRealtimeCall : startRealtimeCall}
  >
    <div className="mic-content">
      <img src={micIcon} alt="Mikrofón" className="mic-icon-img" />
      <span className="mic-text">
      {inCall ? (
        <>
          Ukončiť <br /> rozhovor
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

</div>



        </div>
      </div>
    </div>
  );
}
