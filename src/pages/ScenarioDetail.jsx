import "./ScenarioDetail.css";
import ScenarioCard from "../components/ScenarioCard";

import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import micIcon from "../assets/microphone.png";


  /*LOCAL const AI_URL = "http://localhost:3001/chat";*/
const AI_URL = `${import.meta.env.VITE_API_URL}/chat`;

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
  const [micPermissionAsked, setMicPermissionAsked] = useState(false);

  const pcRef = useRef(null);
  const audioRef = useRef(null);
  const localStreamRef = useRef(null);
  const dataChannelRef = useRef(null);
  const activeCallTokenRef = useRef(null);

  const [inCall, setInCall] = useState(false);
  const [micError, setMicError] = useState(null);
  /*ukladanie voice do DB - v intevaloch aby bol vĹľdy zapis o tom Ĺľe sa to stalo ig.*/
  const messagesRef = useRef([]);
  const hasSavedFinalRef = useRef(false);
  const assistantBufferRef = useRef("");
  const isStartingRef = useRef(false);




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

    // okamĹľite zastavĂ­me â€“ ide nĂˇm len o permission
    stream.getTracks().forEach((t) => t.stop());

    return true;
  } catch (err) {
    console.error("Mic permission error:", err);
    setMicError("Prístup k mikrofónu bol zamietnutý");
    return false;
  }
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

    const callToken = Symbol("realtime-call");
    activeCallTokenRef.current = callToken;

    // đź‘‡ novĂ˝ permission krok
    if (!micPermissionAsked) {
      const ok = await requestMicrophonePermission();
      setMicPermissionAsked(true);

      if (!ok) {
        isStartingRef.current = false;
        activeCallTokenRef.current = null;
        return;
      }
    }

    if (inCall) {
      isStartingRef.current = false;
      return;
    }

    try {
      // 1ď¸Źvytvor realtime session
      // LOCAL :  "http://localhost:3001/realtime-session",
      const sessionRes = await fetch(
        `${import.meta.env.VITE_API_URL}/realtime-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario_id: scenarioId }),
        }
      );

      const session = await sessionRes.json();
      if (!sessionRes.ok) throw new Error(session.error);
      if (activeCallTokenRef.current !== callToken) return;

      // 2ď¸ŹWebRTC peer
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Data channel pre textovĂ© eventy
      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;

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

      // 3ď¸Źaudio vĂ˝stup
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audioRef.current = audio;

      pc.ontrack = async (e) => {
        if (activeCallTokenRef.current !== callToken) {
          e.streams[0]?.getTracks().forEach((track) => track.stop());
          return;
        }

        audio.srcObject = e.streams[0];

        try {
          audio.muted = false;
          audio.volume = 1;
          await audio.play();
        } catch (err) {
          console.error("Audio play blocked:", err);
        }
      };

      // 4ď¸Źmic vstup
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      localStreamRef.current = stream;

      if (activeCallTokenRef.current !== callToken) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // 5ď¸ŹSDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // NEW â€” proxy cez backend (bez CORS)
      const sdpRes = await fetch(
        `${import.meta.env.VITE_API_URL}/realtime-connect?model=${session.model}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/sdp",
            Authorization: `Bearer ${session.client_secret.value}`,
          },
          body: offer.sdp,
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

      setInCall(true);
      hasSavedFinalRef.current = false;
    } catch (err) {
      console.error("Ă˘ĹĄĹš Realtime start error:", err);
      setMicError(err?.message || "Nepodarilo sa spustiť mikrofón");
      teardownRealtimeResources();
      setInCall(false);
    } finally {
      isStartingRef.current = false;
    }
  }
  async function saveTranscript(isFinal = false) {
    try {
      if (!messagesRef.current.length) return;

      // âť— iba finĂˇlny save mĂˇ Ă­sĹĄ do DB
      if (!isFinal) return;

      // zabrĂˇni dvojitĂ©mu zĂˇpisu
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
            {sending ? "AI odpovedĂˇâ€¦" : "OdoslaĹĄ"}
          </button>
           */}
           <div className="voice-controls">

  {/* INFO pred prvĂ˝m povolenĂ­m mikrofĂłnu */}
{micError && (
  <div className="mic-hint-pristup">
    Aplikácia potrebuje prítup k mikrofónu.
  </div>
)}


  {/* HLAVNĂť KRUHOVĂť BUTTON */}
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

      Po stlačení mikrofónu sa spusti­ voice chat.
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
