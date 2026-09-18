import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { useLoginContext } from "@/context/LoginProvider";
import IncomingCallOverlay from "@/components/IncomingCallOverlay";
import { registerPushToken } from "@/utils/notifications";
import {
  registerForIncomingCalls,
  setIncomingCallHandler,
  type IncomingCall,
} from "@/services/voice";

// Registers this device to receive incoming-call pushes once a user is
// signed in, and renders the accept/decline overlay when a call arrives.
//
// Deliberately best-effort: a build without the native Voice module (e.g. an
// Expo Go session, or a dev client from before this was added) must not
// break sign-in. Registration failures are swallowed the same way the other
// startup integrations in app/_layout.tsx are.
export default function VoiceCallProvider({ children }: { children: React.ReactNode }) {
  const { isLogged } = useLoginContext();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const registeredRef = useRef(false);

  useEffect(() => {
    setIncomingCallHandler(isLogged ? setIncomingCall : null);
    if (!isLogged) {
      registeredRef.current = false;
      return;
    }
    if (registeredRef.current) return;
    registeredRef.current = true;
    registerForIncomingCalls().catch((error) => {
      // Not fatal: the dialer still works for outgoing calls, and
      // startVoiceCall() surfaces its own errors if the native module is
      // genuinely missing. This only means this device won't ring while
      // the app is open.
      console.log("Incoming-call registration deferred:", error?.message);
    });
    // Captures the device's push token server-side. This does not yet make
    // calls ring while the app is closed — see registerPushToken's own
    // comment for what's still missing on the Twilio/Apple/Google side.
    registerPushToken().catch(() => undefined);
  }, [isLogged]);

  const handleAccept = async () => {
    if (!incomingCall) return;
    const from = incomingCall.from;
    setIncomingCall(null);
    try {
      await incomingCall.accept();
      router.push({ pathname: "/(screens)/call", params: { number: from, activeCall: "true" } });
    } catch (error) {
      console.log("Unable to accept incoming call:", (error as Error)?.message);
    }
  };

  const handleDecline = () => {
    incomingCall?.reject();
    setIncomingCall(null);
  };

  return (
    <>
      {children}
      <IncomingCallOverlay call={incomingCall} onAccept={handleAccept} onDecline={handleDecline} />
    </>
  );
}
