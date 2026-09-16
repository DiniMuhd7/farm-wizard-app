declare module "@twilio/voice-react-native-sdk" {
  export interface VoiceCall { disconnect(): Promise<void> | void; }
  export const Voice: {
    connect(token: string, options: { params: { To: string } }): Promise<VoiceCall>;
    register(token: string): Promise<void>;
  };
}
