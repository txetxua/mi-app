import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { WebRTCConnection } from "@/lib/webrtc";
import { SpeechHandler } from "@/lib/speech";
import { type Language } from "@shared/schema";
import CallControls from "./CallControls";
import Subtitles from "./Subtitles";
import SubtitlesConfig from "./SubtitlesConfig";
import { type SubtitlesConfig as SubtitlesConfigType } from "./SubtitlesConfig";
import { useToast } from "@/hooks/use-toast";

interface Props {
  roomId: string;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

const DEFAULT_SUBTITLES_CONFIG: SubtitlesConfigType = {
  fontSize: 24,
  fontFamily: "sans",
  color: "white",
};

export default function VideoCall({ roomId, language, onLanguageChange }: Props) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const webrtcRef = useRef<WebRTCConnection>();
  const speechRef = useRef<SpeechHandler>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [transcript, setTranscript] = useState("");
  const [translated, setTranslated] = useState("");
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>();
  const [subtitlesConfig, setSubtitlesConfig] = useState<SubtitlesConfigType>(DEFAULT_SUBTITLES_CONFIG);

  useEffect(() => {
    const handleError = (error: Error) => {
      console.error("Error in call:", error);
      toast({
        variant: "destructive",
        title: "Error en la llamada",
        description: error.message,
      });
    };

    const webrtc = new WebRTCConnection(
      roomId,
      (stream) => {
        console.log("Setting remote stream");
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      },
      setConnectionState,
      handleError
    );

    const speech = new SpeechHandler(
      roomId,
      language,
      (text, translated) => {
        setTranscript(text);
        setTranslated(translated);
      }
    );

    console.log("Starting WebRTC connection...");
    webrtc.start(true).then(stream => {
      console.log("Got local stream, setting to video element");
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      speech.start();
    }).catch(handleError);

    webrtcRef.current = webrtc;
    speechRef.current = speech;

    return () => {
      webrtc.close();
      speech.stop();
    };
  }, [roomId, language, toast]);

  const handleHangup = () => {
    webrtcRef.current?.close();
    speechRef.current?.stop();
    setLocation("/");
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 relative bg-background">
        {/* Video remoto a pantalla completa */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Video local en esquina superior derecha */}
        <div className="absolute top-4 right-4 w-48 aspect-video">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover rounded-lg shadow-lg"
          />
        </div>

        <SubtitlesConfig onChange={setSubtitlesConfig} />

        <Subtitles 
          transcript={transcript}
          translated={translated}
          config={subtitlesConfig}
        />
      </div>

      <CallControls 
        language={language}
        onLanguageChange={onLanguageChange}
        connectionState={connectionState}
        roomId={roomId}
        onHangup={handleHangup}
      />
    </div>
  );
}